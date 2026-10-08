/* Studio controls use browser voices; no external TTS service or paid API. */
window.Studio = (() => {
  const $ = id => document.getElementById(id);
  let nativeVoice=null,nativePlayback=null;
  const nativeVoiceReady=window.qt?.webChannelTransport?new Promise(resolve=>{
    if(!window.QWebChannel){resolve(null);return;}
    try{new QWebChannel(window.qt.webChannelTransport,channel=>{
      nativeVoice=channel.objects.nativeVoice||null;
      if(nativeVoice){
        nativeVoice.started.connect(()=>{const playing=nativePlayback;if(!playing||playing.generation!==epoch)return;voiceNote('Motor de voz nativo inició la lectura',playing.item.text);updateVoice();});
        nativeVoice.finished.connect(()=>{const playing=nativePlayback;nativePlayback=null;if(playing)finishVoice(playing.item,playing.generation);});
        nativeVoice.failed.connect(message=>{const playing=nativePlayback;nativePlayback=null;if(!playing||playing.generation!==epoch)return;active=false;currentItem=null;queue=[];voiceError=`Error de voz: ${message||'no disponible'}. Pulsa Probar voz para reintentar.`;updateVoice();audioNotice(voiceError);});
      }
      resolve(nativeVoice);
    });}catch(_){resolve(null);}
  }):null;
  function cancelSystemVoice(){if(nativeVoiceReady){nativePlayback=null;nativeVoice?.stop();}else window.speechSynthesis?.cancel();}
  function pauseSystemVoice(){if(nativeVoiceReady)nativeVoice?.pause();else window.speechSynthesis?.pause();}
  function resumeSystemVoice(){if(nativeVoiceReady)nativeVoice?.resume();else window.speechSynthesis?.resume();}
  let session, cache = [], repeats = new Map(), gifts = new Map(), giftsReady = false;
  let queue = [], active = false, paused = false, epoch = 0, audio, lastAlert = 0, timer, voiceError = '';
  const holds = new Set();
  let voicePreview = false;
  function clearPreviousVoice() {
    epoch++; queue=[]; deferred=[]; currentItem=null; active=false;
    if(currentUtterance){currentUtterance.onend=null;currentUtterance.onerror=null;currentUtterance=null;}
    if(!voicePreview)cancelSystemVoice();
    if(localPlayback){localPlayback.onended=null;localPlayback.onerror=null;localPlayback.pause();if(localPlayback.src)URL.revokeObjectURL(localPlayback.src);localPlayback=null;}
    updateVoice();
  }
  document.addEventListener('tikreader:voice-changing', () => {holds.add('voice-change');clearPreviousVoice();});
  document.addEventListener('tikreader:voice-changed', () => {clearPreviousVoice();holds.delete('voice-change');updateVoice();});
  let suppressed=0, productionMuted=false;
  let currentItem=null,currentUtterance=null,localPlayback=null,voiceSerial=0,deferred=[];const voiceLog=[];
  function voiceNote(reason,text){voiceLog.unshift({reason,text:String(text).slice(0,200)});if(voiceLog.length>100)voiceLog.pop();}
  let prefs = {};
  try { prefs = JSON.parse(localStorage.getItem('tikreader.preferences') || '{}'); } catch (_) {}
  const settings = ['tts-rate','tts-volume','tts-voice','tts-read-name','tts-gifts-enabled','tts-greetings-enabled','blocked-words','antispam','no-emoji','alerts-enabled','alert-tone','alert-gift','alert-min','tts-priority','priority-users','tts-max-age','tts-restrict','tts-audience','tts-allowed-users'];
  for (const id of settings) {
    if (prefs[id] !== undefined && $(id)) {
      if ($(id).type === 'checkbox') $(id).checked = prefs[id]; else $(id).value = prefs[id];
    }
    $(id)?.addEventListener('change', () => {
      if(['tts-restrict','tts-audience','tts-allowed-users'].includes(id)){queue=[];updateVoice();}
      for (const key of settings) prefs[key] = $(key).type === 'checkbox' ? $(key).checked : $(key).value;
      try { localStorage.setItem('tikreader.preferences', JSON.stringify(prefs)); } catch (_) {}
      render();
    });
  }
  const notice = text => { if(window.LiveExperience) window.LiveExperience.notify(text); else if($('studio-notice')) $('studio-notice').textContent = text; };
  function audioNotice(text) {
    notice(text);
  }
  function ensure(next) {
    if (session === next) return;
    session = next; cache = []; repeats.clear(); gifts.clear(); giftsReady = false;
    queue = []; epoch++; active = false; if(!voicePreview)cancelSystemVoice(); localPlayback?.pause();localPlayback=null;updateVoice();
    currentItem=null;deferred=[];voiceLog.length=0;updateVoice();
  }
  function accepted(data) {
    const text = `${data.user} ${data.comment}`.toLocaleLowerCase();
    const blocked = $('blocked-words').value.split(',').map(s=>s.trim().toLocaleLowerCase()).filter(Boolean);
    return !blocked.some(word=>text.includes(word)) && !($('antispam').checked && data.spam)
      && (!$('questions-only').checked || /[?¿]/.test(data.comment))
      && text.includes($('chat-search').value.trim().toLocaleLowerCase());
  }
  function ingest(data, live) {
    ensure(data.session);
    const now = Date.now(), key = `${data.user}:${data.comment.trim().toLocaleLowerCase()}`;
    const spam = live && now - (repeats.get(key) || 0) < 10000;
    if (live) repeats.set(key, now);
    if (repeats.size > 1000) repeats.delete(repeats.keys().next().value);
    const record = {...data, spam}; cache.push(record); if (cache.length > 200) cache.shift();
    if (!accepted(record)) {if(live){voiceNote(record.spam&&$('antispam').checked?'Comentario repetido':'Filtro de palabras, búsqueda o preguntas',data.comment);updateVoice();}return false;}
    if(live&&!$('tts-enabled').checked){voiceNote('Lectura automática apagada',data.comment);updateVoice();}
    else if(live&&!canRead(data)){voiceNote($('tts-audience').value==='followers'?(data.is_follower==null?'Seguidor no confirmado por TikTok':'No es seguidor'): $('tts-audience').value==='manual'?'Modo manual':'Usuario fuera de la lista permitida',data.comment);updateVoice();}
    if (live && $('tts-enabled').checked && canRead(data)) {
      const mode=$('tts-priority').value;
      const priority=(mode==='questions' && /[¿?]/.test(data.comment)) || (mode==='users' && $('priority-users').value.toLowerCase().split(',').map(s=>s.trim().replace(/^@/,'')).includes(data.user.toLowerCase().replace(/^@/,'')));
      const read=text=>{if(session===data.session && $('tts-enabled').checked && canRead(data))speak(text,false,priority?1:0);};
      if(window.ProductionUI)window.ProductionUI.readComment(data,read);
      else read($('tts-read-name').checked ? `${data.user.replace(/^@/,'')} dice: ${data.comment}` : data.comment);
    }
    return true;
  }
  function canRead(data) {
    if(!$('tts-restrict').checked)return true;
    if($('tts-audience').value==='followers')return data.is_follower===true;
    if($('tts-audience').value==='selected')return $('tts-allowed-users').value.split(/[\s,;]+/).map(s=>s.trim().replace(/^@/,'').toLowerCase()).filter(Boolean).includes(data.user.replace(/^@/,'').toLowerCase());
    return false;
  }
  function render() {
    if (typeof clearFeed !== 'function') return;
    clearFeed(); for (const item of cache) if (accepted(item)) addComment(item);
  }
  function voiceSnapshot(){return {current:active?currentItem?.text||null:null,pending:queue.map(i=>({...i})),deferred:deferred.map(i=>({...i})),log:voiceLog.slice(0,20),status:window.I18n?.sourceText($('tts-state')) ?? $('tts-state').textContent};}
  function updateVoice() { const enabled=$('tts-enabled').checked||$('tts-gifts-enabled').checked||$('tts-greetings-enabled').checked;$('tts-state').textContent = voiceError || `${productionMuted?'Emisión silenciada':holds.size?'Voz en espera':paused ? 'Voz pausada' : active ? 'Leyendo' : enabled ? 'Voz activa' : 'Voz apagada'} · cola: ${queue.length}`;if($('saturation-state'))$('saturation-state').textContent=`${suppressed} lecturas omitidas`;const speaking=Boolean(active);if(!window.TikReaderVoiceState||window.TikReaderVoiceState.speaking!==speaking){window.TikReaderVoiceState={speaking};if(typeof window.dispatchEvent==='function'&&typeof CustomEvent==='function')window.dispatchEvent(new CustomEvent('tikreader:voice-state',{detail:{speaking}}));} }
  function speak(text, test=false, priority=0, source='comment') {
    if(productionMuted){suppressed++;voiceNote('Emisión silenciada por emergencia o escena',text);updateVoice();if(test)audioNotice('No se puede leer: la emisión está silenciada. Pulsa Reanudar voz y efectos y selecciona la escena Charla. Reanudar también habilita las fuentes públicas.');return;}
    if(test && Number($('tts-volume').value)<=0){audioNotice('No se puede escuchar: el volumen de Voz está en cero. Súbelo y vuelve a pulsar Leer.');return;}
    if(test && paused){audioNotice('La voz está pausada. Pulsa Continuar voz y vuelve a pulsar Leer.');return;}
    if(test && holds.size)audioNotice(holds.has('audio-owner')?'Lectura en espera del control de audio. Si otra pestaña está leyendo, desactiva allí la voz y las alertas.':holds.has('sync')?'Lectura en espera: sincronizando el estado con el servidor.':'Lectura en espera: hay un efecto de audio o una pausa por micrófono activos.');
    text=window.ProductionUI?.speechText(text)??text;
    if ($('no-emoji').checked) text = text.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu,'');
    if (!text.trim()){voiceNote('Texto vacío después de quitar emojis',text);updateVoice();return;}
    voiceError='';
    const cap=Math.max(1,Math.min(30,Number($('tts-cap')?.value)||10));
    if (queue.length >= cap){const removed=queue.pop();voiceNote('Cola llena',removed.text);suppressed++;} queue.push({id:++voiceSerial,text:text.slice(0,400),test,priority,source,at:Date.now()}); queue.sort((a,b)=>b.priority-a.priority); drain(); updateVoice();
  }
  function drain() {
    if (active || paused || holds.size || productionMuted || !queue.length) return;
    const maxAge=Math.max(5,Math.min(300,Number($('tts-max-age').value)||45))*1000;
    const before=queue.length;queue=queue.filter(item=>{if(Date.now()-item.at>maxAge){voiceNote('Espera máxima superada',item.text);return false;}return true;});suppressed+=before-queue.length;if(!queue.length)return;
    const item=queue.shift();
    if (!item.test && !$(item.source==='gift'?'tts-gifts-enabled':item.source==='greeting'?'tts-greetings-enabled':'tts-enabled').checked) { drain();updateVoice();return; }
    const generation=epoch;currentItem=item;
    let character=null;try{character=JSON.parse(localStorage.getItem('tikreader.voiceCharacter')||'null');}catch(_){}
    if(character?.engine==='kokoro'){renderKokoro(item,generation,character);return;}
    if(character?.engine==='rvc'&&character.model&&localStorage.getItem('tikreader.rvcResourceConsent')==='true'){renderLocal(item,generation,character);return;}
    speakBrowser(item,generation,character);
  }
  function finishVoice(item,generation){if(generation!==epoch)return;nativePlayback=null;voiceNote('Motor de voz terminó la lectura',item.text);active=false;currentItem=null;currentUtterance=null;localPlayback=null;drain();updateVoice();}
  function speakNative(item,generation,character) {
    active=true;updateVoice();
    nativeVoiceReady.then(bridge=>{
      if(generation!==epoch||currentItem!==item)return;
      if(!bridge){active=false;currentItem=null;queue=[];voiceError='La voz nativa no pudo iniciarse. Reinicia TikReader y vuelve a intentarlo.';updateVoice();audioNotice(voiceError);return;}
      const utterance={text:item.text,rate:Number($('tts-rate').value)||1,volume:Number($('tts-volume').value),pitch:Number(character?.pitch)||1};
      if(window.VoicePersonality)window.VoicePersonality.apply(utterance,character,utterance.rate);
      const voiceLabel=$('tts-voice').selectedOptions[0]?.textContent||'';
      nativePlayback={item,generation};
      Promise.resolve(bridge.speak(item.text,utterance.rate,utterance.volume,utterance.pitch,voiceLabel)).catch(error=>{
        if(nativePlayback?.item!==item||generation!==epoch)return;
        nativePlayback=null;active=false;currentItem=null;queue=[];voiceError=`Error de voz: ${error?.message||'no disponible'}. Pulsa Probar voz para reintentar.`;updateVoice();audioNotice(voiceError);
      });
    });
  }
  function speakBrowser(item,generation,character=null) {
    if(nativeVoiceReady){speakNative(item,generation,character);return;}
    if(!window.speechSynthesis){audioNotice('Este navegador no ofrece voces del equipo.');finishVoice(item,generation);return;}
    const utterance = new SpeechSynthesisUtterance(item.text);
    utterance.rate=Number($('tts-rate').value); utterance.volume=Number($('tts-volume').value);
    if(window.VoicePersonality)window.VoicePersonality.apply(utterance,character,utterance.rate);
    else if(character?.pitch)utterance.pitch=Math.max(.5,Math.min(2,Number(character.pitch)||1));
    utterance.voice=speechSynthesis.getVoices().find(v=>v.voiceURI===$('tts-voice').value&&v.localService===true)||null;
    if(!utterance.voice){audioNotice('La voz local seleccionada no está disponible.');finishVoice(item,generation);return;}utterance.lang=utterance.voice.lang;
    currentUtterance=utterance;
    utterance.onstart=()=>{if(generation!==epoch)return;voiceNote('Motor de voz inició la lectura',item.text);updateVoice();};
    utterance.onend=()=>finishVoice(item,generation); utterance.onerror=event=>{if(generation!==epoch)return;active=false;queue=[];voiceError=`Error de voz: ${event.error || 'no disponible'}. Pulsa Probar voz para reintentar.`;updateVoice();audioNotice(voiceError);};active=true;
    try{speechSynthesis.resume();speechSynthesis.speak(utterance);}catch(_){active=false;queue=[];voiceError='No se pudo iniciar la voz. Pulsa Probar voz.';audioNotice(voiceError);}
  }
  async function renderKokoro(item,generation,character) {
    active=true;voiceNote('Generando voz local Kokoro',item.text);updateVoice();
    let url=null;
    try {
      const response=await fetch('/local-tts/render',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:item.text,voice:character.voice,speed:Number($('tts-rate').value)||1}),signal:AbortSignal.timeout(120000)});
      if(!response.ok)throw Error();
      url=URL.createObjectURL(await response.blob());
      if(generation!==epoch){URL.revokeObjectURL(url);return;}
      const player=new Audio(url);localPlayback=player;player.volume=Number($('tts-volume').value);
      player.onended=()=>{URL.revokeObjectURL(url);if(generation===epoch)finishVoice(item,generation);};
      player.onerror=()=>{URL.revokeObjectURL(url);if(generation===epoch){audioNotice('No se pudo reproducir Kokoro. Lectura omitida.');finishVoice(item,generation);}};
      if(!paused&&!holds.size&&!productionMuted)await player.play();
    } catch(_) {
      if(url)URL.revokeObjectURL(url);
      if(generation===epoch){voiceNote('Kokoro local falló; lectura omitida',item.text);audioNotice('Kokoro local no pudo leer. No se cambió de voz.');finishVoice(item,generation);}
    }
  }
  async function renderLocal(item,generation,character){active=true;voiceNote('Generando voz con RVC local',item.text);updateVoice();try{const response=await fetch('/voice-models/render',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:item.text,model:character.model,pitch:character.pitch||0}),signal:AbortSignal.timeout(120000)});if(!response.ok)throw Error();const url=URL.createObjectURL(await response.blob());if(generation!==epoch){URL.revokeObjectURL(url);return;}localPlayback=new Audio(url);localPlayback.volume=Number($('tts-volume').value);localPlayback.onended=()=>{URL.revokeObjectURL(url);finishVoice(item,generation);};localPlayback.onerror=()=>{URL.revokeObjectURL(url);voiceNote('RVC falló; lectura omitida (solo GPU)',item.text);audioNotice('RVC no pudo reproducir el audio. No se usó una voz alternativa.');finishVoice(item,generation);};if(!paused&&!holds.size&&!productionMuted)await localPlayback.play();}catch(_){if(generation!==epoch)return;voiceNote('RVC no disponible; lectura omitida (solo GPU)',item.text);audioNotice('RVC requiere GPU CUDA. Lectura omitida; no se usó una voz alternativa.');finishVoice(item,generation);}}
  function skip() { if(currentItem)voiceNote('Lectura saltada manualmente',currentItem.text);currentItem=null;epoch++; if(!voicePreview)cancelSystemVoice();localPlayback?.pause();localPlayback=null; active=false;drain();updateVoice(); }
  function pause() { paused=!paused;if(paused){if(!voicePreview)pauseSystemVoice();localPlayback?.pause();}else if(!holds.size && !productionMuted){resumeSystemVoice();localPlayback?.play().catch(()=>{});drain();} $('tts-pause').textContent=paused?'Continuar voz':'Pausar voz';updateVoice(); }
  function voices() {
    const select=$('tts-voice');select.replaceChildren();
    for(const voice of (window.speechSynthesis?.getVoices() || []).filter(v=>v.localService===true)) {const option=document.createElement('option');option.value=voice.voiceURI;option.textContent=`${voice.name} · ${voice.lang}`;select.append(option);}
    const preferred=prefs['tts-voice'] || [...select.options].find(o=>/es[-_]/i.test(o.textContent))?.value;
    if(preferred)select.value=preferred;
    if(!select.options.length){const option=document.createElement('option');option.textContent='Voz predeterminada del sistema';option.value='';select.append(option);}
  }
  async function post(data) {const r=await fetch('/studio/state',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});if(!r.ok)throw Error('No se pudo guardar');return r.json();}
  function pin(data) {post({highlight:data.id}).then(result=>{showState(result);notice('Comentario fijado.');}).catch(e=>notice(e.message));}
  function decorate(card,data) {
    if(data.answered)card.classList.add('answered');
    const actions=document.createElement('div');actions.className='comment-actions';
    for(const [text,action] of [['📌 Destacar',()=>pin(data)],['✓ Respondido',async()=>{try{const result=await post({answered:data.id});window.LiveExperience?.state(result);const item=cache.find(c=>c.id===data.id);if(item)item.answered=true;card.classList.add('answered');notice('Comentario marcado como respondido.');}catch(e){notice(e.message);}}],['🔊 Leer',()=>speak(data.comment,true)]]) {
      const b=document.createElement('button');b.textContent=text;b.addEventListener('click',action);actions.append(b);
    }
    card.querySelector('.comment-body').append(actions);
    window.ProductionUI?.decorate(card,data);
  }
  function showState(data) {
    const pinBox=$('pinned-comment');pinBox.replaceChildren();pinBox.hidden=!data.highlight;
    if(data.highlight){const text=document.createElement('span');text.textContent=`📌 ${data.highlight.user}: ${data.highlight.comment}`;pinBox.append(text);const close=document.createElement('button');close.textContent='Quitar';close.onclick=()=>post({highlight:null}).then(showState).catch(e=>notice(e.message));pinBox.append(close);}
    const list=$('ranking-list');list.replaceChildren();
    const rankKey=$('ranking-sort')?.value||'count';
    for(const entry of [...data.ranking||[]].sort((a,b)=>(b[rankKey]||0)-(a[rankKey]||0)).slice(0,20)) {const li=document.createElement('li');li.textContent=`@${entry.user} — ${rankKey==='diamonds'?(entry.diamonds==null?'Diamantes no informados':entry.diamonds+' diamantes'):entry.count+' regalos'}`;list.append(li);}
    window.Workspace?.state(data);
    $('ranking-empty').hidden=!!data.ranking?.length;
  }
  async function refreshStudio() {try{const r=await fetch('/studio/state',{cache:'no-store',signal:AbortSignal.timeout(5000)});if(r.ok)showState(await r.json());}catch(_){}finally{setTimeout(refreshStudio,document.hidden?15000:5000);}}
  function alertGift(text,test=false) {
    if(productionMuted)return;
    if(!test && (!$('alerts-enabled').checked || Date.now()-lastAlert<5000))return;
    lastAlert=Date.now();window.Notifications?.show(text,{type:'success',duration:4000});
    if(holds.has('audio-owner')||holds.has('effects'))return;
    try {audio ||= new (window.AudioContext||window.webkitAudioContext)();audio.resume();const osc=audio.createOscillator(),gain=audio.createGain();osc.frequency.value=Number($('alert-tone').value);gain.gain.setValueAtTime(.08,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.4);osc.connect(gain);gain.connect(audio.destination);osc.start();osc.stop(audio.currentTime+.4);}catch(_){}
  }
  function updateLocalAlert() {
    const enabled=$('alerts-enabled').checked;
    for(const control of $('alert-local-options')?.querySelectorAll?.('input, select')||[])control.disabled=!enabled;
    if($('alert-local-status'))$('alert-local-status').textContent=enabled?'Activo · avisará aquí cuando llegue un regalo que cumpla estos filtros.':'Apagado · no emitirá avisos cuando lleguen regalos.';
  }
  function giftUpdate(snapshot) {
    ensure(snapshot.session);
    for(const gift of snapshot.gifts) {
      if(gift.summary)continue;
      const previous=gifts.get(gift.id)||0;
      if(giftsReady && gift.count>previous && $('tts-gifts-enabled').checked){
        const user=gift.user.replace(/^@/,'');
        const phrase=gift.count===1?`${user} regaló una ${gift.gift}`:`${user} regaló ${gift.gift}, cantidad ${gift.count}`;
        speak(phrase,false,$('tts-priority').value==='gifts'?2:0,'gift');
      }
      if(giftsReady && gift.count>previous && gift.count>=Number($('alert-min').value) && gift.gift.toLocaleLowerCase().includes($('alert-gift').value.trim().toLocaleLowerCase()))alertGift(`${gift.user} envió ${gift.gift} ×${gift.count}`);
      gifts.set(gift.id,gift.count);
    }
    if(gifts.size>1000) for(const key of [...gifts.keys()].slice(0,gifts.size-1000))gifts.delete(key);
    giftsReady=true;
  }
  async function history() {try{const r=await fetch('/history');const data=await r.json();const select=$('history-session'),previous=select.value;select.replaceChildren();for(const item of data.sessions){const option=document.createElement('option');option.value=item.id;option.textContent=`@${item.username} · ${new Date(item.started.replace(" ","T")+"Z").toLocaleString((window.I18n?.locale || 'es-419'),{hour12:true})}`;select.append(option);}if([...select.options].some(o=>o.value===previous))select.value=previous;exportLinks();}catch(_){notice('No se pudo cargar el historial.');}}
  function exportLinks(){const id=encodeURIComponent($('history-session').value);$('export-json').href=`/history/${id}/export`;$('export-csv').href=`/history/${id}/export?format=csv`;}
  $('history-view').onclick=async()=>{try{const r=await fetch($('export-json').href);const rows=await r.json();$('history-preview').replaceChildren();for(const row of rows.filter(row=>row.kind!=="sample").slice(-200).reverse()){const p=document.createElement('p');p.textContent=row.kind==="marker"?`Marcador · ${row.label} · ${row.elapsed}s`:row.kind==="question"?`Pregunta · ${row.text}`:`${row.user}: ${row.comment||`${row.gift} ×${row.count}`}`;$('history-preview').append(p);}}catch(_){notice('Selecciona una sesión guardada.');}};
  $('history-refresh').onclick=history;$('history-session').onchange=exportLinks;
  for(const [id,source] of [['tts-enabled','comment'],['tts-gifts-enabled','gift'],['tts-greetings-enabled','greeting']]) {
    $(id).onchange=()=>{
      if(!$(id).checked){
        queue=queue.filter(item=>item.source!==source);
        if(currentItem?.source===source){currentItem=null;epoch++;active=false;window.speechSynthesis?.cancel();localPlayback?.pause();localPlayback=null;drain();}
      }
      updateVoice();
    };
  }
  $('tts-pause').onclick=pause;$('tts-skip').onclick=skip;$('tts-test').onclick=()=>speak('Esta es una prueba de voz de TikReader.',true);
  $('alert-test').onclick=()=>{alertGift('Prueba de aviso local · no es un regalo real',true);if($('alert-local-status'))$('alert-local-status').textContent='Prueba enviada. Debes ver el mensaje y escuchar el sonido en esta computadora.';};
  $('alerts-enabled').onchange=()=>{if($('alerts-enabled').checked){try{audio ||= new (window.AudioContext||window.webkitAudioContext)();audio.resume();}catch(_){}}updateLocalAlert();};
  $('chat-search').oninput=render;$('questions-only').onchange=render;
  function configureStudioNavigation(root = document, onSelect = () => {}) {
    const tablist = root.querySelector('.studio-tabs');
    if (!tablist) return;
    const buttons = [...root.querySelectorAll('[data-tab]')];
    const panes = [...root.querySelectorAll('[data-pane]')];
    const paneByName = new Map(panes.map(pane => [pane.dataset.pane, pane]));
    const pairs = buttons.map(button => ({ button, pane: paneByName.get(button.dataset.tab) })).filter(pair => pair.pane);
    if (!pairs.length) return;
    tablist.setAttribute('role', 'tablist');
    tablist.setAttribute('aria-orientation', 'horizontal');
    for (const { button, pane } of pairs) {
      button.id ||= `studio-tab-${button.dataset.tab}`;
      pane.id ||= `studio-pane-${pane.dataset.pane}`;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-controls', pane.id);
      pane.setAttribute('role', 'tabpanel');
      pane.setAttribute('aria-labelledby', button.id);
      pane.tabIndex = 0;
    }
    const activate = (selected, focus = false, notify = true) => {
      for (const { button, pane } of pairs) {
        const isSelected = button === selected;
        button.classList.toggle('active', isSelected);
        button.setAttribute('aria-selected', String(isSelected));
        button.tabIndex = isSelected ? 0 : -1;
        pane.hidden = !isSelected;
      }
      if (focus) selected.focus();
      if (notify) onSelect(selected.dataset.tab);
    };
    const initial = pairs.find(({ button }) => button.classList.contains('active'))
      || pairs.find(({ pane }) => !pane.hidden) || pairs[0];
    activate(initial.button, false, false);
    for (const { button } of pairs) button.addEventListener('click', () => activate(button));
    tablist.addEventListener('keydown', event => {
      const activeButton = pairs.some(pair => pair.button === event.target)
        ? event.target : pairs.find(({ button }) => button.getAttribute('aria-selected') === 'true')?.button;
      const index = pairs.findIndex(({ button }) => button === activeButton);
      if (index < 0) return;
      let next = index;
      if (event.key === 'ArrowRight') next = (index + 1) % pairs.length;
      else if (event.key === 'ArrowLeft') next = (index - 1 + pairs.length) % pairs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = pairs.length - 1;
      else return;
      event.preventDefault();
      activate(pairs[next].button, true);
    });
  }
  configureStudioNavigation(document, tab => { if (tab === 'history') history(); });
  document.addEventListener('keydown',event=>{if(!event.altKey || event.shiftKey || event.ctrlKey || event.metaKey || event.target.isContentEditable || /INPUT|SELECT|TEXTAREA/.test(event.target.tagName))return;const key=event.key.toLowerCase();if(['p','n','d'].includes(key)){event.preventDefault();if(key==='p')pause();if(key==='n')skip();if(key==='d'){const item=[...cache].reverse().find(accepted);if(item)pin(item);}}});
  updateLocalAlert();voices();window.speechSynthesis?.addEventListener('voiceschanged',voices);setTimeout(refreshStudio,500);
  return {ingest,decorate,gifts:giftUpdate,clearVoice:clearPreviousVoice,
    voiceSnapshot,
    audioDiagnostics:()=>({paused,muted:productionMuted,holds:[...holds],enabled:$('tts-enabled').checked||$('tts-gifts-enabled').checked||$('tts-greetings-enabled').checked,volume:Number($('tts-volume').value),voices:window.speechSynthesis?.getVoices().length||0,status:window.I18n?.sourceText($('tts-state')) ?? $('tts-state').textContent}),
    editQueue(id,action){
      if(action==='restore'){const i=deferred.findIndex(x=>x.id===id);if(i<0||queue.length>=30)return false;const item=deferred.splice(i,1)[0];item.at=Date.now();item.test=true;item.priority=100;queue.unshift(item);drain();updateVoice();return true;}
      const index=queue.findIndex(x=>x.id===id);if(index<0)return false;const item=queue[index];
      if(action==='front'){queue.splice(index,1);item.priority=100;item.at=Date.now();queue.unshift(item);}
      else if(action==='remove'){queue.splice(index,1);voiceNote('Retirado manualmente de la cola',item.text);}
      else if(action==='later'){queue.splice(index,1);deferred.push(item);if(deferred.length>30)deferred.shift();}
      else return false;
      updateVoice();return true;
    },
    greetAutomatic(user){if($('tts-greetings-enabled').checked && typeof user==='string' && user.trim())speak(`¡Hola, ${user.replace(/^@/, '').slice(0,80)}! Gracias por acompañarnos.`,false,0,'greeting');},
    speakManual:text=>speak(text,true),
    beginVoicePreview(){if(productionMuted)return false;holds.add('voice-preview');clearPreviousVoice();voicePreview=true;return true;},
    endVoicePreview(){if(!voicePreview)return;voicePreview=false;holds.delete('voice-preview');if(holds.size||paused||productionMuted)pauseSystemVoice();else{resumeSystemVoice();drain();}updateVoice();},
    hold(reason,on){if(on){holds.add(reason);if(!voicePreview)pauseSystemVoice();localPlayback?.pause();}else{holds.delete(reason);if(!holds.size&&!paused&&!productionMuted){resumeSystemVoice();localPlayback?.play().catch(()=>{});drain();}}updateVoice();},
    mute(on){productionMuted=on;window.tikreaderAudioMuted=on;document.dispatchEvent(new CustomEvent('tikreader:audio-muted',{detail:on}));if(on){queue=[];epoch++;active=false;cancelSystemVoice();localPlayback?.pause();localPlayback=null;audio?.suspend();if($('gift-alert'))$('gift-alert').hidden=true;}updateVoice();},
    queueInfo:()=>({pending:queue.length,omitted:suppressed}),
    preferences:()=>Object.fromEntries(settings.map(key=>[key,$(key).type==='checkbox'?$(key).checked:$(key).value])),
    applyPreferences(values){queue=[];for(const key of settings)if(values[key]!==undefined){if($(key).type==='checkbox')$(key).checked=!!values[key];else $(key).value=values[key];}prefs=this.preferences();try{localStorage.setItem('tikreader.preferences',JSON.stringify(prefs));}catch(_){}render();updateVoice();}
  };
})();
