window.SimulationUI = (() => {
  const $ = id => document.getElementById(id);
  const el = (tag, text) => {const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;};
  let state={active:false},busy=false,polling=false,lastGeneration=null,signature='',profileSignature='';
  const banner=el('div');banner.id='simulation-banner';banner.hidden=true;banner.setAttribute('role','status');
  const open=el('button','Abrir simulación');open.type='button';open.onclick=()=>window.Shell?.show('simulation');
  banner.append(el('strong','MODO SIMULACIÓN'),el('span','Eventos simulados · Acciones reales'),open);document.body.prepend(banner);
  new ResizeObserver(()=>document.body.style.setProperty('--simulation-banner-height',`${banner.offsetHeight}px`)).observe(banner);
  async function api(path,data){const response=await fetch(path,{method:data?'POST':'GET',headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined,cache:'no-store',signal:AbortSignal.timeout(10000)});const result=await response.json();if(!response.ok)throw Error(result.error||'No se pudo consultar la simulación');return result;}
  function apply(update){
    if(typeof update.active!=='boolean')return;
    if(update.instance===state.instance&&lastGeneration!==null&&update.generation<lastGeneration)return;
    if(lastGeneration!==null&&update.generation!==lastGeneration){window.Studio?.clearVoice?.();window.TikReaderEffects?.clear();}
    lastGeneration=update.generation;state={...state,...update};
    banner.hidden=!state.active;document.body.classList.toggle('simulation-active',state.active);
    try{sessionStorage.setItem('tikreader.simulationActive',String(state.active));}catch(_){}
    const connect=$('btn-connect');if(connect){connect.disabled=state.active||!!state.connected;connect.title=state.active?'Desactiva el modo simulación para conectar un LIVE.':'';}
    $('simulation-toggle').textContent=state.active?'Desactivar simulación':'Activar simulación';
    $('simulation-fields').disabled=!state.active||!!state.batch?.running||busy;
    $('simulation-stop').disabled=!state.active;
    $('simulation-resume').hidden=!state.active||!state.muted;
    if(!update.events)return;
    const next=JSON.stringify(update.events);
    if(next!==signature){signature=next;const box=$('simulation-chat'),follow=box.scrollHeight-box.scrollTop-box.clientHeight<60;box.replaceChildren();for(const event of update.events){const row=el('article');row.dataset.kind=event.kind;row.append(el('time',new Date(event.at*1000).toLocaleTimeString()),el('strong',event.user),el('p',event.text));box.append(row);}if(!update.events.length)box.append(el('p',state.active?'Escribe un comentario o prepara una racha de regalos.':'Activa la simulación para enviar tu primer evento.'));if(follow)box.scrollTop=box.scrollHeight;}
    const games=update.games,nextProfile=JSON.stringify(games);
    if(nextProfile!==profileSignature){profileSignature=nextProfile;const box=$('simulation-profile');box.replaceChildren(el('strong',games.profile),el('p',games.authorized?(games.paused?'Hotkeys pausadas':'Hotkeys autorizadas'):'Hotkeys sin autorización: actívalas en el perfil de juegos.'));for(const m of games.mappings){const row=el('div');row.className='simulation-profile-rule';row.append(el('strong',`${m.name} · ${m.enabled?'Activa':'Desactivada'}`),el('small',`${m.gift} → ${m.keys.map(k=>k.join(' + ')).join(' → ')}`),el('small',`${m.window} · ${m.target==='foreground'?'Ventana al frente':'Segundo plano'}`));box.append(row);}if(!games.mappings.length)box.append(el('p','No hay acciones en este perfil. Configúralas en Juegos para probar las teclas.'));}
    const records=[...update.traces.map(x=>({at:x.at,text:`${x.rule} · ${x.action||'Regla'} · ${x.outcome}`})),...games.log.map(x=>({at:x.at,text:`${x.mapping||'Hotkeys'} · ${x.text} · ${x.outcome}`})),...update.events.flatMap(x=>x.hotkeys.map(h=>({at:x.at,text:`${h.name} · ${h.result==='Coincide'?'Regla coincide; consulta la ejecución de la tecla':h.result}`})))].sort((a,b)=>b.at-a.at).slice(0,80);
    $('simulation-log').replaceChildren(...records.map(x=>el('p',`${new Date(x.at*1000).toLocaleTimeString()} · ${x.text}`)));
    if(!records.length)$('simulation-log').textContent='Sin acciones registradas. Comprueba que las reglas estén activadas y coincidan con el evento.';
  }
  function progress(){const batch=state.batch;let text='Sin envíos pendientes';if(batch){const seconds=Math.max(0,Math.ceil(batch.starts_at-Date.now()/1000));text=batch.running&&seconds>0?`Envío en ${seconds} s · vuelve al juego`:`${batch.status} · ${batch.sent}/${batch.count}`;}$('simulation-progress').textContent=text;}
  async function refresh(){if(polling)return;polling=true;try{apply(await api('/simulation'));progress();if($('simulation-status').textContent==='Consultando el estado…')$('simulation-status').textContent=state.active?'Simulación activa. Puedes enviar eventos.':'Desconecta el LIVE y activa la simulación para empezar.';}catch(error){$('simulation-status').textContent=error.message+'. Si el modo estaba activo, la franja se mantiene hasta confirmar su desactivación.';}finally{polling=false;}}
  async function action(fn){if(busy)return;busy=true;try{await fn();}catch(error){$('simulation-status').textContent=error.message;}finally{busy=false;await refresh();}}
  $('simulation-toggle').onclick=()=>action(async()=>{apply(await api('/simulation',{action:state.active?'deactivate':'activate'}));if(state.active){await window.TikReaderAudio?.claimForSimulation();$('simulation-status').textContent='Simulación activa. Se utilizan tus reglas guardadas y los overlays habituales.';}else $('simulation-status').textContent='Simulación desactivada. El LIVE sigue desconectado.';});
  $('simulation-stop').onclick=()=>action(async()=>{apply(await api('/simulation',{action:'stop'}));$('simulation-status').textContent='Envíos detenidos y emisión pausada. Reanuda cuando quieras continuar.';});
  $('simulation-resume').onclick=()=>action(async()=>{await window.ProductionUI?.resumeSimulation();$('simulation-status').textContent='Emisión reanudada en la escena Charla. Puedes continuar las pruebas.';});
  $('simulation-audio').onclick=()=>action(async()=>{const owned=await window.TikReaderAudio?.claimForSimulation();$('simulation-status').textContent=owned?'Audio disponible en esta pestaña. La voz y los avisos respetan tus ajustes del LIVE.':'No se pudo obtener el control de audio.';});
  for(const [id,enabled] of [['simulation-games-on',true],['simulation-games-off',false]])$(id).onclick=()=>action(async()=>{await window.GameHotkeysUI.setAll(enabled);$('simulation-status').textContent=enabled?'Juegos activados. Envía el regalo configurado y vuelve al juego durante la espera.':'Todos los juegos desactivados y pulsaciones pendientes canceladas.';});
  $('simulation-form').onsubmit=event=>{event.preventDefault();action(async()=>{const data={kind:$('simulation-kind').value,user:$('simulation-user').value,text:$('simulation-text').value,gift:$('simulation-gift').value,mode:$('simulation-mode').value,count:Number($('simulation-count').value),interval:Number($('simulation-interval').value),delay:Number($('simulation-delay').value),diamonds:Number($('simulation-diamonds').value)};apply(await api('/simulation/events',data));$('simulation-status').textContent='Envío programado. Puedes cambiar al juego o a una ventana de overlay.';});};
  $('simulation-kind').onchange=()=>{const gift=$('simulation-kind').value==='gift';$('simulation-gift-fields').hidden=!gift;$('simulation-comment-label').hidden=gift;$('simulation-send').textContent=gift?'Enviar regalos':'Enviar comentario';};
  $('simulation-mode').onchange=()=>{$('simulation-rachainfo').textContent=$('simulation-mode').value==='streak'?'La racha pasa por 1, 2, 3… hasta N y termina sin contar dos veces el último regalo.':'Cada envío tiene su propio identificador y cantidad 1. Se respetan los tiempos de espera entre activaciones.';};
  document.querySelectorAll('[data-simulation-open]').forEach(b=>b.onclick=()=>window.Shell?.show(b.dataset.simulationOpen));
  api('/gift-catalog').then(data=>{for(const gift of data.gifts){const option=el('option');option.value=gift.name;$('simulation-gifts').append(option);}}).catch(()=>{});
  try{if(sessionStorage.getItem('tikreader.simulationActive')==='true'){banner.hidden=false;document.body.classList.add('simulation-active');}}catch(_){}
  setInterval(refresh,1000);setInterval(progress,250);refresh();
  return {apply,refresh};
})();
