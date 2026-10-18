process.chdir(require('node:path').resolve(__dirname, '..'));
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const test = require('node:test');
const script = fs.readFileSync(`${__dirname}/../web/static/core_ui.js`, 'utf8');

test('Connect button exposes its pending state without duplicating the label', () => {
  const html = fs.readFileSync(`${__dirname}/../web/templates/index.html`, 'utf8');
  assert.match(html, /id="btn-connect" data-connection-state="disconnected"[^>]*aria-live="polite" aria-busy="false"/);
  assert.match(html, /<span class="connect-button__label">Conectar<\/span>/);
  assert.doesNotMatch(html, /connect-button__spinner|Conectando…/);
  assert.match(script, /button\.dataset\.connectionState = state/);
  assert.match(script, /button\.classList\.toggle\('is-connecting', state === 'connecting'\)/);
  assert.match(script, /button\.setAttribute\('aria-busy', String\(transitioning\)\)/);
});

function setup() {
  const feed = {
    children: [], scrollTop: 0, dataset: {}, style: {setProperty() {}},
    get firstElementChild() { return this.children[0]; },
    get lastChild() { return this.children.at(-1); },
    set innerHTML(_) { this.children = []; },
    appendChild(child) { this.children.push(child); },
    insertBefore(child, next) { this.children.splice(next ? this.children.indexOf(next) : this.children.length, 0, child); },
    removeChild(child) { this.children.splice(this.children.indexOf(child), 1); },
  };
  const stats = new Map();
  const document = {
    hidden: false, addEventListener() {}, dispatchEvent() {},
    getElementById(id) {
      if (id === 'comment-feed') return feed;
      if (id === 'empty-state') return feed.children.find(c => c.id === id) || null;
      if (!stats.has(id)) stats.set(id, {textContent: '0', style: {}, children: [], addEventListener() {}, dispatchEvent() {},
        replaceChildren() { this.children = []; }, appendChild(child) { this.children.push(child); }});
      return stats.get(id);
    },
    createElement() { return {dataset: {}, remove() { feed.removeChild(this); }}; },
  };
  const requests = [], timers = [];
  const context = vm.createContext({
    window: {},
    CustomEvent:class {constructor(type,options){this.type=type;this.detail=options?.detail}},document, URLSearchParams, AbortSignal,
    io: () => ({on() {}}), clearTimeout() {},
    setTimeout(fn, delay) { timers.push(delay); return timers.length; },
    fetch: async url => { requests.push(url); return {ok: true, json: async () => ({session: 'A', cursor: 3, comments: [comment(1), comment(2), comment(3)]})}; },
  });
  vm.runInContext(script, context);
  return {context, feed, document, requests, timers};
}

const comment = n => ({id: String(n), session: 'A', sequence: n, user: 'viewer', comment: String(n), timestamp: '23:01:02'});

test('follow activity renders escaped without comment actions or count', () => {
  const {context,feed} = setup();
  context.window.ChatExtras = {badges(){throw Error('badges');},greeting(){throw Error('greeting');}};
  context.window.Studio = {ingest:()=>true,decorate(){throw Error('comment actions');}};
  context.Studio = context.window.Studio;
  context.receiveComment({...comment(1),kind:'follow',user:'@<img>',comment:'empezó a seguirte'},true);
  assert.match(feed.children[0].innerHTML, /&lt;img&gt;/);
  assert.match(feed.children[0].innerHTML, /empezó a seguirte/);
  assert.match(feed.children[0].className, /follow-activity/);
  assert.equal(vm.runInContext('commentCount',context),0);
});

test('follow activity bypasses comment filters and automatic speech', () => {
  const {studio,element,spoken}=setupStudio();
  element('tts-enabled').checked=true;
  element('questions-only').checked=true;
  element('blocked-words').value='follower';
  assert.equal(studio.ingest({...comment(1),kind:'follow',user:'@follower',comment:'empezó a seguirte'},true),true);
  assert.equal(spoken.length,0);
});

test('chat extras render safe badges and greet through local manual voice only', () => {
  function element() {
    return {childNodes:[], events:{}, append(child){this.childNodes.push(child);},
      setAttribute(){}, addEventListener(name,fn){this.events[name]=fn;}, remove(){this.removed=true;}};
  }
  const spoken=[], window={Studio:{speakManual:text=>spoken.push(text)}};
  vm.runInNewContext(fs.readFileSync(`${__dirname}/../web/static/chat_extras.js`,'utf8'), {window,URL,CustomEvent:class {constructor(type,options){this.type=type;this.detail=options?.detail}},document:{createElement:element}});
  const parent=element();
  window.ChatExtras.badges(parent,[{image_url:'javascript:alert(1)'},{image_url:'https://example.com/badge.png',text:'22'}, {text:'<script>no HTML</script>'}]);
  assert.equal(parent.childNodes.length,2);
  assert.equal(parent.childNodes[0].childNodes[0].src,'https://example.com/badge.png');
  assert.equal(parent.childNodes[1].childNodes[0].textContent,'<script>no HTML</script>');
  window.ChatExtras.greeting(parent,'@Carlos');
  const button=parent.childNodes.at(-1);
  assert.match(button.title,/no envía/);
  button.events.click();
  assert.deepEqual(spoken,['¡Hola, Carlos! Gracias por acompañarnos.']);
});

test('automatic reading toggles keep a fixed label and expose state through aria', () => {
  function element() {
    const events={}, attributes={}, classes=new Set();
    return {
      checked:false, textContent:'', events,
      addEventListener(name,fn){events[name]=fn;},
      dispatchEvent(event){events[event.type]?.(event);},
      setAttribute(name,value){attributes[name]=value;},
      getAttribute(name){return attributes[name];},
      classList:{toggle(name,on){if(on)classes.add(name);else classes.delete(name);},contains:name=>classes.has(name)},
    };
  }
  const setting=element(), button=element(), state=element();
  const window={};
  vm.runInNewContext(fs.readFileSync(`${__dirname}/../web/static/chat_extras.js`,'utf8'), {
    window, URL, Event, MutationObserver:class {observe(){}},
    document:{createElement:element,getElementById:id=>id==='tts-gifts-enabled'?setting:state},
  });
  window.ChatExtras.bindAutoToggle(button,'tts-gifts-enabled','lectura automática de regalos','Leer regalos');
  assert.equal(button.textContent,'Leer regalos');
  assert.equal(button.getAttribute('aria-pressed'),'false');
  button.events.click();
  assert.equal(button.textContent,'Leer regalos');
  assert.equal(button.getAttribute('aria-pressed'),'true');
  assert.equal(button.classList.contains('enabled'),true);
});

test('manual greetings work with automatic voice off and respect emergency mute', () => {
  const {studio,spoken}=setupStudio();
  studio.speakManual('¡Hola, Carlos!');
  assert.equal(spoken[0].text,'¡Hola, Carlos!');
  studio.mute(true);
  studio.speakManual('No debe sonar');
  assert.equal(spoken.length,1);
});

function setupStudio(savedPreferences = {}, productionUI = null, rendering = {}) {
  const elements = new Map(), spoken = [], listeners = {}, storage = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, {value:'', checked:false, options:[], textContent:'',
      type:['tts-read-name','tts-use-profile-name','tts-gifts-enabled','tts-greetings-enabled','no-emoji','alerts-enabled','antispam','tts-restrict'].includes(id)?'checkbox':'text',
      events:{}, addEventListener(name,fn){this.events[name]=fn;}, dispatchEvent(event){this.events[event.type]?.(event);},
      replaceChildren(){this.options=[];}, append(child){this.options.push(child);}});
    return elements.get(id);
  };
  element('tts-rate').value='1'; element('tts-volume').value='0.7';
  element('tts-read-name').checked=true;
  const speechSynthesis={cancel(){},pause(){},resume(){},getVoices:()=>[{voiceURI:'local-es',name:'Local español',lang:'es-MX',localService:true}],addEventListener(){},dispatchEvent(){},speak:u=>spoken.push(u)};
  const window={speechSynthesis,ProductionUI:productionUI};
  vm.runInNewContext(fs.readFileSync(`${__dirname}/../web/static/studio.js`,'utf8'), {
    ...rendering,
    window, speechSynthesis, SpeechSynthesisUtterance:function(text){this.text=text;},
    CustomEvent:class {constructor(type,options){this.type=type;this.detail=options?.detail}},document:{getElementById:element,createElement:()=>({}),querySelectorAll:()=>[],addEventListener(name,fn){listeners[name]=fn;},dispatchEvent(event){listeners[event.type]?.(event);}},
    localStorage:{getItem:key=>key==='tikreader.preferences'?JSON.stringify(savedPreferences):null,setItem:(key,value)=>storage.set(key,value)},
    location:{origin:'http://localhost:5000'},setTimeout(){},clearTimeout(){},
  });
  return {studio:window.Studio,element,spoken,speechSynthesis,storage,event:name=>listeners[name]?.()};
}

test('follow activity survives filter rerenders without speech', () => {
  const rendered=[];
  const {studio,element,spoken}=setupStudio({},null,{clearFeed(){rendered.length=0;},addComment:item=>rendered.push(item)});
  studio.ingest({...comment(1),kind:'follow',user:'@follower',comment:'empezó a seguirte'},true);
  element('chat-search').value='no match';
  element('chat-search').oninput();
  assert.equal(rendered.length,1);
  assert.equal(rendered[0].kind,'follow');
  assert.equal(spoken.length,0);
});

test('automatic voice holds and session updates do not interrupt a manual preview', () => {
  const {studio,speechSynthesis,event}=setupStudio();
  let pauses=0,cancels=0;
  speechSynthesis.pause=()=>pauses++;
  speechSynthesis.cancel=()=>cancels++;
  studio.hold('audio-owner',true);
  assert.equal(studio.beginVoicePreview(),true);
  const before={pauses,cancels};
  studio.hold('audio-owner',true);
  studio.hold('mic',true);
  studio.ingest(comment(1),false);
  event('tikreader:voice-changing');
  event('tikreader:voice-changed');
  assert.deepEqual({pauses,cancels},before);
  studio.endVoicePreview();assert.equal(pauses,before.pauses+1);
  studio.mute(true);assert.equal(studio.beginVoicePreview(),false);
});

test('studio filters blocked words, questions and repeated live comments', () => {
  const {studio,element}=setupStudio();
  element('antispam').checked=true;
  assert.equal(studio.ingest(comment(1),true),true);
  assert.equal(studio.ingest(comment(1),true),false);
  element('blocked-words').value='prohibida';
  assert.equal(studio.ingest({...comment(2),comment:'Una palabra PROHIBIDA'},true),false);
  element('questions-only').checked=true;
  assert.equal(studio.ingest(comment(3),true),false);
  assert.equal(studio.ingest({...comment(4),comment:'¿Hola?'},true),true);
});

test('voice excludes restored history, strips emoji and advances queue when skipping', () => {
  const {studio,element,spoken}=setupStudio();
  element('tts-enabled').checked=true; element('no-emoji').checked=true;
  studio.ingest(comment(1),false);
  assert.equal(spoken.length,0);
  studio.ingest({...comment(2),comment:'Hola 🎁'},true);
  studio.ingest({...comment(3),comment:'Segundo'},true);
  assert.equal(spoken.length,1);
  assert.equal(spoken[0].text,'viewer dice: Hola ');
  assert.equal(spoken[0].volume,0.7);
  element('tts-skip').onclick();
  assert.equal(spoken.length,2);
  spoken[0].onend();
  assert.equal(spoken.length,2);
  spoken[1].onend();
  assert.match(element('tts-state').textContent,/cola: 0/);
});

test('voice omits the username when reading names is disabled', () => {
  const {studio,element,spoken}=setupStudio();
  element('tts-enabled').checked=true;element('tts-read-name').checked=false;
  studio.ingest({...comment(1),comment:'Hola'},true);
  assert.equal(spoken[0].text,'Hola');
});

test('profile-name voice preference restores, persists and defaults off', () => {
  const restored=setupStudio({'tts-use-profile-name':true});
  assert.equal(restored.element('tts-use-profile-name').checked,true);
  const control=restored.element('tts-use-profile-name');
  control.checked=false;control.dispatchEvent({type:'change'});
  const saved=JSON.parse(restored.storage.get('tikreader.preferences'));
  assert.equal(saved['tts-use-profile-name'],false);
  assert.equal(saved['tts-read-name'],true);
  assert.equal(setupStudio().element('tts-use-profile-name').checked,false);
  assert.equal(setupStudio(saved).element('tts-use-profile-name').checked,false);
});

test('profile-name checkbox keeps the existing commenter-name control', () => {
  const html=fs.readFileSync(`${__dirname}/../web/templates/index.html`,'utf8');
  assert.match(html,/<input id="tts-read-name" type="checkbox" checked> Leer el nombre de quien comenta/);
  assert.match(html,/<input id="tts-use-profile-name" type="checkbox"> Usar el nombre del perfil/);
});

test('voice uses a selected profile name and strips one leading at sign', () => {
  const {studio,element,spoken}=setupStudio({'tts-use-profile-name':true});
  element('tts-enabled').checked=true;
  studio.ingest({...comment(1),user:'@account',display_name:'@Visible Profile'},true);
  assert.equal(spoken[0].text,'Visible Profile dice: 1');
});

test('voice falls back to the account name when a selected profile name is empty', () => {
  const {studio,element,spoken}=setupStudio({'tts-use-profile-name':true});
  element('tts-enabled').checked=true;
  studio.ingest({...comment(1),user:'@account',display_name:'  '},true);
  assert.equal(spoken[0].text,'account dice: 1');
});

test('selected profile name reaches production comment speech without changing comment data', () => {
  let spokenData;
  const productionUI={speechText:text=>text,readComment(data,read){spokenData=data;read(`${data.user.replace(/^@/,'')} dice: ${data.comment}`);}};
  const {studio,element,spoken}=setupStudio({'tts-use-profile-name':true},productionUI);
  element('tts-enabled').checked=true;
  const record={...comment(1),user:'@account',display_name:'@Visible Profile'};
  studio.ingest(record,true);
  assert.equal(spokenData.user,'@Visible Profile');
  assert.equal(record.user,'@account');
  assert.equal(spoken[0].text,'Visible Profile dice: 1');
});

test('voice prioritizes questions and reports synthesis errors instead of hiding them', () => {
  const {studio,element,spoken}=setupStudio();
  element('tts-enabled').checked=true;element('tts-priority').value='questions';
  studio.ingest({...comment(1),comment:'Primero'},true);
  studio.ingest({...comment(2),comment:'Segundo'},true);
  studio.ingest({...comment(3),comment:'¿Pregunta?'},true);
  spoken[0].onend();
  assert.equal(spoken[1].text,'viewer dice: ¿Pregunta?');
  spoken[1].onerror({error:'not-allowed'});
  assert.match(element('tts-state').textContent,/Error de voz: not-allowed/);
});

test('microphone hold blocks queued voice and emergency clears it including manual reading', () => {
  const {studio,element,spoken}=setupStudio();element('tts-enabled').checked=true;
  studio.hold('mic',true);studio.ingest(comment(1),true);
  assert.equal(spoken.length,0);
  studio.hold('mic',false);assert.equal(spoken.length,1);
  studio.ingest(comment(2),true);studio.mute(true);
  assert.equal(studio.queueInfo().pending,0);
  studio.speakManual('No debe sonar');assert.equal(spoken.length,1);
  studio.mute(false);spoken[0].onend();assert.equal(spoken.length,1);
  studio.ingest(comment(3),true);assert.equal(spoken.length,2);
});

test('manual voice explains emergency, zero volume and pause without bypassing them', () => {
  const {studio,element,spoken}=setupStudio();
  studio.mute(true);studio.speakManual('Hola');
  assert.match(element('studio-notice').textContent,/Reanudar voz y efectos/);
  assert.equal(spoken.length,0);
  studio.mute(false);element('tts-volume').value='0';studio.speakManual('Hola');
  assert.match(element('studio-notice').textContent,/volumen.*cero/);
  assert.equal(spoken.length,0);
  element('tts-volume').value='0.7';element('tts-pause').onclick();studio.speakManual('Hola');
  assert.match(element('studio-notice').textContent,/Continuar voz/);
  assert.equal(spoken.length,0);
  element('tts-pause').onclick();studio.speakManual('Hola');
  assert.equal(spoken.length,1);
});

test('voice log records actual synthesis start and end callbacks', () => {
  const {studio,spoken}=setupStudio();
  studio.speakManual('Verificar audio');
  assert.equal(studio.voiceSnapshot().log.length,0);
  spoken[0].onstart();
  assert.match(studio.voiceSnapshot().log[0].reason,/inició/);
  spoken[0].onend();
  assert.match(studio.voiceSnapshot().log[0].reason,/terminó/);
  assert.equal(studio.voiceSnapshot().current,null);
});

test('saturation bounds the queue and counts omitted readings', () => {
  const {studio,element}=setupStudio();element('tts-enabled').checked=true;element('tts-cap').value='2';
  studio.hold('mic',true);for(let n=1;n<=5;n++)studio.ingest(comment(n),true);
  assert.equal(studio.queueInfo().pending,2);assert.equal(studio.queueInfo().omitted,3);
});

test('voice queue can advance, defer, restore and remove pending items', () => {
  const {studio,element,spoken}=setupStudio();element('tts-enabled').checked=true;
  studio.hold('test',true);for(let n=1;n<=3;n++)studio.ingest(comment(n),true);
  const items=studio.voiceSnapshot().pending;
  assert.equal(studio.editQueue(items[2].id,'front'),true);
  assert.equal(studio.voiceSnapshot().pending[0].id,items[2].id);
  studio.editQueue(items[0].id,'later');assert.equal(studio.voiceSnapshot().deferred.length,1);
  studio.editQueue(items[1].id,'remove');assert.equal(studio.voiceSnapshot().pending.length,1);
  studio.editQueue(items[0].id,'restore');assert.equal(studio.voiceSnapshot().deferred.length,0);
  studio.hold('test',false);assert.equal(spoken[0].text,'viewer dice: 1');
  assert.equal(studio.voiceSnapshot().current,'viewer dice: 1');
});

test('voice log explains unknown followers without changing the chat', () => {
  const {studio,element}=setupStudio();element('tts-enabled').checked=true;element('tts-restrict').checked=true;element('tts-audience').value='followers';
  assert.equal(studio.ingest({...comment(1),is_follower:null},true),true);
  assert.match(studio.voiceSnapshot().log[0].reason,/no confirmado/);
});

test('ten thousand comments stay bounded, ordered and deduplicated', () => {
  const {context,feed}=setup();
  for(let n=1;n<=10000;n++)context.receiveComment(comment(n));
  context.receiveComment(comment(10000));
  assert.equal(feed.children.length,200);
  assert.equal(feed.children[0].dataset.sequence,10000);
  assert.equal(feed.children.at(-1).dataset.sequence,9801);
});

test('follower-only speech requires confirmation but leaves all comments visible', () => {
  const {studio,element,spoken}=setupStudio();
  element('tts-enabled').checked=true;element('tts-restrict').checked=true;element('tts-audience').value='followers';
  for(const [i,is_follower] of [false,null,true].entries())assert.equal(studio.ingest({...comment(i),is_follower},true),true);
  assert.equal(spoken.length,1);
  assert.equal(spoken[0].text,'viewer dice: 2');
});

test('selected users are exact case-insensitive handles and manual mode never auto-reads', () => {
  const {studio,element,spoken}=setupStudio();
  element('tts-enabled').checked=true;element('tts-restrict').checked=true;element('tts-audience').value='selected';
  element('tts-allowed-users').value='@Chosen, another';
  studio.ingest({...comment(1),user:'@chosen_extra'},true);
  studio.ingest({...comment(2),user:'@CHOSEN'},true);
  assert.equal(spoken.length,1);spoken[0].onend();
  element('tts-audience').value='manual';
  studio.ingest({...comment(3),user:'@Chosen'},true);
  assert.equal(spoken.length,1);
});

test('gift voice priority ignores initial history and repeated streak snapshots', () => {
  const {studio,element,spoken}=setupStudio();
  element('tts-enabled').checked=false;element('tts-gifts-enabled').checked=true;element('tts-priority').value='gifts';
  element('alert-gift').value='';element('alert-min').value='1';
  const gift={id:'g1',user:'sender',gift:'Rosa',count:1};
  studio.gifts({session:'A',gifts:[gift]});
  assert.equal(spoken.length,0);
  studio.gifts({session:'A',gifts:[{...gift,count:2}]});
  studio.gifts({session:'A',gifts:[{...gift,count:2}]});
  assert.equal(spoken.length,1);
  assert.equal(spoken[0].text,'sender regaló Rosa, cantidad 2');
});

test('local alert test reports emergency mute instead of a false success', () => {
  const {studio,element}=setupStudio();
  studio.mute(true);
  element('alert-test').onclick();
  assert.match(element('alert-local-status').textContent,/silenciada/);
  assert.doesNotMatch(element('alert-local-status').textContent,/Prueba enviada/);
});

test('known zero likes and one viewer render as numbers, not missing data', () => {
  const {context,document}=setup();
  context.applyStats({session:'A',revision:1,comments:0,likes:0,gifts:0,viewers:1,likes_known:true,viewers_known:true,likes_source:'room',like_events:0});
  assert.equal(document.getElementById('stat-likes').textContent,'0');
  assert.equal(document.getElementById('stat-viewers').textContent,'1');
});

test('incremental recovery reads new comments once but never replays initial history', () => {
  const {context}=setup();
  const received=[];
  context.window.Studio=context.Studio={decorate(){},ingest(data,live){received.push([data.id,live]);return true;}};
  context.receiveHistory({session:'A',comments:[]});
  context.receiveHistory({session:'A',comments:[comment(1)]},true);
  context.receiveHistory({session:'A',comments:[comment(1),comment(2)]},true);
  context.receiveComment(comment(2));
  context.receiveHistory({session:'A',comments:[comment(3)]});
  assert.deepEqual(received,[['1',false],['2',true],['3',false]]);
});

test('recovery fills gaps despite newer websocket events and sends cursor', async () => {
  const {context, feed, requests} = setup();
  context.receiveComment(comment(3));
  await context.syncFeed();
  assert.deepEqual(feed.children.map(c => c.dataset.sequence), [3, 2, 1]);
  await context.syncFeed();
  assert.match(requests[1], /after=3/);
  assert.equal(feed.children.length, 3);
  assert.match(feed.children[0].innerHTML, /11:01:02 PM/);
});

test('hidden page syncs less often; unchanged stats schedule no animation', async () => {
  const {context, document, timers} = setup();
  document.hidden = true;
  await context.syncFeed();
  assert.equal(timers.at(-1), 15000);
  const count = timers.length;
  context.animateStat('stat-likes', 0);
  assert.equal(timers.length, count);
  context.animateStat('stat-likes', 42);
  context.animateStat('stat-likes', 42);
  assert.equal(timers.length, count + 1);
});

test('feed stays bounded and clear does not replay seen messages', () => {
  const {context, feed} = setup();
  for (let n = 1; n <= 250; n++) context.receiveComment(comment(n));
  assert.equal(feed.children.length, 200);
  assert.equal(feed.children[0].dataset.sequence, 250);
  assert.equal(feed.children.at(-1).dataset.sequence, 51);
  context.clearFeed();
  context.receiveHistory({session: 'A', cursor: 250, comments: [comment(250)]});
  assert.equal(feed.children[0].id, 'empty-state');
});

test('gift panel shows sender and quantity, updates streak, rejects stale snapshots', () => {
  const {context, document} = setup();
  const gift = {id:'g1',user:'@sender',gift:'Rosa',count:1,ongoing:true,timestamp:'13:05:00'};
  context.receiveGifts({session:'A',gift_version:1,gifts:[gift]});
  context.receiveGifts({session:'A',gift_version:2,gifts:[{...gift,count:3,ongoing:false}]});
  context.receiveGifts({session:'A',gift_version:1,gifts:[gift]});
  const rows = document.getElementById('gift-rows').children;
  assert.equal(rows.length,1);
  assert.match(rows[0].innerHTML,/@sender/);
  assert.match(rows[0].innerHTML,/×3/);
  assert.doesNotMatch(rows[0].innerHTML,/Recibido|En racha|Recuperado/);
  assert.equal((rows[0].innerHTML.match(/<td\b/g) || []).length,4);
  assert.match(rows[0].innerHTML,/1:05:00 PM/);
});

test('gift panel rejects activity rankings that are not verified gifts', () => {
  const {context, document} = setup();
  context.receiveGifts({session:'A',gift_version:1,gifts:[{
    id:'rank:sender',user:'@sender',gift:'Aportes anteriores del LIVE',count:1,
    diamonds:27,summary:true,timestamp:''
  }]});
  assert.equal(document.getElementById('gift-rows').children.length,0);
  assert.equal(document.getElementById('gift-table').hidden,true);
  assert.equal(document.getElementById('gift-empty').hidden,false);
});

test('new sessions distinguish pending viewers from known zero and reject stale snapshots', () => {
  const {context, document} = setup();
  const initial={session:'A',revision:1,comments:0,gifts:0,likes:0,viewers:0,likes_known:false,viewers_known:false};
  context.applyStats(initial);
  assert.equal(document.getElementById('stat-likes').textContent,'0');
  assert.equal(document.getElementById('stat-viewers').textContent,'—');
  context.applyStats({...initial,revision:2,likes_known:true,viewers_known:true});
  assert.equal(document.getElementById('stat-likes').textContent,'0');
  assert.equal(document.getElementById('stat-viewers').textContent,'0');
  context.applyStats(initial);
  assert.equal(document.getElementById('stat-likes').textContent,'0');
  assert.equal(document.getElementById('stat-viewers').textContent,'0');
});

test('HTTP recovery restores likes and gifts without allowing older statistics', () => {
  const {context, document} = setup();
  const stats={session:'A',revision:3,comments:0,likes:22,gifts:3,viewers:0,like_events:2,last_like_at:'13:00:00'};
  context.receiveHistory({session:'A',cursor:0,comments:[],stats});
  context.applyStats({...stats,revision:2,likes:5});
  assert.equal(document.getElementById('stat-likes').textContent,'22');
  assert.equal(document.getElementById('stat-gifts').textContent,'3');
});

test('automatic greetings have independent controls and cancel only their own queue', () => {
  const {studio,element,spoken}=setupStudio();
  studio.greetAutomatic('@Apagado');assert.equal(spoken.length,0);
  element('tts-greetings-enabled').checked=true;
  studio.greetAutomatic('@Carlos');studio.greetAutomatic('@Ana');
  assert.equal(spoken.length,1);assert.match(spoken[0].text,/Hola, Carlos/);
  assert.equal(studio.audioDiagnostics().enabled,true);
  element('tts-enabled').onchange();
  assert.equal(studio.queueInfo().pending,1);
  element('tts-greetings-enabled').checked=false;element('tts-greetings-enabled').onchange();
  assert.equal(studio.queueInfo().pending,0);
  spoken[0].onend();assert.equal(spoken.length,1);
  element('tts-greetings-enabled').checked=true;studio.mute(true);studio.greetAutomatic('@Silencio');
  assert.equal(spoken.length,1);
});

test('participants greet new people once, skip initial history and reset per session', () => {
  const spoken=[];
  const element=()=>({childNodes:[],classList:{toggle(){}},setAttribute(){},append(){},before(){},replaceChildren(){}});
  const window={Studio:{greetAutomatic:user=>spoken.push(user)},ChatExtras:{bindAutoToggle(){},greeting(){},badges(){}},addEventListener(){},dispatchEvent(){}};
  vm.runInNewContext(fs.readFileSync(`${__dirname}/../web/static/participants.js`,'utf8'),{window,URL,CustomEvent:class {constructor(type,options){this.type=type;this.detail=options?.detail}},document:{createElement:element,querySelector:element,getElementById:element}});
  const snapshot=(session,revision,users)=>({session,revision,participants:users.map(user=>({user})),joins:[]});
  window.Participants.render(snapshot('A',1,['@Anterior']));
  window.Participants.render(snapshot('A',2,['@Anterior','@Carlos']));
  window.Participants.render(snapshot('A',3,['@carlos']));
  window.Participants.render(snapshot('A',2,['@Viejo']));
  assert.deepEqual(spoken,['@Carlos']);
  window.Participants.render(snapshot('B',0,[]));
  window.Participants.render(snapshot('B',1,['@Carlos']));
  assert.deepEqual(spoken,['@Carlos','@Carlos']);
});

test('participants panel labels recent activity and removes expired rows', () => {
  const nodes=[];let now=1_000_000;const timers=[];
  const element=()=>{const node={childNodes:[],classList:{toggle(){}},setAttribute(name,value){this[name]=value},append(...items){this.childNodes.push(...items)},before(){},replaceChildren(...items){this.childNodes=items}};nodes.push(node);return node};
  class FakeDate extends Date {static now(){return now}}
  const window={Studio:{greetAutomatic(){}},ChatExtras:{bindAutoToggle(){},greeting(){},badges(){}},addEventListener(){},setTimeout(callback,delay){timers.push({callback,delay});return timers.length},clearTimeout(){}};
  vm.runInNewContext(fs.readFileSync(`${__dirname}/../web/static/participants.js`,'utf8'),{window,URL,Date:FakeDate,setTimeout:window.setTimeout,clearTimeout:window.clearTimeout,CustomEvent:class {constructor(type,options){this.type=type;this.detail=options?.detail}},document:{createElement:element,querySelector:element,getElementById:element}});
  window.Participants.render({session:'A',revision:1,activity_window_seconds:180,participants:[{user:'@Carlos',last_seen:now/1000}],joins:[]});
  assert.ok(nodes.some(node=>node.textContent==='Actividad reciente'));
  assert.ok(nodes.some(node=>node['aria-label']==='Actividad reciente de participantes'));
  assert.equal(timers.at(-1).delay,180_000);
  now+=180_000;timers.at(-1).callback();
  assert.equal(nodes.find(node=>node.className==='participants-list').childNodes.filter(node=>node.className==='participant-chip').length,0);
});

