window.SimulationUI = (() => {
  const $ = id => document.getElementById(id);
  const el = (tag, text) => {const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;};
  let state={active:false},busy=false,polling=false,lastGeneration=null,signature='',profileSignature='',dockEventSignature='';

  const banner=el('div');banner.id='simulation-banner';banner.hidden=true;banner.setAttribute('role','status');
  const bannerOpen=el('button','Abrir panel de prueba');bannerOpen.type='button';
  banner.append(el('strong','MODO SIMULACIÓN'),el('span','Eventos simulados · Acciones reales'),bannerOpen);document.body.prepend(banner);
  new ResizeObserver(()=>document.body.style.setProperty('--simulation-banner-height',`${banner.offsetHeight}px`)).observe(banner);

  const dockButton=el('button');dockButton.id='simulation-fab';dockButton.type='button';dockButton.title='Abrir simulador de chat';dockButton.setAttribute('aria-controls','simulation-float');dockButton.setAttribute('aria-expanded','false');dockButton.setAttribute('aria-label','Abrir simulador de chat');
  const dockButtonIcon=el('span');dockButtonIcon.className='simulation-fab-icon';dockButtonIcon.setAttribute('aria-hidden','true');dockButtonIcon.innerHTML='<svg viewBox="0 0 24 24" focusable="false"><path d="M5.25 4.25h13.5a2 2 0 0 1 2 2v8.25a2 2 0 0 1-2 2H11l-5.75 3.25V16.5a2 2 0 0 1-2-2V6.25a2 2 0 0 1 2-2Z"/><circle cx="8" cy="10.4" r="1.15"/><circle cx="12" cy="10.4" r="1.15"/><circle cx="16" cy="10.4" r="1.15"/></svg>';
  const dockUnread=el('i');dockUnread.className='simulation-fab-unread';dockUnread.setAttribute('aria-hidden','true');
  dockButton.append(dockButtonIcon,dockUnread);

  const dock=el('section');dock.id='simulation-float';dock.hidden=true;dock.setAttribute('role','dialog');dock.setAttribute('aria-modal','false');dock.setAttribute('aria-labelledby','simulation-float-title');
  const simulationPane=document.querySelector('[data-section="simulation"]');
  dock.innerHTML=`
    <header class="simulation-float-header">
      <div class="simulation-float-title"><i aria-hidden="true"></i><span><small>LABORATORIO EN VIVO</small><strong id="simulation-float-title">Chat de prueba</strong></span></div>
      <div class="simulation-float-window-actions"><button id="simulation-float-full" type="button" title="Abrir el simulador completo" aria-label="Abrir el simulador completo"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M14 5h5v5M19 5l-8 8M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg></button><button id="simulation-float-close" type="button" title="Cerrar panel" aria-label="Cerrar panel"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m7 7 10 10M17 7 7 17"/></svg></button></div>
    </header>
    <div class="simulation-float-state"><span id="simulation-float-state">Comprobando simulación…</span><button id="simulation-float-activate" type="button">Activar</button></div>
    <div class="simulation-float-tabs" role="tablist" aria-label="Vista del simulador"><button id="simulation-float-tab-chat" type="button" role="tab" tabindex="0" aria-selected="true" aria-controls="simulation-float-chat-view" data-simulation-float-tab="chat"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 5.5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-5.5 3v-3H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z"/><path d="M7.5 10h9M7.5 13h6"/></svg><span class="simulation-float-tab-label">Chat</span></button><button id="simulation-float-tab-activity" type="button" role="tab" tabindex="-1" aria-selected="false" aria-controls="simulation-float-activity-view" data-simulation-float-tab="activity"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 19V5M4 19h16M7 15l4-4 3 2 5-6"/></svg><span class="simulation-float-tab-label">Actividad</span><span id="simulation-float-activity-count">0</span></button></div>
    <div id="simulation-float-chat-view" class="simulation-float-view" role="tabpanel" aria-labelledby="simulation-float-tab-chat" tabindex="0">
      <div id="simulation-float-feed" class="simulation-float-feed" role="log" aria-live="polite"><p>Activa la simulación para enviar un mensaje.</p></div>
      <form id="simulation-float-form">
        <fieldset id="simulation-float-fields" disabled>
          <div class="simulation-float-row">
            <label><span>Usuario</span><input id="simulation-float-user" value="simulador" maxlength="24" autocomplete="off" required></label>
            <label><span>Evento</span><select id="simulation-float-kind"><option value="comment">Comentario</option><option value="gift">Regalo</option></select></label>
          </div>
          <label id="simulation-float-comment-label"><span>Mensaje</span><textarea id="simulation-float-text" rows="2" maxlength="400" placeholder="Escribe lo que enviaría el espectador…"></textarea></label>
          <div id="simulation-float-gift-fields" class="simulation-float-row" hidden>
            <label><span>Regalo</span><div class="simulation-gift-control"><button id="simulation-float-gift" class="simulation-gift-trigger" type="button" role="combobox" aria-haspopup="listbox" aria-controls="simulation-gift-picker" aria-expanded="false" data-gift-name="Rose">Rose</button></div></label>
            <label><span>Cantidad</span><input id="simulation-float-count" type="number" min="1" max="9999" step="1" value="1"></label>
          </div>
          <div id="simulation-float-gift-catalog-error" class="simulation-gift-error" hidden><p id="simulation-float-gift-catalog-error-message" role="status">No se pudo cargar el catálogo de regalos. Inténtalo de nuevo.</p><button id="simulation-float-gift-catalog-retry" type="button">Intentar de nuevo</button></div>
          <p id="simulation-float-effects-cue" class="simulation-effects-cue">Al activar, cada envío ejecuta tus reglas guardadas y los overlays habituales.</p>
          <div class="simulation-float-send-row"><label><span>Espera</span><span class="simulation-float-number"><input id="simulation-float-delay" type="number" min="0" max="60" step="1" value="0"><em>s</em></span></label><button id="simulation-float-send" type="submit" aria-label="Enviar comentario"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M21 3 10.8 13.2"/><path d="m21 3-6.5 18-3.7-7.5L3 9.8 21 3Z"/></svg><span>Enviar</span></button></div>
        </fieldset>
      </form>
    </div>
    <div id="simulation-float-activity-view" class="simulation-float-view" role="tabpanel" aria-labelledby="simulation-float-tab-activity" tabindex="0" hidden><div id="simulation-float-log" class="simulation-float-log"><p>Las reglas y acciones aparecerán aquí.</p></div></div>
    <footer><span id="simulation-float-progress">Sin envíos pendientes</span><button id="simulation-float-stop" type="button" aria-label="Cancelar envío" disabled><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="6" y="6" width="12" height="12" rx="1.5"/></svg><span>Cancelar envío</span></button></footer>`;
  document.body.append(dock,dockButton);

  async function api(path,data){const response=await fetch(path,{method:data?'POST':'GET',headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined,cache:'no-store',signal:AbortSignal.timeout(10000)});const result=await response.json();if(!response.ok)throw Error(result.error||'No se pudo consultar la simulación');return result;}
  function mainStatus(text){const output=$('simulation-status');if(output)output.textContent=text;}
  function effectsCueText(){if(!state.active)return'Al activar, cada envío ejecuta tus reglas guardadas y los overlays habituales.';if(state.muted)return'Simulación activa: las acciones están pausadas.';return'Simulación activa: al enviar, tus reglas guardadas y los overlays habituales ejecutan acciones reales.';}
  function recordsFor(update){const games=update.games||{log:[]};return [...(update.traces||[]).map(x=>({at:x.at,text:`${x.rule} · ${x.action||'Regla'} · ${x.outcome}`})),...(games.log||[]).map(x=>({at:x.at,text:`${x.mapping||'Hotkeys'} · ${x.text} · ${x.outcome}`})),...(update.events||[]).flatMap(x=>(x.hotkeys||[]).map(h=>({at:x.at,text:`${h.name} · ${h.result==='Coincide'?'Regla coincide; consulta la ejecución de la tecla':h.result}`})))].sort((a,b)=>b.at-a.at).slice(0,80);}
  function renderDockEvents(update){
    const events=update.events||[],next=JSON.stringify(events.map(x=>x.id));
    if(next!==dockEventSignature){
      const firstRender=dockEventSignature==='';dockEventSignature=next;
      const box=$('simulation-float-feed'),follow=box.scrollHeight-box.scrollTop-box.clientHeight<48;box.replaceChildren();
      for(const event of events.slice(-30)){
        const row=el('article');row.dataset.kind=event.kind;
        row.append(el('time',new Date(event.at*1000).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'})),el('strong',event.user));
        if(event.kind==='gift'){
          const gift=event.gift||event.text||'Regalo',count=Number.isInteger(event.count)&&event.count>0?event.count:1;
          const accessibleName=`${event.user} envió ${gift}, cantidad ${count}`;
          row.setAttribute('aria-label',accessibleName);
          const detail=el('p'),art=el('span');detail.className='simulation-float-gift';art.className='simulation-float-gift-art';art.setAttribute('aria-hidden','true');
          const fallback=()=>{const label=el('span',gift);label.className='simulation-float-gift-fallback';art.replaceChildren(label);};
          if(event.image_url){const image=el('img');image.src=event.image_url;image.alt='';image.onerror=fallback;art.append(image);}else fallback();
          const quantity=el('span',`× ${count}`);quantity.className='simulation-float-gift-quantity';
          detail.append(art,quantity);row.append(detail);
        }else row.append(el('p',event.text));
        box.append(row);
      }
      if(!events.length)box.append(el('p',state.active?'Envía un comentario o regalo para iniciar la prueba.':'Activa la simulación para enviar un mensaje.'));
      if(follow)box.scrollTop=box.scrollHeight;
      if(!firstRender&&dock.hidden&&events.length)dockButton.classList.add('has-unread');
    }
    const records=recordsFor(update),log=$('simulation-float-log');log.replaceChildren();
    for(const record of records.slice(0,30)){const row=el('article');row.append(el('time',new Date(record.at*1000).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'})),el('p',record.text));log.append(row);}
    if(!records.length)log.append(el('p','Las reglas, efectos y hotkeys aparecerán aquí después de enviar un evento.'));
    $('simulation-float-activity-count').textContent=String(records.length);
  }
  function renderDock(){
    const batchRunning=!!state.batch?.running;
    dockButton.classList.toggle('is-active',state.active);dock.classList.toggle('is-active',state.active);
    $('simulation-float-state').textContent=state.active?(state.muted?'Simulación activa · acciones pausadas':'Simulación activa · observando respuestas'):(state.connected?'Desconecta el LIVE para hacer pruebas':'Lista para una prueba sin conectar el LIVE');
    $('simulation-float-effects-cue').textContent=effectsCueText();
    $('simulation-float-activate').textContent=state.active?'Desactivar':'Activar';
    $('simulation-float-activate').classList.toggle('is-on',state.active);
    $('simulation-float-fields').disabled=!state.active;
    $('simulation-float-stop').disabled=!state.active||(!batchRunning&&!state.muted);
    renderDockEvents(state);
  }
  function apply(update){
    if(typeof update.active!=='boolean')return;
    if(update.instance===state.instance&&lastGeneration!==null&&update.generation<lastGeneration)return;
    if(lastGeneration!==null&&update.generation!==lastGeneration){window.Studio?.clearVoice?.();window.TikReaderEffects?.clear();}
    lastGeneration=update.generation;state={...state,...update};
    banner.hidden=!state.active;document.body.classList.toggle('simulation-active',state.active);
    try{sessionStorage.setItem('tikreader.simulationActive',String(state.active));}catch(_){ }
    const connect=$('btn-connect');if(connect){connect.disabled=state.active||!!state.connected;connect.title=state.active?'Desactiva el modo simulación para conectar un LIVE.':'';}
    $('simulation-toggle').textContent=state.active?'Desactivar simulación':'Activar simulación';
    $('simulation-effects-cue').textContent=effectsCueText();
    $('simulation-fields').disabled=!state.active;
    $('simulation-stop').disabled=!state.active;
    $('simulation-resume').hidden=!state.active||!state.muted;
    renderDock();
    if(!update.events)return;
    const next=JSON.stringify(update.events);
    if(next!==signature){signature=next;const box=$('simulation-chat'),follow=box.scrollHeight-box.scrollTop-box.clientHeight<60;box.replaceChildren();for(const event of update.events){const row=el('article');row.dataset.kind=event.kind;row.append(el('time',new Date(event.at*1000).toLocaleTimeString()),el('strong',event.user),el('p',event.text));box.append(row);}if(!update.events.length)box.append(el('p',state.active?'Escribe un comentario o prepara una racha de regalos.':'Activa la simulación para enviar tu primer evento.'));if(follow)box.scrollTop=box.scrollHeight;}
    const games=update.games,nextProfile=JSON.stringify(games);
    if(nextProfile!==profileSignature){profileSignature=nextProfile;const box=$('simulation-profile');box.replaceChildren(el('strong',games.profile),el('p',games.authorized?(games.paused?'Hotkeys pausadas':'Hotkeys autorizadas'):'Hotkeys sin autorización: actívalas en el perfil de juegos.'));for(const m of games.mappings){const row=el('div');row.className='simulation-profile-rule';row.append(el('strong',`${m.name} · ${m.enabled?'Activa':'Desactivada'}`),el('small',`${m.gift} → ${m.keys.map(k=>k.join(' + ')).join(' → ')}`),el('small',`${m.window} · ${m.target==='foreground'?'Ventana al frente':'Segundo plano'}`));box.append(row);}if(!games.mappings.length)box.append(el('p','No hay acciones en este perfil. Configúralas en Juegos para probar las teclas.'));}
    const records=recordsFor(update);$('simulation-log').replaceChildren(...records.map(x=>el('p',`${new Date(x.at*1000).toLocaleTimeString()} · ${x.text}`)));if(!records.length)$('simulation-log').textContent='Sin acciones registradas. Comprueba que las reglas estén activadas y coincidan con el evento.';
  }
  function progress(){
    const batch=state.batch;let text='Sin envíos pendientes';
    if(batch){const seconds=Math.max(0,Math.ceil(batch.starts_at-Date.now()/1000));text=batch.running&&seconds>0?`Envío en ${seconds} s · vuelve al juego`:`${batch.status} · ${batch.sent}/${batch.count}`;}
    $('simulation-progress').textContent=text;$('simulation-float-progress').textContent=text;
  }
  async function refresh(){if(document.hidden||(!state.active&&!state.batch&&simulationPane?.hidden&&dock.hidden))return;if(polling)return;polling=true;try{apply(await api('/simulation'));progress();if($('simulation-status').textContent==='Consultando el estado…')mainStatus(state.active?'Simulación activa. Puedes enviar eventos.':'Desconecta el LIVE y activa la simulación para empezar.');}catch(error){mainStatus(error.message+'. Si el modo estaba activo, la franja se mantiene hasta confirmar su desactivación.');$('simulation-float-state').textContent=error.message;}finally{polling=false;}}
  async function action(fn){if(busy)return;busy=true;renderDock();try{await fn();}catch(error){mainStatus(error.message);$('simulation-float-state').textContent=error.message;}finally{busy=false;await refresh();}}
  let sends=Promise.resolve(),sendEpoch=0;
  function submitEvent(data,done){
    const epoch=sendEpoch;
    sends=sends.then(async()=>{
      if(epoch!==sendEpoch)return;
      try{apply(await api('/simulation/events',data));await done();}
      catch(error){mainStatus(error.message);}
    });
  }
  async function toggleSimulation(){sendEpoch++;apply(await api('/simulation',{action:state.active?'deactivate':'activate'}));if(state.active){await window.TikReaderAudio?.claimForSimulation();mainStatus(effectsCueText());}else mainStatus('Simulación desactivada. El LIVE sigue desconectado.');}
  async function stopSimulation(){sendEpoch++;apply(await api('/simulation',{action:'stop'}));mainStatus('Envíos detenidos y emisión pausada. Reanuda cuando quieras continuar.');}

  function openDock(){dock.hidden=false;dockButton.hidden=true;dockButton.setAttribute('aria-expanded','true');dockButton.classList.remove('has-unread');restoreDockPosition();renderDock();requestAnimationFrame(()=>dock.querySelector('[role="tab"][aria-selected="true"]').focus());}
  function closeDock(){dock.hidden=true;dockButton.hidden=false;dockButton.setAttribute('aria-expanded','false');dockButton.focus();}
  function setDockTab(tab,focus=false){for(const button of dock.querySelectorAll('[data-simulation-float-tab]')){const selected=button.dataset.simulationFloatTab===tab;button.setAttribute('aria-selected',String(selected));button.setAttribute('tabindex',String(selected?0:-1));}$('simulation-float-chat-view').hidden=tab!=='chat';$('simulation-float-activity-view').hidden=tab!=='activity';if(focus)dock.querySelector(`[data-simulation-float-tab="${tab}"]`).focus();}
  function restoreDockPosition(){
    if(matchMedia('(max-width: 680px)').matches){dock.style.removeProperty('left');dock.style.removeProperty('top');dock.style.removeProperty('right');dock.style.removeProperty('bottom');return;}
    try{const saved=JSON.parse(localStorage.getItem('tikreader.simulationDockPosition')||'null');if(saved&&Number.isFinite(saved.left)&&Number.isFinite(saved.top)){dock.style.left=`${Math.max(8,Math.min(innerWidth-dock.offsetWidth-8,saved.left))}px`;dock.style.top=`${Math.max(8,Math.min(innerHeight-dock.offsetHeight-8,saved.top))}px`;dock.style.right='auto';dock.style.bottom='auto';}}catch(_){ }
  }
  function installDockDrag(){
    const handle=dock.querySelector('.simulation-float-header');let drag=null;
    handle.addEventListener('pointerdown',event=>{if(event.target.closest('button')||matchMedia('(max-width: 680px)').matches)return;const rect=dock.getBoundingClientRect();drag={x:event.clientX-rect.left,y:event.clientY-rect.top};dock.style.left=`${rect.left}px`;dock.style.top=`${rect.top}px`;dock.style.right='auto';dock.style.bottom='auto';handle.setPointerCapture(event.pointerId);dock.classList.add('is-dragging');event.preventDefault();});
    handle.addEventListener('pointermove',event=>{if(!drag)return;dock.style.left=`${Math.max(8,Math.min(innerWidth-dock.offsetWidth-8,event.clientX-drag.x))}px`;dock.style.top=`${Math.max(8,Math.min(innerHeight-dock.offsetHeight-8,event.clientY-drag.y))}px`;});
    const finish=()=>{if(!drag)return;drag=null;dock.classList.remove('is-dragging');const rect=dock.getBoundingClientRect();try{localStorage.setItem('tikreader.simulationDockPosition',JSON.stringify({left:rect.left,top:rect.top}));}catch(_){ }};
    handle.addEventListener('pointerup',finish);handle.addEventListener('pointercancel',finish);
  }

  dockButton.onclick=openDock;bannerOpen.onclick=openDock;$('simulation-float-close').onclick=closeDock;
  $('simulation-float-full').onclick=()=>{window.Shell?.show('simulation');closeDock();};
  $('simulation-float-activate').onclick=()=>action(toggleSimulation);
  $('simulation-float-stop').onclick=()=>action(stopSimulation);
  dock.querySelectorAll('[data-simulation-float-tab]').forEach(button=>button.onclick=()=>setDockTab(button.dataset.simulationFloatTab));
  dock.addEventListener('keydown',event=>{if(event.target.getAttribute('role')!=='tab')return;const tabs=[...dock.querySelectorAll('[data-simulation-float-tab]')],index=tabs.indexOf(event.target);let next=index;if(event.key==='ArrowRight')next=(index+1)%tabs.length;else if(event.key==='ArrowLeft')next=(index-1+tabs.length)%tabs.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=tabs.length-1;else return;event.preventDefault();setDockTab(tabs[next].dataset.simulationFloatTab,true);});
  $('simulation-float-kind').onchange=()=>{const gift=$('simulation-float-kind').value==='gift';$('simulation-float-gift-fields').hidden=!gift;$('simulation-float-comment-label').hidden=gift;$('simulation-float-send').setAttribute('aria-label',gift?'Enviar regalo':'Enviar comentario');};
  $('simulation-float-form').onsubmit=event=>{event.preventDefault();const kind=$('simulation-float-kind').value,gift=$('simulation-float-gift');const data={kind,user:$('simulation-float-user').value,text:$('simulation-float-text').value,gift:gift.dataset.giftName||'',gift_id:gift.dataset.giftId||'',mode:'separate',count:Number($('simulation-float-count').value),interval:.5,delay:Number($('simulation-float-delay').value),diamonds:1};submitEvent(data,async()=>{mainStatus('Evento enviado desde el panel flotante. Observa la pantalla y la pestaña Actividad.');if(kind==='comment')$('simulation-float-text').select();});};
  installDockDrag();
  addEventListener('resize',()=>{if(!dock.hidden)restoreDockPosition();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!dock.hidden&&!event.defaultPrevented)closeDock();});

  $('simulation-toggle').onclick=()=>action(toggleSimulation);
  $('simulation-stop').onclick=()=>action(stopSimulation);
  $('simulation-resume').onclick=()=>action(async()=>{await window.ProductionUI?.resumeSimulation();mainStatus('Emisión reanudada en la escena Charla. Puedes continuar las pruebas.');});
  $('simulation-audio').onclick=()=>action(async()=>{const owned=await window.TikReaderAudio?.claimForSimulation();mainStatus(owned?'Audio disponible en esta pestaña. La voz y los avisos respetan tus ajustes del LIVE.':'No se pudo obtener el control de audio.');});
  for(const [id,enabled] of [['simulation-games-on',true],['simulation-games-off',false]])$(id).onclick=()=>action(async()=>{await window.GameHotkeysUI.setAll(enabled);mainStatus(enabled?'Juegos activados. Envía el regalo configurado y vuelve al juego durante la espera.':'Todos los juegos desactivados y pulsaciones pendientes canceladas.');});
  $('simulation-form').onsubmit=event=>{event.preventDefault();const kind=$('simulation-kind').value,gift=$('simulation-gift');const data={kind,user:$('simulation-user').value,text:$('simulation-text').value,gift:gift.dataset.giftName||'',gift_id:gift.dataset.giftId||'',mode:$('simulation-mode').value,count:Number($('simulation-count').value),interval:Number($('simulation-interval').value),delay:Number($('simulation-delay').value),diamonds:Number($('simulation-diamonds').value)};submitEvent(data,async()=>{mainStatus('Envío programado. Puedes cambiar al juego o a una ventana de overlay.');});};
  $('simulation-kind').onchange=()=>{const gift=$('simulation-kind').value==='gift';$('simulation-gift-fields').hidden=!gift;$('simulation-comment-label').hidden=gift;$('simulation-send').textContent=gift?'Enviar regalos':'Enviar comentario';};
  $('simulation-mode').onchange=()=>{$('simulation-rachainfo').textContent=$('simulation-mode').value==='streak'?'La racha pasa por 1, 2, 3… hasta N y termina sin contar dos veces el último regalo.':'Cada envío tiene su propio identificador y cantidad 1. Se respetan los tiempos de espera entre activaciones.';};
  document.querySelectorAll('[data-simulation-open]').forEach(button=>button.onclick=()=>window.Shell?.show(button.dataset.simulationOpen));
  const giftInputs=[$('simulation-gift'),$('simulation-float-gift')],picker=el('div'),giftSearch=el('input'),giftSearchStatus=el('p'),giftOptions=el('div'),giftPickerRetry=el('button','Intentar de nuevo');
  const giftCatalogErrors=[$('simulation-gift-catalog-error'),$('simulation-float-gift-catalog-error')];
  const giftCatalogErrorMessages=[$('simulation-gift-catalog-error-message'),$('simulation-float-gift-catalog-error-message')];
  const giftCatalogRetries=[$('simulation-gift-catalog-retry'),$('simulation-float-gift-catalog-retry')];
  let giftCatalog=[],pickerInput=null,pickerIndex=-1,giftCatalogError=false,giftCatalogLoading=false;
  picker.id='simulation-gift-picker';picker.className='simulation-gift-picker';picker.setAttribute('role','group');picker.setAttribute('aria-label','Catálogo de regalos');picker.hidden=true;
  giftSearch.type='search';giftSearch.className='simulation-gift-search';giftSearch.setAttribute('role','combobox');giftSearch.setAttribute('aria-label','Buscar regalo');giftSearch.setAttribute('aria-autocomplete','list');giftSearch.setAttribute('aria-haspopup','listbox');giftSearch.setAttribute('aria-controls','simulation-gift-options');giftSearch.setAttribute('aria-expanded','false');giftSearch.placeholder='Buscar regalo';giftSearch.autocomplete='off';
  giftSearchStatus.className='simulation-gift-search-status';giftSearchStatus.setAttribute('role','status');giftSearchStatus.setAttribute('aria-live','polite');giftSearchStatus.hidden=true;
  giftPickerRetry.id='simulation-gift-picker-retry';giftPickerRetry.type='button';giftPickerRetry.className='simulation-gift-retry';giftPickerRetry.hidden=true;
  giftOptions.id='simulation-gift-options';giftOptions.className='simulation-gift-options';giftOptions.setAttribute('role','listbox');giftOptions.setAttribute('aria-label','Regalos disponibles');
  picker.append(giftSearch,giftSearchStatus,giftPickerRetry,giftOptions);document.body.append(picker);
  function updateGiftCatalogFeedback(){
    giftCatalogErrors.forEach((error,index)=>{error.hidden=!giftCatalogError;giftCatalogErrorMessages[index].textContent=giftCatalogLoading?'Cargando catálogo de regalos…':'No se pudo cargar el catálogo de regalos. Inténtalo de nuevo.';giftCatalogRetries[index].hidden=!giftCatalogError;giftCatalogRetries[index].disabled=giftCatalogLoading;giftCatalogRetries[index].textContent=giftCatalogLoading?'Cargando…':'Intentar de nuevo';});
    giftPickerRetry.hidden=!giftCatalogError;giftPickerRetry.disabled=giftCatalogLoading;giftPickerRetry.textContent=giftCatalogLoading?'Cargando…':'Intentar de nuevo';
  }
  function closeGiftPicker(restoreFocus=false){const input=pickerInput;picker.hidden=true;input?.setAttribute('aria-expanded','false');giftSearch.setAttribute('aria-expanded','false');giftSearch.removeAttribute('aria-activedescendant');pickerInput=null;pickerIndex=-1;if(restoreFocus&&input)input.focus();}
  function giftArtwork(gift){
    const art=el('span');art.className='simulation-gift-option-art';
    const fallback=()=>{const label=el('span',gift.name);label.className='simulation-gift-option-fallback';art.replaceChildren(label);};
    if(gift.image_url){const image=el('img');image.src=gift.image_url;image.alt='';image.onerror=fallback;art.append(image);}
    else fallback();
    return art;
  }
  function giftDetails(gift){
    const detail=el('span');detail.className='simulation-gift-option-detail';
    detail.append(el('strong',gift.name),el('small',`${Number(gift.diamonds)||0} diamantes`));
    return detail;
  }
  function showGiftSelection(input,gift){
    if(gift){input.dataset.giftName=gift.name;input.textContent=gift.name;input.replaceChildren(giftArtwork(gift),giftDetails(gift));}
    else{delete input.dataset.giftId;input.textContent=input.dataset.giftName||'Seleccionar regalo';}
  }
  function chooseGift(index){
    const gift=giftCatalog[index];if(!gift||!pickerInput)return;
    const input=pickerInput;input.dataset.giftName=gift.name;input.dataset.giftId=String(gift.id);
    showGiftSelection(input,gift);closeGiftPicker(true);
  }
  function positionGiftPicker(input){
    const rect=input.getBoundingClientRect(),below=innerHeight-rect.bottom-8,above=rect.top-8;
    const placeAbove=below<210&&above>below,space=Math.max(120,Math.min(280,(placeAbove?above:below)-8));
    picker.style.left=`${Math.max(8,Math.min(innerWidth-320,rect.left))}px`;
    picker.style.width=`${Math.min(Math.max(rect.width,250),innerWidth-16)}px`;
    picker.style.maxHeight=`${space}px`;picker.style.top=placeAbove?'auto':`${rect.bottom+6}px`;
    picker.style.bottom=placeAbove?`${Math.max(8,innerHeight-rect.top+6)}px`:'auto';
  }
  function renderGiftPicker(input,reset=false){
    if(reset)giftSearch.value='';
    const query=giftSearch.value.trim().toLocaleLowerCase();
    const matches=giftCatalog.map((gift,index)=>({gift,index})).filter(({gift})=>!query||gift.name.toLocaleLowerCase().includes(query));
    giftOptions.replaceChildren();pickerInput=input;pickerIndex=-1;giftSearch.removeAttribute('aria-activedescendant');
    for(const {gift,index} of matches){
      const option=el('div');option.className='simulation-gift-option';option.id=`simulation-gift-option-${index}`;
      option.setAttribute('role','option');option.setAttribute('aria-selected','false');
      option.append(giftArtwork(gift),giftDetails(gift));
      option.addEventListener('mousedown',event=>event.preventDefault());
      option.addEventListener('click',()=>chooseGift(index));giftOptions.append(option);
    }
    giftSearchStatus.textContent=giftCatalogLoading?'Cargando catálogo…':giftCatalogError?'No se pudo cargar el catálogo de regalos.':matches.length?'':giftCatalog.length===0?'El catálogo no contiene regalos disponibles.':`No se encontraron regalos para “${giftSearch.value.trim()}”.`;
    giftSearchStatus.hidden=!giftCatalogLoading&&!giftCatalogError&&matches.length>0;giftPickerRetry.hidden=!giftCatalogError;picker.hidden=false;input.setAttribute('aria-expanded','true');giftSearch.setAttribute('aria-expanded','true');
    positionGiftPicker(input);
  }
  async function loadGiftCatalog(){
    if(giftCatalogLoading)return;
    giftCatalogLoading=true;updateGiftCatalogFeedback();
    try{
      const data=await api('/gift-catalog');
      if(!Array.isArray(data.gifts))throw Error('Catálogo inválido');
      giftCatalog=data.gifts;giftCatalogError=false;
      for(const input of giftInputs){
        const query=(input.dataset.giftName||'').trim().toLocaleLowerCase(),match=giftCatalog.find(gift=>gift.name.toLocaleLowerCase()===query);
        if(match){input.dataset.giftId=String(match.id);showGiftSelection(input,match);}
      }
    }catch(_){giftCatalog=[];giftCatalogError=true;}
    finally{giftCatalogLoading=false;updateGiftCatalogFeedback();if(pickerInput&&!picker.hidden)renderGiftPicker(pickerInput);}
  }
  function onGiftKeydown(event){
    if(event.key==='Tab'){closeGiftPicker();return;}
    if(event.key==='Escape'&&!picker.hidden){event.preventDefault();event.stopPropagation();closeGiftPicker(true);return;}
    if(picker.hidden)return;
    const options=giftOptions.querySelectorAll('[role="option"]');
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){
      if(!options.length)return;
      event.preventDefault();
      pickerIndex=pickerIndex<0?(event.key==='ArrowUp'?options.length-1:0):(pickerIndex+(event.key==='ArrowDown'?1:-1)+options.length)%options.length;
      options.forEach((option,index)=>option.setAttribute('aria-selected',String(index===pickerIndex)));
      giftSearch.setAttribute('aria-activedescendant',options[pickerIndex]?.id||'');
      options[pickerIndex]?.scrollIntoView?.({block:'nearest'});
    }else if(event.key==='Enter'&&pickerIndex>=0){
      event.preventDefault();chooseGift(Number(options[pickerIndex].id.split('-').at(-1)));
    }
  }
  for(const input of giftInputs){
    input.addEventListener('click',()=>{if(picker.hidden||pickerInput!==input){renderGiftPicker(input,true);giftSearch.focus();}});
  }
  giftCatalogRetries.forEach(button=>button.onclick=()=>loadGiftCatalog());
  giftPickerRetry.onclick=()=>loadGiftCatalog();
  giftSearch.addEventListener('input',()=>{if(pickerInput)renderGiftPicker(pickerInput);});
  giftSearch.addEventListener('keydown',onGiftKeydown);
  document.addEventListener('pointerdown',event=>{if(!picker.contains(event.target)&&!giftInputs.includes(event.target))closeGiftPicker();});
  document.addEventListener('scroll',()=>{if(pickerInput&&!picker.hidden)positionGiftPicker(pickerInput);},true);
  addEventListener('resize',()=>{if(pickerInput&&!picker.hidden)positionGiftPicker(pickerInput);});
  loadGiftCatalog();
  try{if(sessionStorage.getItem('tikreader.simulationActive')==='true'){banner.hidden=false;document.body.classList.add('simulation-active');}}catch(_){ }
  setInterval(refresh,1000);setInterval(()=>{if(state.batch&&!document.hidden)progress();},250);refresh();
  window.addEventListener('tikreader:navigation-change',refresh);
  return {apply,refresh,open:openDock};
})();
