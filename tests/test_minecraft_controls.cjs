const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const minecraftSource=process.env.MINECRAFT_TEST_SOURCE||`${__dirname}/../web/static/minecraft.js`;

function setup({holdInitial=false,failInitial=false,oldBackend=false,oldQuantities=false,initialPresets={},initialBedrockPresets={},initialEdition='java',storage=new Map(),storageReadError=false,storageWriteError=false,clipboardError=false}={}){
  const nodes=[],timers=new Map(),listeners={},observers=[];let serial=0,pane,fail=failInitial,hold=holdInitial,release,holdNextMinecraftRead=false,releaseNextMinecraftRead,stalePresetResponse=false,clipboardErrorState=clipboardError;const clipboard=[];
  const requests=[];let heldPost,releasePost;
  const java={host:'localhost',port:25575,commands:{probe:'list'}},bedrock={commands:{bed:'say hello'}};
  const publicCatalog=JSON.parse(fs.readFileSync(minecraftSource,'utf8').match(/const defaultActions=(\[.*?\]);/s)[1]);
  const presetCatalog=publicCatalog.map(row=>({...row,...(row.quantity?{quantity_min:1,quantity_max:20,quantity_default:row.quantity}:{})}));
  const presetCategories=[['actions','Acciones'],['animals','Animales'],['aquatic','Acuáticos'],['helpers','Ayudantes'],['undead','No-muertos'],['hostile','Hostiles'],['nether','Nether'],['end','End'],['bosses','Jefes']].map(([id,name])=>({id,name}));
  const presetSections=[['environment','Ambiente'],['abilities','Habilidades'],['items','Objetos'],['mobs','Mobs']].map(([id,name])=>({id,name}));
  const defaults=()=>Object.fromEntries(presetCatalog.map(p=>[p.id,{gift_id:'',gift_name:'',enabled:false}]));
  java.presets={...defaults(),...initialPresets};bedrock.presets={...defaults(),...initialBedrockPresets};let giftCatalog=[{id:'1',name:'Rose',diamonds:1}];
  let state={edition:initialEdition,authorization_mode:'automatic',preset_categories:presetCategories,preset_sections:presetSections,profiles:{java,bedrock},config:initialEdition==='java'?java:bedrock,preset_catalog:oldBackend?undefined:oldQuantities?presetCatalog.map(({id,name,description})=>({id,name,description})):presetCatalog,presets:initialEdition==='java'?java.presets:bedrock.presets,bedrock:{prepared:false,connected:false},authorized:true,queued:0,log:[]};
  class Element {
    constructor(tag){this.tagName=tag;this.textContent='';this.value='';this.children=[];this.dataset={};this.events={};this.attributes={};this.hidden=false;this.isConnected=true;this.replaceCount=0;nodes.push(this);}
    append(...items){this.children.push(...items);for(const item of items){item.parentElement=this;item.isConnected=this.isConnected;}}
    replaceChildren(...items){for(const item of this.children)item.isConnected=false;this.children=items;this.replaceCount++;for(const item of items){item.parentElement=this;item.isConnected=this.isConnected;}}
    prepend(...items){this.children.unshift(...items);for(const item of items){item.parentElement=this;item.isConnected=this.isConnected;}}
    remove(){this.isConnected=false;if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(item=>item!==this);}
    select(){this.selected=true;}
    setAttribute(name,value){this.attributes[name]=String(value);if(name!=='aria-pressed')this[name]=value;}
    getAttribute(name){return Object.hasOwn(this.attributes,name)?this.attributes[name]:null;}
    focus(){document.activeElement=this;}
    addEventListener(name,fn){this.events[name]=fn;}
  }
  const document={hidden:false,head:new Element('head'),body:new Element('body'),activeElement:null,createElement:tag=>new Element(tag),createElementNS:(namespace,tag)=>{const node=new Element(tag);node.namespaceURI=namespace;return node;},createTextNode:text=>{const node=new Element('#text');node.textContent=text;return node;},addEventListener:(name,fn)=>listeners[name]=fn};
  const window={addEventListener:(name,fn)=>listeners[name]=fn,OperatorViewRegistry:{register(key,node){pane=node;}}};
  const context={window,document,Date,AbortController,AbortSignal,structuredClone,localStorage:{getItem:key=>{if(storageReadError)throw Error('storage denied');return storage.has(key)?storage.get(key):null;},setItem:(key,value)=>{if(storageWriteError)throw Error('storage denied');storage.set(key,String(value));},removeItem:key=>storage.delete(key)},navigator:{clipboard:{writeText:async value=>{if(clipboardErrorState)throw Error('clipboard denied');clipboard.push(value);}}},
    MutationObserver:class{constructor(fn){this.fn=fn;}observe(target,options){observers.push({fn:this.fn,target,options});}disconnect(){}},
    setTimeout(fn,delay){const id=++serial;timers.set(id,{fn,delay});return id;},clearTimeout:id=>timers.delete(id),
    fetch:async(path,options={})=>{
      const data=options.body?JSON.parse(options.body):null;
      requests.push({path,method:options.method||'GET',data});
      const previousPresets=path==='/minecraft/presets'?structuredClone(state.presets):null;
      if(path==='/minecraft'&&data?.select_only){state.edition=data.edition;state.config=state.profiles[data.edition];state.presets=state.config.presets;state.authorized=false;}
      if(path==='/minecraft/presets'&&data){state.config.presets=structuredClone(data.presets);state.presets=state.config.presets;}
      if(path==='/minecraft/presets/settings'&&data){state.config.limits=structuredClone(data.limits);state.config.name_format=data.name_format;}
      if(path==='/minecraft/presets/stop'&&data)state.effect_queue={...state.effect_queue,paused:true};
      if(path==='/minecraft/presets/resume'&&data)state.effect_queue={...state.effect_queue,paused:false};
      if(path==='/minecraft/authorize'&&data)state.authorized=data.enabled;
      if(path==='/minecraft/disconnect')state.authorized=false;
      if(holdNextMinecraftRead&&path==='/minecraft'&&options.method!=='POST'){holdNextMinecraftRead=false;await new Promise(resolve=>releaseNextMinecraftRead=resolve);}
      const snapshot=path==='/gift-catalog'?{gifts:giftCatalog}:path==='/minecraft/bedrock/prepare'?{command:'/wsserver ws://127.0.0.1:54321/secret'}:structuredClone(state);
      if(options.method==='POST'&&heldPost===path){heldPost=null;await new Promise(resolve=>releasePost=resolve);}
      if(hold&&options.method==='GET'&&path==='/minecraft')await new Promise(resolve=>release=resolve);if(fail)throw Error('offline');
      if(stalePresetResponse&&path==='/minecraft/presets'){stalePresetResponse=false;snapshot.presets=previousPresets;}
      return {ok:true,json:async()=>snapshot};}};
  vm.runInNewContext(fs.readFileSync(minecraftSource,'utf8'),context);
  const flush=async()=>{for(let i=0;i<40;i++)await Promise.resolve();};
  const field=label=>nodes.find(n=>n.tagName==='label'&&n.textContent===label).children[0];
  return {nodes,requests,timers,field,flush,get pane(){return pane;},setState:value=>state={...state,...value},
    fail:value=>fail=value,hold:()=>hold=true,release:()=>{hold=false;release();},holdNextRead:()=>holdNextMinecraftRead=true,releaseNextRead:()=>releaseNextMinecraftRead(),
    holdPost:path=>heldPost=path,releasePost:()=>{heldPost=null;releasePost();},
    staleNextPresetResponse(){stalePresetResponse=true;},
    get serverEdition(){return state.edition;},get profilesSnapshot(){return JSON.stringify(state.profiles);},get activeElement(){return document.activeElement;},get clipboard(){return clipboard;},setClipboardError(value){clipboardErrorState=value;},get storage(){return storage;},
    catalog:value=>giftCatalog=value,
    preset:(id,control)=>nodes.find(n=>n.isConnected&&n.dataset[control==='gift'?'presetGift':'presetEnabled']===id),
    actionFilter:id=>nodes.find(n=>n.dataset.actionFilter===id),
    actionFilters:()=>nodes.filter(n=>n.dataset.actionFilter),
    actionCategory:()=>nodes.find(n=>n.dataset.actionCategoryFilter),
    actionRows:()=>nodes.filter(n=>n.isConnected&&n.dataset.quickAction),
    actionRow:id=>nodes.find(n=>n.isConnected&&n.dataset.quickAction===id),
    actionSearch:()=>nodes.find(n=>n.dataset.actionSearch),
    actionOption:id=>nodes.find(n=>n.isConnected&&n.dataset.actionOption===id),
    actionOptions:()=>nodes.filter(n=>n.isConnected&&n.dataset.actionOption),
    async addAction(id){const picker=nodes.find(n=>n.dataset.actionPicker);picker.value=id;await picker.events.change();await nodes.find(n=>n.dataset.addAction).onclick();await flush();},
    async tick(){const [id,timer]=timers.entries().next().value||[];assert.ok(timer,'refresh timer exists');timers.delete(id);timer.fn();await flush();},
    async hidden(value){pane.hidden=value;for(const o of observers)if(o.options.attributes)o.fn([]);await flush();},
    async visibility(value){document.hidden=value;listeners.visibilitychange?.();await flush();},
    async connection(value){pane.isConnected=value;for(const o of observers)if(o.options.childList)o.fn([]);await flush();},
    async detach(){await this.connection(false);},
    async pagehide(){listeners.pagehide?.();await flush();},
    async click(text){await nodes.find(n=>n.tagName==='button'&&(n.textContent===text||n['aria-label']===text)).onclick();await flush();},
    async edition(value){const select=field('Edición');select.value=value;await select.events.change();await flush();},
    text:()=>nodes.filter(n=>n.tagName==='div').flatMap(n=>n.children).map(n=>n.textContent).join('\n')};
}

test('polling shows delayed command results and preserves unsaved fields',async()=>{
  const s=setup();await s.flush();
  s.field('Dirección privada').value='192.168.1.88';
  s.field('Comandos autorizados: un alias = comando por línea').value='draft = say hello';
  s.field('Contraseña RCON').value='secret draft';
  s.field('Alias para prueba').value='probe';await s.click('Ejecutar alias de prueba');
  await s.tick(); // First poll still has no execution result.
  s.setState({log:[{at:1,text:'Command rejected',alias:'probe',outcome:'rejected',response:'Unknown command <script>'}]});
  await s.tick();
  assert.match(s.text(),/Comando rechazado/);assert.match(s.text(),/Unknown command <script>/);
  assert.equal(s.field('Dirección privada').value,'192.168.1.88');
  assert.equal(s.field('Comandos autorizados: un alias = comando por línea').value,'draft = say hello');
  assert.equal(s.field('Contraseña RCON').value,'secret draft');
  assert.ok(s.requests.filter(r=>r.method==='GET').every(r=>['/minecraft','/gift-catalog'].includes(r.path)));
});

test('refresh does not overlap, retries failures and preserves action notices',async()=>{
  const s=setup();await s.flush();s.field('Alias para prueba').value='probe';await s.click('Ejecutar alias de prueba');
  const notice=s.nodes.find(n=>n.textContent==='Comando enviado a la cola.');
  s.fail(true);await s.tick();assert.equal(notice.textContent,'Comando enviado a la cola.');
  s.fail(false);s.hold();await s.tick();const count=s.requests.length;
  await s.hidden(true);await s.hidden(false);assert.equal(s.requests.length,count);
  s.release();await s.flush();assert.equal(s.timers.size,1);
  await s.tick();assert.equal(s.timers.size,1);
});

test('polling pauses when hidden or detached and resumes when visible',async()=>{
  const s=setup();await s.flush();await s.hidden(true);assert.equal(s.timers.size,0);
  const count=s.requests.length;await s.hidden(false);assert.equal(s.requests.length,count+1);
  await s.visibility(true);assert.equal(s.timers.size,0);
  await s.visibility(false);assert.equal(s.timers.size,1);
  await s.detach();assert.equal(s.timers.size,0);
  const t=setup();await t.flush();await t.pagehide();assert.equal(t.timers.size,0);
});

test('outcome labels preserve literal server responses and older log entries',async()=>{
  const s=setup();await s.flush();
  s.setState({log:[
    ...['success','rejected','connection_error','unconfirmed','cancelled'].map((outcome,i)=>({at:i,text:'detail',alias:'probe',outcome,response:'<b>literal</b>'})),
    {at:8,text:'Minecraft RCON autorizado'}]});await s.tick();
  for(const label of ['Éxito confirmado','Comando rechazado','Error de conexión','Sin confirmar','Cancelado','Minecraft RCON autorizado'])assert.ok(s.text().includes(label),label);
  assert.match(s.text(),/<b>literal<\/b>/);
});

test('child-list attachment resumes polling without a hidden-attribute mutation',async()=>{
  const s=setup();await s.flush();const count=s.requests.length;
  await s.connection(false);assert.equal(s.timers.size,0);
  await s.connection(true);assert.equal(s.requests.length,count+1);
  assert.equal(s.timers.size,1);
  // Unrelated child-list changes must not trigger another immediate refresh.
  await s.connection(true);assert.equal(s.requests.length,count+1);
});

test('slow initial hydration preserves edits and stale pre-action reads are discarded',async()=>{
  const s=setup({holdInitial:true});
  const host=s.field('Dirección privada');host.value='192.168.1.99';host.events.input();
  s.release();await s.flush();assert.equal(host.value,'192.168.1.99');
  s.hold();await s.tick();
  s.setState({authorized:false});await s.click('Desvincular mundo');
  s.release();await s.flush();
  assert.ok(s.nodes.some(n=>n.textContent==='Sin conectar'));
  assert.equal(s.timers.size,1);
  assert.equal(host.value,'192.168.1.99');
});

test('edition selector persists selection, keeps separate drafts and hides RCON credentials',async()=>{
  const s=setup();await s.flush();
  s.field('Comandos autorizados: un alias = comando por línea').value='javaDraft = list';
  s.field('Dirección privada').value='127.0.0.2';s.field('Contraseña RCON').value='secret';
  await s.edition('bedrock');
  assert.equal(s.field('Comandos autorizados: un alias = comando por línea').value,'bed = say hello');
  assert.equal(s.field('Contraseña RCON').parentElement.hidden,true);
  assert.equal(s.field('Dirección privada').parentElement.hidden,true);
  assert.equal(s.field('Contraseña RCON').value,'');
  assert.ok(s.requests.some(r=>r.path==='/minecraft'&&r.data?.edition==='bedrock'&&r.data.select_only));
  s.field('Comandos autorizados: un alias = comando por línea').value='bedDraft = say hi';
  await s.edition('java');
  assert.equal(s.field('Comandos autorizados: un alias = comando por línea').value,'javaDraft = list');
  assert.equal(s.field('Dirección privada').value,'127.0.0.2');
  await s.edition('bedrock');
  assert.equal(s.field('Comandos autorizados: un alias = comando por línea').value,'bedDraft = say hi');
  await s.click('Vincular mi mundo de Bedrock');
  assert.equal(s.nodes.find(n=>n.dataset.bedrockCommand).value,'/wsserver ws://127.0.0.1:54321/secret');
  await s.edition('java');
  assert.ok(!s.nodes.some(n=>n.textContent.includes(':54321/secret')));
});

test('pending edition selection guards every action handler, including Save',async()=>{
  const s=setup();await s.flush();s.field('Alias para prueba').value='probe';
  s.holdPost('/minecraft');const selecting=s.edition('bedrock');await s.flush();
  const count=s.requests.length;
  await s.click('Guardar y conectar');
  for(const text of ['Guardar conexión y comandos','Ejecutar alias de prueba',
                    'Vincular mi mundo de Bedrock','Desvincular mundo','Comprobar conexión sin ejecutar un alias']){
    await s.click(text);
  }
  assert.equal(s.requests.length,count,'handlers cannot bypass the shared boundary');
  s.releasePost();await selecting;
  assert.equal(s.serverEdition,'bedrock');assert.equal(s.field('Edición').value,'bedrock');
});

test('pending mode-specific actions guard edition changes in both directions',async()=>{
  for(const [mode,label,path] of [
    ['java','Guardar conexión y comandos','/minecraft'],
    ['java','Ejecutar alias de prueba','/minecraft/run'],['java','Desvincular mundo','/minecraft/disconnect'],
    ['java','Comprobar conexión sin ejecutar un alias','/minecraft/check'],
    ['bedrock','Vincular mi mundo de Bedrock','/minecraft/bedrock/prepare']]){
    const s=setup();await s.flush();if(mode==='bedrock')await s.edition('bedrock');
    s.field('Alias para prueba').value='probe';s.holdPost(path);const acting=s.click(label);await s.flush();
    const count=s.requests.length;await s.edition(mode==='java'?'bedrock':'java');
    assert.equal(s.requests.length,count,label);assert.equal(s.field('Edición').value,mode,label);
    s.releasePost();await acting;assert.equal(s.serverEdition,mode,label);
    assert.ok(!s.field('Edición').disabled,label);
  }
});

test('uncertain selection keeps controls guarded until polling confirms the actual edition',async()=>{
  const s=setup();await s.flush();s.holdPost('/minecraft');
  const selecting=s.edition('bedrock');await s.flush();
  s.fail(true);s.releasePost();await selecting;
  assert.equal(s.serverEdition,'bedrock');assert.ok(s.field('Edición').disabled);
  const count=s.requests.length;await s.click('Guardar conexión y comandos');
  assert.equal(s.requests.length,count);
  s.fail(false);await s.tick();
  assert.equal(s.field('Edición').value,'bedrock');assert.equal(s.field('Edición').disabled,false);
  assert.equal(s.field('Contraseña RCON').parentElement.hidden,true);
  assert.ok(s.nodes.filter(n=>n.tagName==='button'&&!n.dataset.addAction).every(n=>!n.disabled));
});

test('quick-action rows use stable gifts and derive activation from assigned IDs',async()=>{
  const s=setup({initialPresets:{tnt_rain:{gift_id:'1',gift_name:'Rose',enabled:false}}});await s.flush();
  assert.equal(s.nodes.filter(n=>n.dataset.quickAction&&n.isConnected).length,1);
  const gift=s.preset('tnt_rain','gift'),enabled=s.preset('tnt_rain','enabled');
  assert.ok(gift['aria-label'].includes('Lluvia de TNT'));assert.equal(enabled.tagName,'span');assert.equal(enabled.textContent,'Activa');assert.equal(enabled['aria-label'],'Lluvia de TNT: activa porque tiene un regalo asignado');
  assert.equal(s.nodes.find(n=>n.className==='minecraft-action-columns').children[3].textContent,'Estado');
  assert.ok(!s.nodes.some(n=>n.dataset.presetEnabled&&n.type==='checkbox'),'preset activation has no independent checkbox');
  gift.value='1';await gift.events.change();await s.flush();
  const saved=s.requests.filter(r=>r.path==='/minecraft/presets').at(-1).data;
  assert.equal(saved.presets.tnt_rain.gift_id,'1');assert.equal(saved.presets.tnt_rain.enabled,true);
  assert.ok(!JSON.stringify(saved).includes('summon'));
  s.catalog([]);await s.click('Actualizar regalos');
  assert.ok(gift.children.some(o=>o.value==='1'&&o.textContent.includes('guardado')));
  await s.edition('bedrock');assert.equal(s.nodes.filter(n=>n.dataset.quickAction==='tnt_rain'&&n.isConnected).length,0);
  await s.edition('java');assert.equal(enabled.textContent,'Activa');assert.equal(gift.value,'1');
  await s.tick();assert.equal(enabled.textContent,'Activa');
});

test('action state explains missing gifts and derives activation without losing preset data',async()=>{
  const s=setup();await s.flush();await s.addAction('tnt_rain');
  const gift=s.preset('tnt_rain','gift'),quantity=s.nodes.find(n=>n.dataset.presetQuantity==='tnt_rain');
  const prompt=s.preset('tnt_rain','enabled');
  assert.equal(prompt.tagName,'span');assert.equal(prompt.textContent,'Selecciona un regalo');
  assert.equal(prompt.disabled,undefined,'the explanatory prompt is not a blocked action');
  quantity.value='4';quantity.events.input();await quantity.events.change();await s.flush();
  gift.value='1';await gift.events.change();await s.flush();
  const toggle=s.preset('tnt_rain','enabled');
  assert.equal(toggle.tagName,'span');assert.equal(toggle.textContent,'Activa','a newly added action is active after it receives a gift');
  let saved=s.requests.filter(r=>r.path==='/minecraft/presets').at(-1).data.presets.tnt_rain;
  assert.deepEqual({gift_id:saved.gift_id,enabled:saved.enabled,quantity:saved.quantity},{gift_id:'1',enabled:true,quantity:4});
  assert.ok(!s.nodes.some(n=>n.dataset.presetEnabled&&n.type==='checkbox'));
});

test('added actions keep their enabled choice through a stale save response and refresh',async()=>{
  const s=setup();await s.flush();await s.addAction('zombie');
  const gift=s.preset('zombie','gift');gift.value='1';await gift.events.change();await s.flush();
  const enabled=s.preset('zombie','enabled');s.staleNextPresetResponse();s.hold();
  gift.value='2';const saving=gift.events.change();await s.flush();
  assert.equal(enabled.textContent,'Activa','the save response must not undo assignment-derived activation');
  s.release();await saving;await s.flush();
  assert.equal(enabled.textContent,'Activa','the subsequent refresh keeps assignment-derived activation');
});

test('quick-action controls use assignment status and icon-only test/remove buttons',async()=>{
  const s=setup();await s.flush();await s.addAction('tnt_rain');
  const gift=s.preset('tnt_rain','gift');gift.value='1';await gift.events.change();await s.flush();
  const checkbox=s.preset('tnt_rain','enabled');
  const testButton=s.nodes.find(n=>n.tagName==='button'&&n.className==='minecraft-action-test');
  const removeButton=s.nodes.find(n=>n.tagName==='button'&&n.className==='minecraft-action-remove');
  assert.equal(checkbox.tagName,'span');assert.equal(checkbox.parentElement.className,'minecraft-action-enabled');assert.equal(checkbox.textContent,'Activa');assert.equal(checkbox['aria-label'],'Lluvia de TNT: activa porque tiene un regalo asignado');
  assert.ok(testButton);assert.equal(testButton.textContent,'');assert.equal(testButton.children.length,1);assert.equal(testButton.children[0].tagName,'svg');assert.match(testButton.children[0].children[0].attributes.d,/^M8 5v14l11-7z$/);assert.equal(testButton['aria-label'],'Probar acción: Lluvia de TNT');assert.equal(testButton.title,'Probar acción: Lluvia de TNT');
  assert.ok(removeButton);assert.equal(removeButton.textContent,'');assert.equal(removeButton.children.length,1);assert.equal(removeButton.children[0].tagName,'svg');assert.match(removeButton.children[0].children[0].attributes.d,/M4 7h16/);assert.equal(removeButton['aria-label'],'Quitar acción: Lluvia de TNT');assert.equal(removeButton.title,'Quitar acción: Lluvia de TNT');
  assert.ok(!s.requests.some(r=>r.path==='/minecraft/presets/simulate'));
});

test('preset saves share the operation boundary and uncertain saves reconcile actual state',async()=>{
  const s=setup({initialPresets:{tnt_rain:{gift_id:'1',gift_name:'Rose',enabled:false}}});await s.flush();const gift=s.preset('tnt_rain','gift');
  gift.value='1';s.holdPost('/minecraft/presets');const saving=gift.events.change();await s.flush();
  const count=s.requests.length;await s.edition('bedrock');assert.equal(s.serverEdition,'java');
  await s.click('Probar acción: Lluvia de TNT');assert.equal(s.requests.length,count);
  s.fail(true);s.releasePost();await saving;await s.flush();
  assert.ok(s.field('Edición').disabled);s.fail(false);await s.tick();
  assert.equal(gift.value,'1');assert.equal(s.field('Edición').disabled,false);
  await s.click('Probar acción: Lluvia de TNT');await s.click('Pausar cola');
  assert.ok(s.requests.some(r=>r.path==='/minecraft/presets/test'&&r.data.id==='tnt_rain'));
  assert.ok(s.requests.some(r=>r.path==='/minecraft/presets/stop'));
});

test('action picker remains available and selected actions survive unavailable or old APIs',async()=>{
  for(const options of [{holdInitial:true},{failInitial:true},{oldBackend:true}]){
    const s=setup(options);
    assert.equal(s.nodes.filter(n=>n.dataset.quickAction&&n.isConnected).length,0);
    assert.ok(s.nodes.some(n=>n.textContent==='Acciones predeterminadas'));
    assert.equal(s.nodes.find(n=>n.dataset.actionPicker).children.length,97);
    if(options.holdInitial){s.release();await s.flush();await s.addAction('tnt_rain');}
    else if(options.failInitial){assert.equal(s.nodes.find(n=>n.dataset.actionPicker).disabled,true);}
    else if(options.oldBackend)assert.equal(s.nodes.find(n=>n.dataset.actionPicker).disabled,true);
    else await s.addAction('tnt_rain');
    assert.equal(s.nodes.filter(n=>n.dataset.quickAction&&n.isConnected).length,options.failInitial||options.oldBackend?0:1,JSON.stringify(options));
    assert.ok(!s.nodes.some(n=>n.textContent.includes('Escribe AUTORIZAR')));
    assert.ok(!s.nodes.some(n=>n.tagName==='button'&&n.textContent.startsWith('Autorizar y probar')));
    for(const summary of ['Ritmo y cola']){
      const node=s.nodes.find(n=>n.tagName==='summary'&&n.textContent===summary);
      assert.ok(node);assert.ok(!node.parentElement.open);
    }
    assert.equal(s.nodes.some(n=>n.tagName==='summary'&&n.textContent==='Ayuda'),false);
  }
});

test('Java saves and connects without an authorization checkbox',async()=>{
  const s=setup();await s.flush();
  s.setState({effect_queue:{connection_ready:true}});await s.tick();
  assert.ok(!s.nodes.some(n=>n.tagName==='label'&&n.textContent==='Autorizar Minecraft'));
  const check=s.nodes.find(n=>n.tagName==='button'&&n.textContent==='Comprobar conexión');
  assert.ok(check&&!check.hidden,'Java keeps the manual connection check available');
  const unlink=s.nodes.find(n=>n.tagName==='button'&&n.textContent==='Desvincular mundo');
  assert.ok(unlink&&!unlink.hidden,'Java exposes unlink for the authorized connection in the snapshot');
  await s.click('Guardar y conectar');
  const posts=s.requests.filter(r=>r.method==='POST');
  assert.equal(posts.at(-2).path,'/minecraft');
  assert.deepEqual(posts.at(-1).data,{edition:'java',enabled:true});
  s.holdPost('/minecraft/authorize');const connecting=s.click('Guardar y conectar');await s.flush();
  const count=s.requests.length;await s.edition('bedrock');assert.equal(s.requests.length,count);
  s.fail(true);s.releasePost();await connecting;assert.ok(s.field('Edición').disabled);
  s.fail(false);await s.tick();assert.equal(s.field('Edición').disabled,false);
});

test('Bedrock verifies automatically and reports pending, failed and ready states',async()=>{
  const s=setup({initialEdition:'bedrock'});await s.flush();
  assert.ok(!s.nodes.some(n=>n.tagName==='label'&&n.textContent==='Autorizar Minecraft'));
  const check=s.nodes.find(n=>n.tagName==='button'&&n.textContent==='Comprobar conexión');
  const unlink=s.nodes.find(n=>n.tagName==='button'&&n.textContent==='Desvincular mundo');
  assert.ok(check?.hidden,'Bedrock hides the manual connection check');
  assert.ok(unlink?.hidden,'initial Bedrock state has nothing to unlink');
  s.holdNextRead();await s.click('Vincular mi mundo de Bedrock');
  assert.equal(unlink.hidden,false,'unlink becomes available as soon as the link is prepared');
  assert.ok(s.nodes.some(n=>n.textContent==='Enlace listo para pegar en el chat de tu mundo.'));
  s.setState({bedrock:{prepared:true,connected:false}});s.releaseNextRead();await s.flush();
  assert.equal(unlink.hidden,false,'the prepared snapshot keeps unlink available after refresh');
  assert.ok(!s.nodes.some(n=>n.textContent.includes('Prepara la conexión. TikReader comprobará si tu mundo responde.')));
  assert.ok(!s.nodes.some(n=>n.textContent.includes('Abre el chat de tu mundo, pega el comando y presiona Enter.')));
  assert.ok(s.nodes.some(n=>n.textContent.includes('Mundo local de Windows')));
  s.setState({authorized:false,bedrock:{prepared:true,connected:true},connection_check:'checking'});await s.tick();
  assert.ok(s.nodes.some(n=>n.textContent==='Comprobando conexión…'));
  s.setState({connection_check:'failed'});await s.tick();
  assert.ok(s.nodes.some(n=>n.textContent.includes('No se pudo comprobar Bedrock. Desvincula el mundo, vincula uno nuevo')));
  s.setState({authorized:true,connection_check:'ready',effect_queue:{connection_ready:true}});await s.tick();
  assert.ok(s.nodes.some(n=>n.textContent==='Conectado'));
  assert.ok(!s.requests.some(r=>r.path==='/minecraft/authorize'));
  await s.click('Desvincular mundo');
  assert.ok(s.nodes.some(n=>n.textContent==='Mundo desvinculado.'));
});

test('Bedrock preparation stays available when preset metadata is unavailable',async()=>{
  const s=setup({initialEdition:'bedrock',oldBackend:true});await s.flush();
  const prepare=s.nodes.find(n=>n.tagName==='button'&&n['aria-label']==='Vincular mi mundo de Bedrock');
  assert.ok(prepare);
  assert.equal(prepare.textContent,'Vincular mi mundo');
  assert.equal(prepare.disabled,false);
  await s.click('Vincular mi mundo de Bedrock');
  assert.ok(s.requests.some(r=>r.path==='/minecraft/bedrock/prepare'&&r.method==='POST'));
});

test('Bedrock connection command has readable copy and keeps technical requirements',async()=>{
  const s=setup();await s.flush();await s.edition('bedrock');
  await s.click('Copiar comando de conexión');
  assert.ok(s.nodes.some(n=>n.textContent==='Vincula tu mundo primero.'));
  await s.click('Vincular mi mundo de Bedrock');
  const copy=s.nodes.find(n=>n.tagName==='button'&&n['aria-label']==='Copiar comando de conexión');
  assert.ok(copy);
  assert.equal(copy.textContent,'');
  assert.equal(copy.title,'Copiar el comando de conexión');
  assert.ok(!s.nodes.some(n=>n.textContent==='Prepara la conexión. TikReader comprobará si tu mundo responde.'));
  assert.ok(!s.nodes.some(n=>n.textContent==='Abre el chat de tu mundo, pega el comando y presiona Enter.'));
  assert.ok(s.nodes.some(n=>n.textContent.includes('Mundo local de Windows')));
  const command=s.nodes.find(n=>n.dataset.bedrockCommand);
  assert.equal(command.tagName,'input');assert.equal(command.type,'text');
  assert.equal(command.value,'/wsserver ws://127.0.0.1:54321/secret');assert.equal(command.readOnly,true);
  await s.click('Copiar comando de conexión');assert.deepEqual(s.clipboard,['/wsserver ws://127.0.0.1:54321/secret']);
  assert.ok(s.nodes.some(n=>n.textContent==='Comando copiado.'));
});

test('clipboard denial selects the exact command and gives a usable fallback',async()=>{
  const s=setup({initialEdition:'bedrock',clipboardError:true});await s.flush();await s.click('Vincular mi mundo de Bedrock');
  const command=s.nodes.find(n=>n.dataset.bedrockCommand);await s.click('Copiar comando de conexión');
  assert.equal(command.selected,true);assert.ok(s.nodes.some(n=>n.textContent==='Selecciona el comando y usa copiar para llevarlo al chat.'));
});

test('empty action picker adds multiple allowed rows once and persists selection per edition',async()=>{
  const storage=new Map(),s=setup({storage});await s.flush();
  assert.equal(s.nodes.filter(n=>n.dataset.quickAction&&n.isConnected).length,0);
  await s.addAction('zombie');await s.addAction('cow');await s.addAction('zombie');
  assert.deepEqual(s.nodes.filter(n=>n.dataset.quickAction&&n.isConnected).map(n=>n.dataset.quickAction),['zombie','cow']);
  await s.edition('bedrock');await s.addAction('pig');
  await s.edition('java');assert.deepEqual(s.nodes.filter(n=>n.dataset.quickAction&&n.isConnected).map(n=>n.dataset.quickAction),['zombie','cow']);
  const reloaded=setup({storage});await reloaded.flush();
  assert.deepEqual(reloaded.nodes.filter(n=>n.dataset.quickAction&&n.isConnected).map(n=>n.dataset.quickAction),['zombie','cow']);
  await reloaded.edition('bedrock');assert.deepEqual(reloaded.nodes.filter(n=>n.dataset.quickAction&&n.isConnected).map(n=>n.dataset.quickAction),['pig']);
});

test('action search exposes bounded accessible suggestions with aliases and accent-insensitive matching',async()=>{
  const s=setup();await s.flush();const search=s.actionSearch();
  assert.equal(search.role,'combobox');assert.equal(search.getAttribute('aria-autocomplete'),'list');
  assert.equal(search.getAttribute('aria-controls'),'minecraft-action-options');
  search.events.focus();
  const list=s.nodes.find(n=>n.id==='minecraft-action-options');
  assert.equal(list.getAttribute('role'),'listbox');assert.equal(search.getAttribute('aria-expanded'),'true');
  assert.ok(s.actionOptions().length<=8,'suggestions stay bounded');
  search.value='dar diamantes';await search.events.input();
  assert.deepEqual(s.actionOptions().map(option=>option.dataset.actionOption),['diamonds']);
  const diamonds=s.actionOption('diamonds');assert.equal(diamonds.getAttribute('role'),'option');
  assert.match(diamonds.textContent,/Diamantes/);assert.match(diamonds.textContent,/Objetos/);assert.match(diamonds.textContent,/5 diamantes/);
  search.value='curacion';await search.events.input();
  assert.deepEqual(s.actionOptions().map(option=>option.dataset.actionOption),['heal']);
  search.value='tnt';await search.events.input();
  assert.deepEqual(s.actionOptions().map(option=>option.dataset.actionOption),['tnt_rain']);
});

test('action search supports keyboard choice and keeps adding explicit',async()=>{
  const s=setup();await s.flush();const search=s.actionSearch();search.focus();search.events.focus();search.value='diamantes';await search.events.input();
  const down={key:'ArrowDown',preventDefault(){this.prevented=true;}};search.events.keydown(down);
  assert.equal(down.prevented,true);assert.equal(search.getAttribute('aria-activedescendant'),s.actionOption('diamonds').id);assert.equal(s.actionOption('diamonds').getAttribute('aria-selected'),'true');
  const up={key:'ArrowUp',preventDefault(){this.prevented=true;}};search.events.keydown(up);
  assert.equal(up.prevented,true);assert.equal(search.getAttribute('aria-activedescendant'),s.actionOptions().at(-1).id,'ArrowUp starts at the last suggestion');
  search.events.keydown(down);assert.equal(search.getAttribute('aria-activedescendant'),s.actionOption('diamonds').id);
  const enter={key:'Enter',preventDefault(){this.prevented=true;}};await search.events.keydown(enter);
  assert.equal(enter.prevented,true);assert.equal(s.nodes.find(n=>n.dataset.actionPicker).value,'diamonds');
  assert.equal(s.nodes.find(n=>n.dataset.addAction).disabled,false,'the explicit add action remains available');
  assert.equal(s.requests.some(request=>request.path==='/minecraft/presets'&&request.method==='POST'),false,'choosing does not add the action');
  search.events.focus();const escape={key:'Escape',preventDefault(){this.prevented=true;}};search.events.keydown(escape);
  assert.equal(escape.prevented,true);assert.equal(search.getAttribute('aria-expanded'),'false');
  await s.nodes.find(n=>n.dataset.addAction).onclick();await s.flush();
  assert.ok(s.preset('diamonds','gift'),'only the explicit add button adds the selected action');
});

test('pointer selection survives the browser blur-before-click sequence',async()=>{
  const s=setup();await s.flush();const search=s.actionSearch();search.focus();search.events.focus();search.value='diamantes';await search.events.input();
  const option=s.actionOption('diamonds'),list=s.nodes.find(n=>n.id==='minecraft-action-options');
  const pointerdown={preventDefault(){this.prevented=true;}};option.events.pointerdown?.(pointerdown);
  if(!pointerdown.prevented)search.events.blur();
  if(!list.hidden)option.events.click();
  assert.equal(s.nodes.find(n=>n.dataset.actionPicker).value,'diamonds','the option click selects even when browsers blur before click');
});

test('polling preserves the highlighted action before Enter chooses it',async()=>{
  const s=setup();await s.flush();const search=s.actionSearch();search.focus();search.events.focus();
  const down={key:'ArrowDown',preventDefault(){this.prevented=true;}};search.events.keydown(down);search.events.keydown(down);
  const intended=s.actionOptions()[1].dataset.actionOption,activeId=s.actionOptions()[1].id;
  assert.equal(search.getAttribute('aria-activedescendant'),activeId);
  await s.tick();
  assert.equal(search.getAttribute('aria-activedescendant'),activeId,'refresh retains the active option identity');
  const enter={key:'Enter',preventDefault(){this.prevented=true;}};search.events.keydown(enter);
  assert.equal(s.nodes.find(n=>n.dataset.actionPicker).value,intended,'Enter chooses the highlighted option after refresh');
});

test('Todos initially lists every added action and counts disabled or unconfigured rows',async()=>{
  const storage=new Map([['tikreader.minecraft.actions.v1.java',JSON.stringify(['zombie','cow','ghast','warden','diamonds'])]]);
  const s=setup({storage,initialPresets:{zombie:{gift_id:'',gift_name:'',enabled:false}}});await s.flush();
  assert.deepEqual(s.actionRows().map(row=>row.dataset.quickAction),['zombie','cow','ghast','warden','diamonds']);
  assert.ok(s.actionRows().every(row=>!row.hidden),'Todos starts with each added action visible');
  assert.match(s.actionFilter('all').textContent,/5/);assert.match(s.actionFilter('mobs').textContent,/4/);assert.match(s.actionFilter('items').textContent,/1/);
  assert.equal(s.actionFilter('all').getAttribute('aria-pressed'),'true');
  assert.match(s.actionRow('zombie').children[0].children.find(node=>node.className==='minecraft-action-context').textContent,/Mobs · No-muertos/);
});

test('section filters change only row visibility and do not mutate presets',async()=>{
  const storage=new Map([['tikreader.minecraft.actions.v1.java',JSON.stringify(['zombie','cow','diamonds'])]]);
  const s=setup({storage,initialPresets:{zombie:{gift_id:'1',gift_name:'Rose',enabled:false}}});await s.flush();
  const before=s.profilesSnapshot,posts=s.requests.filter(request=>request.method==='POST').length;
  s.actionFilter('items').onclick();
  assert.equal(s.actionRow('diamonds').hidden,false);assert.equal(s.actionRow('zombie').hidden,true);assert.equal(s.actionRow('cow').hidden,true);
  assert.equal(s.actionFilter('items').getAttribute('aria-pressed'),'true');
  s.actionFilter('all').onclick();assert.ok(s.actionRows().every(row=>!row.hidden));
  assert.equal(s.profilesSnapshot,before);assert.equal(s.requests.filter(request=>request.method==='POST').length,posts);
});

test('Mob filter uses one grouped selector with only populated categories',async()=>{
  const storage=new Map([['tikreader.minecraft.actions.v1.java',JSON.stringify(['zombie','cow','ghast','warden','diamonds'])]]),s=setup({storage});await s.flush();
  s.actionFilter('mobs').onclick();const selector=s.actionCategory();
  assert.equal(selector.tagName,'select');assert.equal(selector.role,'combobox');assert.equal(selector.getAttribute('aria-label'),'Filtrar mobs por categoría');assert.equal(selector.hidden,false);
  const groups=selector.children.filter(node=>node.tagName==='optgroup');assert.deepEqual(groups.map(group=>group.label),['Superficie','Dimensiones','Encuentros']);
  const options=selector.children.flatMap(node=>node.tagName==='optgroup'?node.children:[node]).filter(node=>node.tagName==='option');assert.deepEqual(options.map(option=>option.value),['all','animals','undead','nether','bosses']);
  assert.equal(options[0].textContent,'Todas las categorías');
  for(const [value,label] of [['animals','Animales · 1'],['undead','No-muertos · 1'],['nether','Nether · 1'],['bosses','Jefes · 1']])assert.equal(options.find(option=>option.value===value).textContent,label);
  const posts=s.requests.filter(request=>request.method==='POST').length;selector.value='undead';selector.events.change();
  assert.equal(s.actionRow('zombie').hidden,false);assert.equal(s.actionRow('cow').hidden,true);assert.equal(s.actionRow('ghast').hidden,true);assert.equal(s.actionRow('diamonds').hidden,true);
  assert.equal(s.requests.filter(request=>request.method==='POST').length,posts);
});

test('adding and removing actions keeps Todos, Mob counts, editions, and polling coherent',async()=>{
  const storage=new Map([['tikreader.minecraft.actions.v1.java',JSON.stringify(['zombie'])],['tikreader.minecraft.actions.v1.bedrock',JSON.stringify(['cow'])]]);
  const s=setup({storage});await s.flush();s.actionFilter('items').onclick();await s.addAction('cow');
  assert.equal(s.actionFilter('all').getAttribute('aria-pressed'),'true');assert.equal(s.actionRow('cow').hidden,false);assert.equal(s.actionRow('zombie').hidden,false);
  s.actionFilter('mobs').onclick();const selector=s.actionCategory();selector.value='undead';selector.events.change();
  await s.tick();assert.equal(s.actionFilter('mobs').getAttribute('aria-pressed'),'true');assert.equal(s.actionRow('zombie').hidden,false);
  await s.actionRow('zombie').children.at(-1).onclick();
  assert.equal(selector.value,'all','removing the final selected-category row falls back to all categories');
  assert.equal(s.actionRow('cow').hidden,false);assert.match(s.actionFilter('mobs').textContent,/1/);
  await s.edition('bedrock');assert.equal(s.actionFilter('mobs').getAttribute('aria-pressed'),'true');assert.equal(s.actionRow('cow').hidden,false);
});

test('top action filters support arrow-key navigation and activation',async()=>{
  const s=setup();await s.flush();const all=s.actionFilter('all');all.focus();
  const right={key:'ArrowRight',preventDefault(){this.prevented=true;}};all.events.keydown(right);
  assert.equal(right.prevented,true);assert.equal(s.activeElement,s.actionFilter('environment'));
  assert.equal(s.actionFilter('environment').getAttribute('aria-pressed'),'true');
});

test('adding a mob action returns to Todos and shows its section context',async()=>{
  const s=setup();await s.flush();await s.addAction('cow');
  assert.equal(s.actionFilter('all').getAttribute('aria-pressed'),'true');
  assert.equal(s.actionRow('cow').hidden,false);
  assert.match(s.actionRow('cow').children[0].children.find(node=>node.className==='minecraft-action-context').textContent,/Mobs · Animales/);
});

test('configured disabled mappings migrate into the picker and empty explicit selection stays empty',async()=>{
  const s=setup({initialPresets:{cow:{gift_id:'1',gift_name:'Rose',enabled:false},pig:{gift_id:'',gift_name:'',enabled:false}}});await s.flush();
  assert.deepEqual(s.nodes.filter(n=>n.dataset.quickAction&&n.isConnected).map(n=>n.dataset.quickAction),['cow']);
  assert.equal(s.preset('cow','enabled').tagName,'span');assert.equal(s.preset('cow','enabled').textContent,'Activa');
});

test('explicit empty selection does not restore retained mappings and storage failures stay usable',async()=>{
  const storage=new Map([['tikreader.minecraft.actions.v1.java','[]']]);
  const empty=setup({storage,initialPresets:{cow:{gift_id:'1',gift_name:'Rose',enabled:false}}});await empty.flush();
  assert.equal(empty.nodes.filter(n=>n.dataset.quickAction&&n.isConnected).length,0);
  const unavailable=setup({storageReadError:true,storageWriteError:true});await unavailable.flush();await unavailable.addAction('zombie');
  assert.equal(unavailable.nodes.filter(n=>n.dataset.quickAction&&n.isConnected).length,1);
});

test('malformed, non-array, and wholly invalid selections fall back to configured actions',async()=>{
  for(const saved of ['{broken','{}','["retired-action"]']){
    const storage=new Map([['tikreader.minecraft.actions.v1.java',saved]]);
    const s=setup({storage,initialPresets:{cow:{gift_id:'1',gift_name:'Rose',enabled:false}}});await s.flush();
    assert.deepEqual(s.nodes.filter(n=>n.dataset.quickAction&&n.isConnected).map(n=>n.dataset.quickAction),['cow'],saved);
  }
});

test('partially valid saved selections keep allowed IDs and reveal newly active mappings once',async()=>{
  const storage=new Map([['tikreader.minecraft.actions.v1.java','["zombie","retired-action"]']]);
  const s=setup({storage,initialPresets:{cow:{gift_id:'1',gift_name:'Rose',enabled:true},pig:{gift_id:'2',gift_name:'Tulip',enabled:false}}});await s.flush();
  assert.deepEqual(s.nodes.filter(n=>n.dataset.quickAction&&n.isConnected).map(n=>n.dataset.quickAction),['zombie','cow']);
});

test('Todos empty state clears when the first action row is added',async()=>{
  const s=setup();await s.flush();
  const empty=s.nodes.find(n=>n.dataset.actionEmpty);
  assert.equal(empty.hidden,false);
  await s.addAction('cow');
  assert.equal(empty.hidden,true);
});

test('removing an assigned action clears its saved gift first and keeps it on failure',async()=>{
  const s=setup({initialPresets:{zombie:{gift_id:'1',gift_name:'Rose',enabled:true}}});await s.flush();
  const remove=s.nodes.find(n=>n.tagName==='button'&&n.dataset.removeAction==='zombie');assert.ok(remove);
  s.fail(true);await remove.onclick();await s.flush();
  assert.ok(s.preset('zombie','enabled'));assert.equal(s.preset('zombie','enabled').tagName,'span');assert.equal(s.preset('zombie','enabled').textContent,'Activa');
  const attempted=s.requests.filter(r=>r.path==='/minecraft/presets').at(-1).data;
  assert.equal(attempted.presets.zombie.enabled,false);assert.equal(attempted.presets.zombie.gift_id,'');
  s.fail(false);await s.tick();await s.click('Quitar acción: Zombi');await s.flush();
  const clears=s.requests.filter(r=>r.path==='/minecraft/presets');assert.ok(clears.length>=1);
  assert.equal(clears.at(-1).data.presets.zombie.gift_id,'');
  assert.equal(s.nodes.filter(n=>n.dataset.quickAction==='zombie'&&n.isConnected).length,0);
  await s.tick();assert.equal(s.nodes.filter(n=>n.dataset.quickAction==='zombie'&&n.isConnected).length,0);
});

test('unchanged catalog polls do not allocate or replace gift options, while manual refresh updates them',async()=>{
  const s=setup();s.catalog(Array.from({length:240},(_,i)=>({id:String(i+1),name:`Gift ${i+1}`,diamonds:i+1})));await s.flush();
  await s.addAction('zombie');const gift=s.preset('zombie','gift');
  const optionCount=()=>s.nodes.filter(n=>n.tagName==='option').length;
  const initialCount=optionCount(),replaceCount=gift.replaceCount;
  await s.tick();
  assert.equal(optionCount(),initialCount);assert.equal(gift.replaceCount,replaceCount);
  s.catalog([{id:'new',name:'Newest Gift',diamonds:999}]);await s.click('Actualizar regalos');
  assert.ok(gift.children.some(option=>option.value==='new'));
  assert.ok(!s.nodes.some(n=>n.tagName==='label'&&n.textContent.startsWith('Regalo para simular')));
});

test('Bedrock command stays hidden until prepared and clears on reprepare and disconnect',async()=>{
  const s=setup({initialEdition:'bedrock'});await s.flush();
  const command=s.nodes.find(n=>n.dataset.bedrockCommand),row=command.parentElement;assert.ok(command.hidden);assert.ok(row.hidden);
  await s.click('Vincular mi mundo de Bedrock');assert.equal(command.hidden,false);
  assert.equal(row.hidden,false);
  await s.click('Vincular mi mundo de Bedrock');assert.equal(command.hidden,false);assert.equal(command.value,'/wsserver ws://127.0.0.1:54321/secret');
  await s.click('Vincular mi mundo de Bedrock');await s.click('Desvincular mundo');
  assert.equal(command.hidden,true);assert.equal(command.value,'');
});
test('gift-wide simulator is removed while safety settings retain their drafts',async()=>{
  const s=setup();await s.flush();await s.addAction('zombie');
 const objects=s.field('Objetos por periodo');objects.value='7';await objects.events.input();
  await s.tick();assert.equal(objects.value,'7');
  await s.click('Guardar ritmo');
  const saved=s.requests.find(r=>r.path==='/minecraft/presets/settings').data;
  assert.deepEqual(saved.limits,{objects:7,period_seconds:30});
  assert.ok(!s.nodes.some(n=>n.textContent==='Herramientas de prueba'));
  assert.ok(!s.nodes.some(n=>n.textContent==='Probar regalo completo'));
  assert.ok(!s.requests.some(r=>r.path==='/minecraft/presets/simulate'));
 });

test('queue pacing settings keep edition drafts and reconcile uncertain saves without granting execution',async()=>{
 const s=setup();await s.flush();const objects=s.field('Objetos por periodo');
 objects.value='8';objects.events.input();await s.edition('bedrock');assert.equal(Number(objects.value),20);
 objects.value='9';objects.events.input();await s.edition('java');assert.equal(Number(objects.value),8);
 s.holdPost('/minecraft/presets/settings');const saving=s.click('Guardar ritmo');await s.flush();
 const count=s.requests.length;await s.click('Desvincular mundo');await s.edition('bedrock');assert.equal(s.requests.length,count);
 s.fail(true);s.releasePost();await saving;assert.ok(s.field('Edición').disabled);
 s.fail(false);await s.tick();assert.equal(Number(objects.value),8);assert.equal(s.field('Edición').disabled,false);
 s.catalog([]);await s.click('Actualizar regalos');await s.addAction('zombie');
 const gift=s.preset('zombie','gift');gift.value='saved';await gift.events.change();
 assert.ok(gift.children.some(o=>o.value==='saved'&&o.textContent.includes('guardado')));
 assert.ok(!s.nodes.some(n=>n.tagName==='label'&&n.textContent.startsWith('Regalo para simular')));
});

test('Minecraft gift picker searches by name and keeps filtered keyboard selection accessible',async()=>{
  const s=setup();s.catalog([{id:'5655',name:'Rose'},{id:'7',name:'Rose Bouquet'},{id:'8',name:'Finger Heart'}]);await s.flush();await s.click('Actualizar regalos');await s.addAction('zombie');
  const row=s.preset('zombie','gift').parentElement,trigger=row.children.find(n=>n.className==='minecraft-gift-trigger');
  const menu=row.children.find(n=>n.className==='minecraft-gift-options');assert.ok(menu);
  const search=s.nodes.find(n=>n.dataset.giftSearch==='zombie');assert.ok(search,'gift search input is rendered');
  assert.equal(search.parentElement,menu,'search input lives inside the gift selection menu');assert.equal(search.getAttribute('aria-label'),'Buscar regalos para Zombi');
  const list=menu.children.find(n=>n.role==='listbox'),results=menu.children.find(n=>n.dataset.giftResults==='zombie');assert.ok(list);assert.ok(results);
  trigger.onclick();assert.equal(s.activeElement,search,'opening the picker focuses its search field');
  search.value='rOsE';search.events.input();
  assert.deepEqual(list.children.map(option=>option.title),['Rose','Rose Bouquet']);
  list.children[0].events.click();await s.flush();
  const saved=s.requests.filter(request=>request.path==='/minecraft/presets').at(-1).data.presets.zombie;
  assert.equal(saved.gift_id,'5655');assert.equal(saved.gift_name,'Rose');
  trigger.onclick();search.value='';search.events.input();assert.equal(list.children.length,4,'clearing restores the catalog and empty-selection option');
  search.value='no matching gift';search.events.input();
  assert.equal(list.children.length,0,'no-match state contains no selectable option');assert.equal(results.getAttribute('role'),'status');assert.equal(results.getAttribute('aria-live'),'polite');assert.match(results.textContent,/No hay regalos/i);
  search.value='';search.events.input();
  const down={key:'ArrowDown',preventDefault(){this.prevented=true;}};search.events.keydown(down);assert.equal(down.prevented,true);assert.equal(s.activeElement,list.children[0]);
  const up={key:'ArrowUp',preventDefault(){this.prevented=true;}};list.children[0].events.keydown(up);assert.equal(up.prevented,true);assert.equal(s.activeElement,search);
  const escape={key:'Escape',preventDefault(){this.prevented=true;}};search.events.keydown(escape);assert.equal(escape.prevented,true);assert.equal(menu.hidden,true);assert.equal(s.activeElement,trigger);
});

test('spawn quantities are visible, autosave per edition and preserve typing during polling',async()=>{
 const s=setup();await s.flush();await s.addAction('zombie');
 assert.equal(s.nodes.filter(n=>n.dataset.quickAction&&n.isConnected).length,1);
 const quantity=s.nodes.find(n=>n.dataset.presetQuantity==='zombie');assert.ok(quantity);
 assert.equal(Number(quantity.value),1);assert.equal(quantity['aria-label'],'Cantidad de Zombi');
 quantity.value='2';quantity.events.input();await s.tick();assert.equal(quantity.value,'2');
 await quantity.events.change();await s.flush();
 assert.equal(s.requests.filter(r=>r.path==='/minecraft/presets').at(-1).data.presets.zombie.quantity,2);
 const gift=s.preset('zombie','gift');gift.value='1';await gift.events.change();
 assert.equal(s.requests.filter(r=>r.path==='/minecraft/presets').at(-1).data.presets.zombie.quantity,2);
 await s.edition('bedrock');await s.addAction('zombie');assert.equal(Number(quantity.value),1);
 await s.edition('java');assert.equal(Number(quantity.value),2);
 assert.ok(!s.nodes.some(n=>n.dataset.presetQuantity==='rain'));
});

test('old quantity capability blocks mutation and uncertain quantity saves recover actual numbers',async()=>{
 const old=setup({oldQuantities:true});await old.flush();
 assert.equal(old.nodes.filter(n=>n.dataset.quickAction&&n.isConnected).length,0);
 assert.ok(old.nodes.find(n=>n.dataset.actionPicker).disabled);
 const s=setup({initialPresets:{pig:{gift_id:'1',gift_name:'Rose',enabled:false}}});await s.flush();const quantity=s.nodes.find(n=>n.dataset.presetQuantity==='pig');
 quantity.value='4';quantity.events.input();s.holdPost('/minecraft/presets');const saving=quantity.events.change();await s.flush();
 const count=s.requests.length;await s.edition('bedrock');assert.equal(s.requests.length,count);
 s.fail(true);s.releasePost();await saving;await s.flush();assert.ok(quantity.disabled);
 s.fail(false);await s.tick();assert.equal(Number(quantity.value),4);assert.equal(quantity.disabled,false);
});

test('Todos filters exist before GET and default to one unified list after hydration',async()=>{
 const s=setup({holdInitial:true});
 assert.equal(s.nodes.filter(n=>n.dataset.quickAction&&n.isConnected).length,0);
 assert.equal(s.actionFilters().length,5);
 assert.equal(s.nodes.filter(n=>n.role==='tab').length,0);
 assert.equal(s.actionFilter('all').getAttribute('aria-pressed'),'true');
 s.release();await s.flush();
 assert.equal(s.actionFilter('all').getAttribute('aria-pressed'),'true');
 assert.equal(s.actionCategory().hidden,true);
});

test('Minecraft controls group connection, actions, command guidance, and visible queue activity',async()=>{
 const s=setup();await s.flush();
 const strip=s.nodes.find(n=>n.className==='minecraft-status-strip');
 assert.ok(strip,'edition and live connection controls share a status strip');
 assert.equal(strip.children[0].tagName,'label');
 assert.equal(strip.children[0].children[0].tagName,'select');
 assert.ok(strip.children.some(n=>n.className==='minecraft-connection-status'));
 const check=s.nodes.find(n=>n.tagName==='button'&&n.textContent.startsWith('Comprobar'));
 assert.equal(check.parentElement,strip);
 assert.equal(check.textContent,'Comprobar conexi\u00f3n');
 assert.equal(check['aria-label'],'Comprobar conexi\u00f3n sin ejecutar un alias');
 assert.equal(s.nodes.find(n=>n.textContent==='Desvincular mundo').parentElement,strip);
 assert.ok(!s.nodes.find(n=>n.className==='minecraft-permission').children.some(n=>n.textContent==='Desvincular mundo'));
 assert.ok(s.nodes.some(n=>n.textContent==='Pausar cola'));
 assert.ok(!s.nodes.some(n=>n.textContent==='Herramientas de prueba'));
 assert.ok(!s.nodes.some(n=>n.textContent==='Probar regalo completo'));
 assert.ok(!s.nodes.some(n=>n.tagName==='label'&&n.textContent.startsWith('Regalo para simular')));
 assert.ok(s.nodes.some(n=>n.tagName==='code'&&n.textContent==='saludo = say Hola {user}'));
 const advanced=s.nodes.find(n=>n.tagName==='summary'&&n.textContent==='Ritmo y cola')?.parentElement;
 const help=s.nodes.find(n=>n.tagName==='summary'&&n.textContent==='Ayuda')?.parentElement;
 const activity=s.nodes.find(n=>n.className==='minecraft-activity');
 assert.ok(advanced,'pacing and queue settings are present');assert.equal(help,undefined,'the help section is removed');assert.ok(activity,'queue activity section is present');
 assert.equal(activity.tagName,'section','queue activity stays visible instead of using a disclosure');
 assert.ok(activity.children.some(n=>n.textContent==='Actividad y cola'));
 assert.ok(s.pane.children.indexOf(advanced)>=0&&s.pane.children.indexOf(activity)>=0);
 assert.ok(s.nodes.some(n=>n.textContent==='Espera la siguiente oleada de regalos'));
 assert.equal(s.nodes.find(n=>n.className==='minecraft-queue-status').getAttribute('aria-live'),'polite');
 assert.equal(s.nodes.find(n=>n.className==='minecraft-wave-lane').children.find(n=>n.tagName==='strong').getAttribute('aria-live'),'off');
 assert.match(fs.readFileSync(`${__dirname}/../web/static/minecraft.css`,'utf8'),/\.minecraft-action-remove[^\{]*\{[^}]*color:\s*var\(--text-muted\)/s);
});

test('queue activity displays execution details and its individual pacing countdown',async()=>{
 const s=setup();await s.flush();
 s.setState({effect_queue:{connection_ready:true,pending_count:8,current:{donor:'Luna',gift:'Rose',action:'Zombi',remaining:3},next:{donor:'Sol',gift:'Heart',action:'TNT',remaining:2},pending:[{donor:'Sol',gift:'Heart',action:'TNT',remaining:2}],unconfirmed_count:1,unconfirmed:[{gift:'Rose',action:'Zombi',donor:'Luna',preset_id:'zombie'}],interval_seconds:1.5,next_object_in_seconds:1.2,wave_seconds_remaining:17,pressure:'accumulating',failure_count:2,paused:false,objects:20,period_seconds:30}});
 await s.tick();
 const activity=s.nodes.find(n=>n.className==='minecraft-activity');
 const flatten=node=>[node,...node.children.flatMap(flatten)];
 const text=flatten(activity).map(n=>n.textContent).join(' ');
 for(const label of ['Zombi','Rose','Luna','3','TNT','Sol','2','17','1.5','acumulando','2'])assert.ok(text.includes(label),`queue activity includes ${label}`);
 assert.ok(text.includes('Heart → TNT'),'pending rows show gift-to-action provenance');
 assert.match(text,/requieren revisión manual: 1/);assert.match(text,/Rose → Zombi · Luna · decide antes de repetir/);
 assert.match(text,/Cada efecto se ejecuta por separado/);
 s.setState({effect_queue:{connection_ready:true,pending_count:21,remaining_objects:42,pressure:'saturated',paused:false}});await s.tick();
 assert.match(s.nodes.find(n=>n.className==='minecraft-queue-status').textContent,/saturada · en espera, sin rechazar regalos/);
});

test('queue pacing settings save object count and period and pause or resume without clearing work',async()=>{
 const s=setup();await s.flush();
 const objects=s.field('Objetos por periodo');objects.value='24';objects.events.input();
 const period=s.field('Periodo (segundos)');period.value='36';period.events.input();
 await s.click('Guardar ritmo');
 let settings=s.requests.find(r=>r.path==='/minecraft/presets/settings').data;
 assert.deepEqual(settings.limits,{objects:24,period_seconds:36});
 assert.ok(s.nodes.some(n=>n.textContent.includes('1.5 segundos por efecto')));
 s.setState({effect_queue:{pending_count:6,paused:false}});await s.tick();
 await s.click('Pausar cola');
 let stop=s.requests.find(r=>r.path==='/minecraft/presets/stop');
 assert.ok(stop,'pause calls the durable queue stop endpoint');
 assert.equal(s.nodes.find(n=>n.textContent==='Reanudar cola')!==undefined,true);
 s.setState({effect_queue:{pending_count:6,paused:true}});await s.tick();
 await s.click('Reanudar cola');
 assert.ok(s.requests.find(r=>r.path==='/minecraft/presets/resume'),'resume calls the durable queue resume endpoint');
 assert.equal(s.requests.some(r=>r.path==='/minecraft/presets/clear'),false,'queue controls never call a destructive clear endpoint');
});

test('Mob category selection and filters survive polling and edition changes without mutations',async()=>{
 const s=setup({initialPresets:{zombie:{gift_id:'1',gift_name:'Rose',enabled:true,quantity:2}}});await s.flush();
 assert.equal(s.actionFilter('all').getAttribute('aria-pressed'),'true');assert.equal(s.actionRow('zombie').hidden,false);
 s.actionFilter('mobs').onclick();const selector=s.actionCategory();
 assert.deepEqual(selector.children.flatMap(node=>node.tagName==='optgroup'?node.children:[node]).filter(option=>option.tagName==='option').map(option=>option.value),['all','undead']);
 const posts=s.requests.filter(r=>r.method==='POST').length;
 selector.value='undead';selector.events.change();await s.tick();assert.equal(s.actionRow('zombie').hidden,false);
 assert.equal(s.requests.filter(r=>r.method==='POST').length,posts);
 await s.edition('bedrock');assert.equal(s.actionFilter('mobs').getAttribute('aria-pressed'),'true');assert.equal(selector.value,'all');
 await s.edition('java');assert.equal(s.actionFilter('mobs').getAttribute('aria-pressed'),'true');assert.equal(selector.value,'all');
});

test('filtered rows retain action drafts and mappings during saves, polling, and recovery',async()=>{
 const s=setup({initialPresets:{cow:{gift_id:'1',gift_name:'Rose',enabled:true,quantity:3},zombie:{gift_id:'1',gift_name:'Rose',enabled:true,quantity:2}}});await s.flush();
 const cow=s.nodes.find(n=>n.dataset.presetQuantity==='cow');cow.value='7';cow.events.input();
 s.actionFilter('abilities').onclick();await s.tick();assert.equal(cow.value,'7');assert.equal(s.actionRow('cow').hidden,true);
 const zombie=s.preset('zombie','enabled');assert.equal(zombie.textContent,'Activa');
 const zombieGift=s.preset('zombie','gift');await zombieGift.events.change();await s.flush();
 let body=s.requests.filter(r=>r.path==='/minecraft/presets').at(-1).data;
 assert.equal(body.presets.cow.quantity,3);assert.equal(body.presets.cow.gift_id,'1');assert.equal(cow.value,'7');
 s.actionFilter('all').onclick();s.holdPost('/minecraft/presets');const saving=cow.events.change();await s.flush();
const count=s.requests.length;s.actionFilter('items').onclick();await s.click('Probar acción: Zombi');assert.equal(s.requests.length,count);
 s.fail(true);s.releasePost();await saving;await s.flush();s.fail(false);await s.tick();
 assert.equal(Number(cow.value),7);assert.equal(s.actionFilter('items').getAttribute('aria-pressed'),'true');
 body=s.requests.filter(r=>r.path==='/minecraft/presets').at(-1).data;
 assert.equal(body.presets.cow.quantity,7);assert.equal(body.presets.zombie.enabled,true);assert.equal(body.presets.zombie.quantity,2);
});

test('each edition hydrates with Todos and later filter choice survives polling and edition changes',async()=>{
 for(const initialEdition of ['java','bedrock']){
  const s=setup({holdInitial:true,initialEdition,initialPresets:{cow:{gift_id:'1',gift_name:'Rose',enabled:true,quantity:2}}});
  assert.equal(s.actionFilter('all').getAttribute('aria-pressed'),'true');
  s.release();await s.flush();assert.equal(s.field('Edición').value,initialEdition);
  assert.equal(s.actionFilter('all').getAttribute('aria-pressed'),'true');await s.tick();assert.equal(s.actionFilter('all').getAttribute('aria-pressed'),'true');
  s.actionFilter('mobs').onclick();await s.tick();assert.equal(s.actionFilter('mobs').getAttribute('aria-pressed'),'true');
  const other=initialEdition==='java'?'bedrock':'java';await s.edition(other);
  assert.equal(s.actionFilter('mobs').getAttribute('aria-pressed'),'true');
  await s.edition(initialEdition);assert.equal(s.actionFilter('mobs').getAttribute('aria-pressed'),'true');
 }
});

test('five top filters replace the Mob category tabs without changing saved profiles',async()=>{
 const s=setup();await s.flush();
 const before=s.profilesSnapshot,filters=s.actionFilters();
 assert.deepEqual(filters.map(filter=>filter.textContent.replace(/\s+·\s+\d+$/,'')),['Todos','Ambiente','Habilidades','Objetos','Mobs']);
 assert.equal(s.nodes.filter(n=>n.role==='tab').length,0);
 const selector=s.actionCategory();s.actionFilter('mobs').onclick();assert.equal(selector.hidden,false);
 assert.equal(s.nodes.filter(n=>n.tagName==='button'&&n.dataset.category).length,0,'category choices are not a row of buttons');
 assert.equal(s.profilesSnapshot,before);
});

test('action filters and the Mob selector expose accessible single-list controls',async()=>{
 const s=setup();await s.flush();
 const toolbar=s.nodes.find(n=>n.role==='toolbar'&&n['aria-label']==='Filtrar acciones por sección');assert.ok(toolbar);
 assert.equal(toolbar.getAttribute('aria-orientation'),'horizontal');assert.equal(s.actionFilter('all').tabIndex,0);assert.ok(s.actionFilters().filter(n=>n!==s.actionFilter('all')).every(n=>n.tabIndex===-1));
 const selector=s.actionCategory();s.actionFilter('mobs').onclick();assert.equal(selector.role,'combobox');assert.equal(selector.getAttribute('aria-label'),'Filtrar mobs por categoría');
 selector.value='all';selector.events.change();assert.equal(selector.value,'all');
});

test('Todos remains the initial action view across Java and Bedrock hydration',async()=>{
 for(const initialEdition of ['java','bedrock']){
  const s=setup({holdInitial:true,initialEdition,initialPresets:{zombie:{gift_id:'1',gift_name:'Rose',enabled:true,quantity:2}}});
  assert.equal(s.actionFilter('all').getAttribute('aria-pressed'),'true');await s.flush();s.release();await s.flush();
  assert.equal(s.actionFilter('all').getAttribute('aria-pressed'),'true');await s.tick();assert.equal(s.actionFilter('all').getAttribute('aria-pressed'),'true');
  const other=initialEdition==='java'?'bedrock':'java';await s.edition(other);
  assert.equal(s.actionFilter('all').getAttribute('aria-pressed'),'true');
 }
});

test('load and navigation preserve all saved fields in both profiles and skills saves retain hidden mappings',async()=>{
 const source=JSON.parse(fs.readFileSync(minecraftSource,'utf8').match(/const defaultActions=(\[.*?\]);/s)[1]);
 const saved=Object.fromEntries(source.map((row,i)=>[row.id,{gift_id:'saved-'+row.id,gift_name:'Gift '+row.id,enabled:i%3===0,...(row.quantity?{quantity:row.id==='tnt_rain'?7:2}:{})}]));
 const s=setup({initialPresets:saved,initialBedrockPresets:structuredClone(saved)});const before=s.profilesSnapshot;await s.flush();
 for(const section of ['environment','abilities','items','mobs'])s.actionFilter(section).onclick();
 const mobCategory=s.actionCategory();assert.equal(mobCategory.hidden,false);
 for(const id of ['all','animals','undead','nether','bosses']){mobCategory.value=id;mobCategory.events.change();}
 await s.tick();assert.equal(s.profilesSnapshot,before);assert.equal(s.requests.filter(r=>r.method==='POST').length,0);
 s.actionFilter('abilities').onclick();const speed=s.preset('speed','gift');speed.value='1';await speed.events.change();await s.flush();
 const payload=s.requests.filter(r=>r.path==='/minecraft/presets').at(-1).data.presets;
 for(const [id,row] of Object.entries(saved))if(id!=='speed')assert.deepEqual(payload[id],row);
 assert.equal(payload.speed.gift_id,'1');assert.equal(Object.keys(payload).length,96);
});
