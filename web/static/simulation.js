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
    <div class="simulation-float-tabs" role="tablist" aria-label="Vista del simulador"><button type="button" role="tab" aria-selected="true" data-simulation-float-tab="chat"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 5.5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-5.5 3v-3H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z"/><path d="M7.5 10h9M7.5 13h6"/></svg><span class="simulation-float-tab-label">Chat</span></button><button type="button" role="tab" aria-selected="false" data-simulation-float-tab="activity"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 19V5M4 19h16M7 15l4-4 3 2 5-6"/></svg><span class="simulation-float-tab-label">Actividad</span><span id="simulation-float-activity-count">0</span></button></div>
    <div id="simulation-float-chat-view" class="simulation-float-view" role="tabpanel">
      <div id="simulation-float-feed" class="simulation-float-feed" role="log" aria-live="polite"><p>Activa la simulación para enviar un mensaje.</p></div>
      <form id="simulation-float-form">
        <fieldset id="simulation-float-fields" disabled>
          <div class="simulation-float-row">
            <label><span>Usuario</span><input id="simulation-float-user" value="simulador" maxlength="24" autocomplete="off" required></label>
            <label><span>Evento</span><select id="simulation-float-kind"><option value="comment">Comentario</option><option value="gift">Regalo</option></select></label>
          </div>
          <label id="simulation-float-comment-label"><span>Mensaje</span><textarea id="simulation-float-text" rows="2" maxlength="400" placeholder="Escribe lo que enviaría el espectador…"></textarea></label>
          <div id="simulation-float-gift-fields" class="simulation-float-row" hidden>
            <label><span>Regalo</span><input id="simulation-float-gift" list="simulation-gifts" value="Rose" maxlength="100"></label>
            <label><span>Cantidad</span><input id="simulation-float-count" type="number" min="1" max="9999" step="1" value="1"></label>
          </div>
          <div class="simulation-float-send-row"><label><span>Espera</span><span class="simulation-float-number"><input id="simulation-float-delay" type="number" min="0" max="60" step="1" value="0"><em>s</em></span></label><button id="simulation-float-send" type="submit">Enviar ahora</button></div>
        </fieldset>
      </form>
    </div>
    <div id="simulation-float-activity-view" class="simulation-float-view" role="tabpanel" hidden><div id="simulation-float-log" class="simulation-float-log"><p>Las reglas y acciones aparecerán aquí.</p></div></div>
    <footer><span id="simulation-float-progress">Sin envíos pendientes</span><button id="simulation-float-stop" type="button" aria-label="Detener envíos" disabled><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="6" y="6" width="12" height="12" rx="1.5"/></svg><span>Detener</span></button></footer>`;
  document.body.append(dock,dockButton);

  async function api(path,data){const response=await fetch(path,{method:data?'POST':'GET',headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined,cache:'no-store',signal:AbortSignal.timeout(10000)});const result=await response.json();if(!response.ok)throw Error(result.error||'No se pudo consultar la simulación');return result;}
  function mainStatus(text){const output=$('simulation-status');if(output)output.textContent=text;}
  function recordsFor(update){const games=update.games||{log:[]};return [...(update.traces||[]).map(x=>({at:x.at,text:`${x.rule} · ${x.action||'Regla'} · ${x.outcome}`})),...(games.log||[]).map(x=>({at:x.at,text:`${x.mapping||'Hotkeys'} · ${x.text} · ${x.outcome}`})),...(update.events||[]).flatMap(x=>(x.hotkeys||[]).map(h=>({at:x.at,text:`${h.name} · ${h.result==='Coincide'?'Regla coincide; consulta la ejecución de la tecla':h.result}`})))].sort((a,b)=>b.at-a.at).slice(0,80);}
  function renderDockEvents(update){
    const events=update.events||[],next=JSON.stringify(events.map(x=>x.id));
    if(next!==dockEventSignature){
      const firstRender=dockEventSignature==='';dockEventSignature=next;
      const box=$('simulation-float-feed'),follow=box.scrollHeight-box.scrollTop-box.clientHeight<48;box.replaceChildren();
      for(const event of events.slice(-30)){const row=el('article');row.dataset.kind=event.kind;row.append(el('time',new Date(event.at*1000).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'})),el('strong',event.user),el('p',event.text));box.append(row);}
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
    $('simulation-float-activate').textContent=state.active?'Desactivar':'Activar';
    $('simulation-float-activate').classList.toggle('is-on',state.active);
    $('simulation-float-fields').disabled=!state.active||batchRunning||busy;
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
    $('simulation-fields').disabled=!state.active||!!state.batch?.running||busy;
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
  async function toggleSimulation(){apply(await api('/simulation',{action:state.active?'deactivate':'activate'}));if(state.active){await window.TikReaderAudio?.claimForSimulation();mainStatus('Simulación activa. Se utilizan tus reglas guardadas y los overlays habituales.');}else mainStatus('Simulación desactivada. El LIVE sigue desconectado.');}
  async function stopSimulation(){apply(await api('/simulation',{action:'stop'}));mainStatus('Envíos detenidos y emisión pausada. Reanuda cuando quieras continuar.');}

  function openDock(){dock.hidden=false;dockButton.hidden=true;dockButton.setAttribute('aria-expanded','true');dockButton.classList.remove('has-unread');restoreDockPosition();renderDock();requestAnimationFrame(()=>$('simulation-float-text').focus());}
  function closeDock(){dock.hidden=true;dockButton.hidden=false;dockButton.setAttribute('aria-expanded','false');dockButton.focus();}
  function setDockTab(tab){for(const button of dock.querySelectorAll('[data-simulation-float-tab]'))button.setAttribute('aria-selected',String(button.dataset.simulationFloatTab===tab));$('simulation-float-chat-view').hidden=tab!=='chat';$('simulation-float-activity-view').hidden=tab!=='activity';}
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
  $('simulation-float-kind').onchange=()=>{const gift=$('simulation-float-kind').value==='gift';$('simulation-float-gift-fields').hidden=!gift;$('simulation-float-comment-label').hidden=gift;$('simulation-float-send').textContent=gift?'Enviar regalo':'Enviar ahora';};
  $('simulation-float-form').onsubmit=event=>{event.preventDefault();action(async()=>{const kind=$('simulation-float-kind').value;const data={kind,user:$('simulation-float-user').value,text:$('simulation-float-text').value,gift:$('simulation-float-gift').value,mode:'separate',count:Number($('simulation-float-count').value),interval:.5,delay:Number($('simulation-float-delay').value),diamonds:1};apply(await api('/simulation/events',data));mainStatus('Evento enviado desde el panel flotante. Observa la pantalla y la pestaña Actividad.');if(kind==='comment')$('simulation-float-text').select();});};
  installDockDrag();
  addEventListener('resize',()=>{if(!dock.hidden)restoreDockPosition();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!dock.hidden&&!event.defaultPrevented)closeDock();});

  $('simulation-toggle').onclick=()=>action(toggleSimulation);
  $('simulation-stop').onclick=()=>action(stopSimulation);
  $('simulation-resume').onclick=()=>action(async()=>{await window.ProductionUI?.resumeSimulation();mainStatus('Emisión reanudada en la escena Charla. Puedes continuar las pruebas.');});
  $('simulation-audio').onclick=()=>action(async()=>{const owned=await window.TikReaderAudio?.claimForSimulation();mainStatus(owned?'Audio disponible en esta pestaña. La voz y los avisos respetan tus ajustes del LIVE.':'No se pudo obtener el control de audio.');});
  for(const [id,enabled] of [['simulation-games-on',true],['simulation-games-off',false]])$(id).onclick=()=>action(async()=>{await window.GameHotkeysUI.setAll(enabled);mainStatus(enabled?'Juegos activados. Envía el regalo configurado y vuelve al juego durante la espera.':'Todos los juegos desactivados y pulsaciones pendientes canceladas.');});
  $('simulation-form').onsubmit=event=>{event.preventDefault();action(async()=>{const data={kind:$('simulation-kind').value,user:$('simulation-user').value,text:$('simulation-text').value,gift:$('simulation-gift').value,mode:$('simulation-mode').value,count:Number($('simulation-count').value),interval:Number($('simulation-interval').value),delay:Number($('simulation-delay').value),diamonds:Number($('simulation-diamonds').value)};apply(await api('/simulation/events',data));mainStatus('Envío programado. Puedes cambiar al juego o a una ventana de overlay.');});};
  $('simulation-kind').onchange=()=>{const gift=$('simulation-kind').value==='gift';$('simulation-gift-fields').hidden=!gift;$('simulation-comment-label').hidden=gift;$('simulation-send').textContent=gift?'Enviar regalos':'Enviar comentario';};
  $('simulation-mode').onchange=()=>{$('simulation-rachainfo').textContent=$('simulation-mode').value==='streak'?'La racha pasa por 1, 2, 3… hasta N y termina sin contar dos veces el último regalo.':'Cada envío tiene su propio identificador y cantidad 1. Se respetan los tiempos de espera entre activaciones.';};
  document.querySelectorAll('[data-simulation-open]').forEach(button=>button.onclick=()=>window.Shell?.show(button.dataset.simulationOpen));
  api('/gift-catalog').then(data=>{for(const gift of data.gifts){const option=el('option');option.value=gift.name;$('simulation-gifts').append(option);}}).catch(()=>{});
  try{if(sessionStorage.getItem('tikreader.simulationActive')==='true'){banner.hidden=false;document.body.classList.add('simulation-active');}}catch(_){ }
  setInterval(refresh,1000);setInterval(()=>{if(state.batch&&!document.hidden)progress();},250);refresh();
  window.addEventListener('tikreader:navigation-change',refresh);
  return {apply,refresh,open:openDock};
})();
