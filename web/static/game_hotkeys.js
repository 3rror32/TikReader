(() => {
  const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
  const pane=el('section');pane.className='studio-pane game-setup';pane.dataset.section='game-hotkeys';
  const status=el('p');status.className='game-status';status.setAttribute('role','status');
  let state={mappings:[],profiles:['General'],active_profile:'General',authorized:false,paused:false},cards=[],catalog=[],detectedGame='',testing=false,dirty=false,recording=null,pollBusy=false;
  const LOCAL='__prueba_local__';
  async function api(path,data){const r=await fetch(path,{method:data?'POST':'GET',headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(path.endsWith('/test')?90000:8000)}),d=await r.json();if(!r.ok)throw Error(d.error||'No se pudo completar. Revisa el servidor.');return d;}
  function button(text,fn,kind=''){const b=el('button',text);b.type='button';b.className=kind;b.onclick=async()=>{b.disabled=true;try{await fn();}catch(e){status.textContent=e.message;}finally{b.disabled=false;}};return b;}
  function field(text,value='',type='text'){const l=el('label',text),n=el('input');n.type=type;if(type==='checkbox')n.checked=!!value;else n.value=value;l.append(n);return[l,n];}
  function select(text,options,value){const l=el('label',text),n=el('select');for(const[v,t]of options){const o=el('option',t);o.value=v;n.append(o);}n.value=value;l.append(n);return[l,n];}
  function step(number,title,help){const box=el('section');box.className='game-step';box.append(el('h3',`${number}. ${title}`),el('p',help));pane.append(box);return box;}
  function markDirty(){dirty=true;updateOverview();}
  function validGame(title){return !!title&&title.trim().length>=4&&!/TikReader|Chrome|Edge|Firefox/i.test(title);}
  const sequenceText=m=>(m.sequence||[]).map(s=>s.keys.join('+')).join(', ');
  const overview=el('div');overview.className='game-overview';
  const readiness=el('div');readiness.className='game-readiness';
  pane.append(el('h2','Regalos que controlan tu juego'),el('p','Cuando recibas un regalo, TikReader pulsará la tecla que tú elijas. Puedes preparar y probar todo sin LIVE.'),overview,status,readiness);
  const allTools=el('div');allTools.className='tool-buttons';allTools.append(button('Activar todos los juegos',()=>setAll(true),'primary-action'),button('Desactivar todos los juegos',()=>setAll(false),'danger-lite'));pane.append(allTools,el('p','El control global incluye todos los perfiles. Solo responde el perfil seleccionado. Prueba local se ejecuta con el botón Probar.'));
  const profiles=step(1,'Elegir perfil','Usa General para comenzar o guarda una configuración para cada juego.');
  const[activeL,active]=select('Perfil del juego',[],''),[newL,newName]=field('Nombre del nuevo perfil');
  const profileTools=el('div');profileTools.className='tool-buttons profile-tools';
  const deleteProfile=button('Eliminar perfil',async()=>{
    const removed=state.active_profile;
    if(removed==='General')throw Error('General es el perfil base y no se puede eliminar.');
    const count=state.mappings.filter(m=>m.profile===removed).length;
    if(!(window.I18n?.confirm ?? confirm)(`¿Eliminar el perfil “${removed}”${count?` y sus ${count} ${count===1?'acción':'acciones'}`:''}? Esta acción no se puede deshacer.`))return;
    stopRecording();
    if(state.authorized)syncSafety(await api('/game-hotkeys/authorize',{enabled:false,confirmation:'AUTORIZAR HOTKEYS'}));
    const mappings=state.mappings.filter(m=>m.profile!==removed),remaining=state.profiles.filter(name=>name!==removed),next=remaining.includes('General')?'General':remaining[0];
    state=await api('/game-hotkeys',{mappings,profiles:remaining,active_profile:next});detectedGame='';foreground.textContent='Detecta el juego de este perfil.';renderProfiles();draw();status.textContent=`Perfil “${removed}” eliminado${count?` junto con ${count} ${count===1?'acción':'acciones'}`:''}.`;
  },'danger-lite');
  profileTools.append(deleteProfile);
  const newBox=el('details');newBox.append(el('summary','Crear otro perfil'),newL,button('Crear perfil',async()=>{
    const name=newName.value.trim();if(!name||state.profiles.includes(name))throw Error('Escribe un nombre nuevo para el perfil.');
    if(dirty)await saveAll();const next=await api('/game-hotkeys',{mappings:state.mappings,profiles:[...state.profiles,name],active_profile:name});state=next;detectedGame='';newName.value='';renderProfiles();draw();status.textContent='Perfil creado. Detecta ahora su juego.';
  }));profiles.append(activeL,profileTools,newBox);
  const detection=step(2,'Detectar el juego','Abre el juego. Pulsa el botón y cambia a su ventana durante la cuenta regresiva.');
  const foreground=el('p','Todavía no has detectado un juego.');foreground.setAttribute('role','status');
  const detect=button('Detectar en 5 segundos',async()=>{
    stopRecording();for(let seconds=5;seconds>0;seconds--){foreground.textContent=`Cambia al juego: detección en ${seconds}…`;await new Promise(r=>setTimeout(r,1000));}
    const live=await api('/game-hotkeys');syncSafety(live);
    if(!validGame(live.foreground)){detectedGame='';foreground.textContent='No se detectó un juego válido. Repite y cambia al juego, no al navegador.';return;}
    detectedGame=live.foreground;for(const card of cards)card.setWindow(detectedGame);
    foreground.textContent=`Juego detectado: ${detectedGame}. Aplicado a las acciones sin ventana.`;markDirty();
  });detection.append(detect,foreground);
  const actions=step(3,'Elegir regalo y grabar tecla','Empieza desde una plantilla o crea tu acción. Nada se activa automáticamente.');
  const templates=el('div');templates.className='game-template-buttons';
  for(const name of ['Saltar','Interactuar','Pausar el juego','Secuencia de teclas'])templates.append(button(name,()=>{actionCard({name});markDirty();status.textContent=`Plantilla “${name}” preparada. Graba la tecla que utiliza tu juego; no se asume ninguna.`;}));
  const rows=el('div');rows.className='game-actions';
  const toolbar=el('div');toolbar.className='tool-buttons';toolbar.append(button('＋ Nueva acción',()=>{actionCard();markDirty();}),button('Guardar acciones',saveAll,'primary-action'),button('Actualizar lista de regalos',loadCatalog));
  actions.append(templates,toolbar,rows);
  const authorization=step(4,'Autorizar y probar','Al autorizar permites pulsaciones en el juego configurado. Pulsa “Probar en 5 segundos” y cambia inmediatamente al juego; no habrá otra confirmación.');
  const auth=button('Autorizar teclas',async()=>{if(dirty)await saveAll();if(!cards.length)throw Error('Primero crea y guarda una acción.');syncSafety(await api('/game-hotkeys/authorize',{enabled:true,confirmation:'AUTORIZAR HOTKEYS'}));status.textContent='Teclas autorizadas. Ahora puedes probar tu acción.';},'primary-action');
  const pause=button('Pausar teclas',async()=>{syncSafety(await api('/game-hotkeys/pause',{paused:!state.paused}));status.textContent=state.paused?'Teclas pausadas; las pruebas pendientes se bloquearán si permanecen pausadas.':'Teclas reanudadas.';});
  const authorizationActions=el('div');authorizationActions.className='tool-buttons pane-actions';
  authorizationActions.append(auth,pause,button('Desactivar teclas',async()=>{syncSafety(await api('/game-hotkeys/authorize',{enabled:false,confirmation:'AUTORIZAR HOTKEYS'}));status.textContent='Teclas desactivadas.';}));
  authorization.append(authorizationActions,el('p','Las pruebas no envían regalos. Para responder a regalos reales, marca “Activa en LIVE”, elige un regalo real y guarda.'));
  const history=el('details'),log=el('div');history.className='game-secondary';history.append(el('summary','Historial y diagnóstico de pruebas'),button('Actualizar historial',async()=>{const live=await api('/game-hotkeys');syncSafety(live);log.replaceChildren(...live.log.slice(0,30).map(x=>el('p',`${new Date(x.at*1000).toLocaleTimeString((window.I18n?.locale || 'es-419'))} · ${x.mapping||'Sistema'} · ${x.outcome||x.text}`)));}),log);pane.append(history,el('p','El modo en segundo plano es experimental. No se elevan permisos ni se evitan protecciones de los juegos.'));
  function stopRecording(){if(recording){recording();recording=null;}}
  function keyName(e){if(/^Key[A-Z]$/.test(e.code))return e.code.slice(3);if(/^Digit\d$/.test(e.code))return e.code.slice(5);if(/^F([1-9]|1\d|2[0-4])$/.test(e.key))return e.key.toUpperCase();const special={Space:'SPACE',' ':'SPACE',Enter:'ENTER',NumpadEnter:'ENTER',Tab:'TAB',Escape:'ESC',ArrowUp:'UP',ArrowDown:'DOWN',ArrowLeft:'LEFT',ArrowRight:'RIGHT'};return special[e.code]||special[e.key]||(/^[a-z0-9]$/i.test(e.key)?e.key.toUpperCase():null);}
  function capture(input,add,trigger,changed,hint){
    stopRecording();const original=trigger.textContent,placeholder=input.placeholder;
    const announce=text=>{hint.textContent=text;status.textContent=text;};
    trigger.textContent='Esperando tecla…';trigger.classList.add('recording');input.classList.add('recording');input.placeholder='Presiona una tecla ahora…';
    announce('Escuchando: pulsa una tecla, sola o con Ctrl, Alt o Shift.');
    const handler=e=>{
      e.preventDefault();e.stopImmediatePropagation();if(e.repeat)return;
      const main=keyName(e);
      if(!main){announce(['Control','Alt','Shift','Meta','AltGraph'].includes(e.key)?'Mantén el modificador y pulsa la tecla de la combinación.':'Tecla no compatible. Usa letras, números, F1–F24, espacio, Enter, Tab, Esc o flechas.');return;}
      const keys=[];if(e.ctrlKey)keys.push('CTRL');if(e.altKey)keys.push('ALT');if(e.shiftKey)keys.push('SHIFT');if(e.metaKey)keys.push('WIN');keys.push(main);
      if(keys.length>4){announce('Usa hasta tres modificadores y una tecla.');return;}
      input.value=(add&&input.value?input.value+', ':'')+keys.join('+');stopRecording();changed();announce(`Teclas registradas: ${keys.join(' + ')}.`);
    };
    recording=()=>{window.removeEventListener('keydown',handler,true);trigger.textContent=original;trigger.classList.remove('recording');input.classList.remove('recording');input.placeholder=placeholder;announce('Grabación detenida. Pulsa el campo o Grabar tecla para volver a grabar.');};
    window.addEventListener('keydown',handler,true);input.focus({preventScroll:true});return handler;
  }
  window.addEventListener('blur',stopRecording);
  document.addEventListener('pointerdown',e=>{if(recording&&!e.target.closest('.key-recorder-area'))stopRecording();},true);
  function actionCard(m={}){
    m={...m,id:m.id||crypto.randomUUID()};const card=el('article');card.className='setting-card game-action';
    const[nameL,name]=field('Nombre de la acción',m.name||'Nueva acción'),[enabledL,enabled]=field('Activa en LIVE y simulación',m.enabled,'checkbox');
    const head=el('div');head.className='game-action-head';head.append(nameL,enabledL);
    const[giftL,gift]=select('Cuando recibas',[],''),[amountL,amount]=field('Cantidad de regalos',m.amount||1,'number');amount.min=1;amount.max=9999;
    const[seqL,seq]=field('Pulsa esta tecla o combinación',sequenceText(m));seq.readOnly=true;seq.placeholder='Haz clic aquí y pulsa una tecla';
    const[winL,win]=field('Ventana permitida',m.window||detectedGame);
    const[conditionL,condition]=select('Cómo contar los regalos',[['minimum','Al llegar a esta cantidad'],['exact','Sólo esta cantidad exacta'],['multiple','Cada múltiplo de esta cantidad']],m.condition||'minimum');
    const summary=el('p'),targetNote=el('p');summary.className='game-rule-sentence';targetNote.className='game-target';
    function changed(){summary.textContent=gift.value===LOCAL?`Prueba local → ${seq.value||'falta grabar una tecla'}`:`Cuando recibas ${gift.value||'un regalo'} × ${amount.value}, pulsa ${seq.value||'una tecla por grabar'}.`;targetNote.textContent=win.value?`Destino: ${win.value}`:'Falta detectar el juego en el paso 2.';enabled.disabled=gift.value===LOCAL;if(enabled.disabled)enabled.checked=false;markDirty();}
    function fillGifts(value){gift.replaceChildren();const options=[[LOCAL,'Prueba local, sin regalo real'],...catalog.map(g=>[g.name,g.diamonds?`${g.name} · ${g.diamonds} diamantes`:g.name])];if(value&&value!==LOCAL&&!catalog.some(g=>g.name===value))options.push([value,`${value} · guardado`]);for(const[v,t]of options){const o=el('option',t);o.value=v;gift.append(o);}gift.value=value||LOCAL;}
    fillGifts(m.gift);card.refreshGifts=()=>{fillGifts(gift.value);};
    const recorder=el('div');recorder.className='key-recorder-area';
    const hint=el('p','Pulsa el campo o Grabar tecla y después la tecla que usa tu juego.');hint.setAttribute('role','status');
    const keyTools=el('div');keyTools.className='key-recorder';const rec=button('Grabar tecla',()=>capture(seq,false,rec,changed,hint)),add=button('Añadir paso',()=>{if(seq.value.split(',').filter(Boolean).length>=10)throw Error('Máximo 10 pasos.');capture(seq,true,add,changed,hint);});keyTools.append(rec,add,button('Cancelar grabación',stopRecording),button('Borrar teclas',()=>{stopRecording();seq.value='';hint.textContent='Teclas borradas. Pulsa el campo para grabar.';changed();}));
    seq.onclick=()=>{if(!seq.classList.contains('recording'))capture(seq,false,rec,changed,hint);};
    seq.onkeydown=e=>{if(!recording)capture(seq,false,rec,changed,hint)(e);};
    recorder.append(seqL,keyTools,hint);
    const basic=el('div');basic.className='game-basic';basic.append(giftL,amountL,recorder);
    const advanced=el('details');advanced.append(el('summary','Opciones avanzadas'));
    const[holdL,hold]=field('Duración de pulsación (ms)',m.sequence?.[0]?.hold_ms||60,'number'),[delayL,delay]=field('Espera entre pasos (ms)',m.sequence?.[0]?.delay_ms||0,'number'),[targetL,target]=select('Modo de envío',[['foreground','Sólo con el juego al frente'],['background','Segundo plano (experimental)']],m.target||'foreground'),[coolL,cool]=field('Espera entre activaciones (s)',m.cooldown||10,'number'),[budgetL,budget]=field('Máximo por sesión',m.budget||100,'number'),[priorityL,priority]=field('Prioridad (0–100)',m.priority??50,'number'),[onceL,once]=field('Una vez por racha',m.once_per_streak!==false,'checkbox'),[overlayL,overlay]=field('Mostrar aviso visual',m.overlay!==false,'checkbox');
    advanced.append(winL,button('Usar juego detectado',()=>{if(!detectedGame)throw Error('Detecta el juego en el paso 2.');win.value=detectedGame;changed();}),conditionL,holdL,delayL,targetL,coolL,budgetL,priorityL,onceL,overlayL);
    for(const n of [name,enabled,gift,amount,condition,win,hold,delay,target,cool,budget,priority,once,overlay])n.addEventListener('input',changed);
    card.collect=()=>({id:m.id,name:name.value,profile:state.active_profile,gift:gift.value,amount:Number(amount.value),condition:condition.value,once_per_streak:once.checked,sequence:seq.value.split(',').filter(s=>s.trim()).map((s,i)=>({keys:s.trim().split('+'),hold_ms:Number(hold.value)===m.sequence?.[0]?.hold_ms?(m.sequence[i]?.hold_ms??Number(hold.value)):Number(hold.value),delay_ms:Number(delay.value)===m.sequence?.[0]?.delay_ms?(m.sequence[i]?.delay_ms??Number(delay.value)):Number(delay.value)})),window:win.value,target:target.value,cooldown:Number(cool.value),budget:Number(budget.value),priority:Number(priority.value),overlay:overlay.checked,enabled:gift.value!==LOCAL&&enabled.checked});
    card.setWindow=value=>{if(!win.value){win.value=value;changed();}};
    card.disable=()=>{enabled.checked=false;};
    const tools=el('div');tools.className='tool-buttons';tools.append(button('Probar en 5 segundos',()=>testAction(m.id)),button('Eliminar acción',()=>{stopRecording();cards=cards.filter(c=>c!==card);card.remove();markDirty();},'danger-lite'));
    card.append(head,summary,basic,targetNote,advanced,tools);rows.append(card);cards.push(card);const wasDirty=dirty;changed();dirty=wasDirty;updateOverview();
  }
  function renderProfiles(){active.replaceChildren();for(const name of state.profiles){const o=el('option',name);o.value=name;active.append(o);}active.value=state.active_profile;deleteProfile.disabled=state.active_profile==='General';deleteProfile.title=deleteProfile.disabled?'General es el perfil base y no se puede eliminar.':`Eliminar “${state.active_profile}” y todas sus acciones`;}
  function draw(){stopRecording();rows.replaceChildren();cards=[];for(const m of state.mappings.filter(m=>m.profile===state.active_profile))actionCard(m);dirty=false;updateOverview();}
  function updateOverview(){overview.replaceChildren(el('span',state.authorized?(state.paused?'Teclas pausadas':'Teclas autorizadas'):'Teclas desactivadas'),el('span',`${cards.length} acciones · ${dirty?'Cambios sin guardar':'Guardado'}`),el('span',`${state.queue||0} en cola`));if(typeof auth!=='undefined'){auth.textContent=state.authorized?'Renovar autorización':'Autorizar teclas';pause.textContent=state.paused?'Reanudar teclas':'Pausar teclas';}readiness.replaceChildren();if(!catalog.length)readiness.append(el('p','Sin catálogo: puedes probar sin LIVE. Conecta una transmisión y pulsa “Actualizar lista de regalos” para elegir regalos reales.'),button('Ir a conectar LIVE',()=>window.Shell?.show('live')));if(state.emergency)readiness.append(el('p','Emisión silenciada: las teclas están bloqueadas.'),button('Ir al control de emisión',()=>window.Shell?.show('control-center')));}
  function syncSafety(live){for(const key of ['authorized','paused','queue','emergency'])if(key in live)state[key]=live[key];updateOverview();}
  async function saveAll(){stopRecording();const values=cards.map(c=>c.collect());for(const m of values){if(!m.window.trim())throw Error(`“${m.name}”: detecta el juego en el paso 2.`);if(!m.sequence.length)throw Error(`“${m.name}”: graba la tecla antes de guardar.`);if(!m.gift)throw Error('Selecciona un regalo o Prueba local.');}const mappings=[...state.mappings.filter(m=>m.profile!==state.active_profile),...values];state=await api('/game-hotkeys',{mappings,profiles:state.profiles,active_profile:state.active_profile});dirty=false;updateOverview();status.textContent='Acciones guardadas. Puedes autorizarlas y probarlas.';}
  let switchingAll=false;
  async function setAll(enabled){
    if(switchingAll)throw Error('Espera a que termine el cambio de juegos.');
    switchingAll=true;
    try{stopRecording();if(enabled&&dirty)await saveAll();const live=await api('/game-hotkeys/all',{enabled,confirmation:'AUTORIZAR HOTKEYS'});state=live;if(enabled)draw();else{for(const card of cards)card.disable();updateOverview();}status.textContent=enabled?'Juegos activados. Elige el mismo regalo en Simulación y vuelve al juego durante la espera.':'Todos los juegos desactivados. Las pulsaciones pendientes quedaron canceladas.';return live;}finally{switchingAll=false;}
  }
  window.GameHotkeysUI={setAll};
  async function testAction(id){if(testing)throw Error('Ya hay una prueba en curso.');testing=true;let timer;try{await saveAll();const m=state.mappings.find(x=>x.id===id);if(!state.authorized)throw Error('Autoriza las teclas en el paso 4 y vuelve a probar.');if(state.paused)throw Error('Reanuda las teclas en el paso 4.');if(state.emergency)throw Error('Pulsa Reanudar voz y efectos antes de probar.');let seconds=5;const notice=()=>{status.textContent=seconds>0?`Cambia ahora a ${m.window}: prueba en ${seconds} segundos…`:'Ejecutando; mantén el juego al frente…';};notice();timer=setInterval(()=>{seconds=Math.max(0,seconds-1);notice();},1000);await api('/game-hotkeys/test',{id,confirmation:'PROBAR HOTKEY'});status.textContent=`Prueba ejecutada: ${sequenceText(m)}.`;}finally{clearInterval(timer);testing=false;}}
  async function loadCatalog(){const d=await api('/gift-catalog');catalog=d.gifts||[];for(const c of cards)c.refreshGifts();updateOverview();status.textContent=catalog.length?`${catalog.length} regalos disponibles.`:'Todavía no hay catálogo. Puedes preparar una Prueba local sin LIVE.';}
  active.onchange=async()=>{const next=active.value;try{if(dirty)await saveAll();state=await api('/game-hotkeys',{mappings:state.mappings,profiles:state.profiles,active_profile:next});detectedGame='';foreground.textContent='Detecta el juego de este perfil.';renderProfiles();draw();}catch(e){active.value=state.active_profile;status.textContent=e.message;}};
  document.querySelector('.app').append(pane);
  Promise.all([api('/game-hotkeys'),api('/gift-catalog')]).then(([d,g])=>{state=d;catalog=g.gifts||[];renderProfiles();draw();status.textContent='Empieza por elegir perfil y detectar el juego.';}).catch(e=>status.textContent=e.message);
  setInterval(async()=>{if(pane.hidden||document.hidden||pollBusy||testing)return;pollBusy=true;try{syncSafety(await api('/game-hotkeys'));}catch(_){status.textContent='No se pudo consultar el servidor. Revisa que TikReader siga abierto.';}finally{pollBusy=false;}},5000);
})();
