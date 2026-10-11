(() => {
  const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
  async function api(path,data){const r=await fetch(path,{method:data?'POST':'GET',headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(15000)});const d=await r.json();if(!r.ok)throw Error(d.error||'No se pudo completar la acción');return d;}
  function page(key,title,copy){const p=el('section');p.className='studio-pane integration-page';p.dataset.section=key;p.append(el('h2',title),el('p',copy));window.OperatorViewRegistry.register(key,p);const status=el('p');status.role='status';p.append(status);return {p,status};}
  function field(p,text,type='text'){const label=el('label',text),input=el(type==='select'?'select':type==='textarea'?'textarea':'input');if(input.tagName==='INPUT')input.type=type;label.append(input);p.append(label);return input;}
  function button(p,text,fn,status){const b=el('button',text);b.type='button';b.onclick=async()=>{b.disabled=true;try{await fn();}catch(e){status.textContent=e.message;}finally{b.disabled=false;}};p.append(b);return b;}
  function options(select,items){select.replaceChildren(...items.map(([value,text])=>{const o=el('option',text);o.value=value;return o;}));}
  const style=el('style');style.textContent='.integration-page{max-width:1000px}.integration-page label{display:block;margin:14px 0}.integration-page input:not([type=checkbox]),.integration-page select,.integration-page textarea{display:block;width:100%;max-width:640px;margin-top:6px}.integration-page button{margin:4px 8px 4px 0}.integration-page article{border-top:1px solid #2c3a4b;padding:14px 0}.event-trace{max-height:65vh;overflow:auto}.event-trace article p{margin:4px 0}.integration-page [role=status]{color:#85dec5;overflow-wrap:anywhere}';document.head.append(style);

  const {p:obs,status:os}=page('obs-direct','Control de Stream','Cambia escenas y muestra u oculta fuentes en el programa de Stream de esta computadora. Activa allí los ajustes del servidor WebSocket.');
  const port=field(obs,'Puerto WebSocket','number');port.value=4455;port.min=1024;port.max=65535;
  const password=field(obs,'Contraseña de Stream (solo durante esta ejecución)','password');password.autocomplete='off';
  const enabled=field(obs,'Permitir cambios desde TikReader','checkbox');
  async function saveOBS(){await api('/obs-direct',{port:Number(port.value),password:password.value,enabled:enabled.checked});password.value='';os.textContent='Conexión configurada. Pulsa Consultar escenas para verificarla.';}
  button(obs,'Guardar conexión',saveOBS,os);
  const scene=field(obs,'Escena','select'),source=field(obs,'Fuente de la escena','select');
  async function sources(){if(!scene.value){options(source,[]);return;}const d=await api('/obs-direct/sources?scene='+encodeURIComponent(scene.value));options(source,(d.sceneItems||[]).map(s=>[s.sourceName,`${s.sourceName} · ${s.sceneItemEnabled?'visible':'oculta'}`]));}
  button(obs,'Consultar escenas',async()=>{await saveOBS();const d=await api('/obs-direct/scenes');options(scene,(d.scenes||[]).map(s=>[s.sceneName,s.sceneName]));scene.value=d.currentProgramSceneName;await sources();os.textContent='Conectado. Escena en emisión: '+d.currentProgramSceneName;},os);
  scene.onchange=()=>sources().catch(e=>os.textContent=e.message);
  button(obs,'Poner escena en emisión',async()=>{if(!scene.value)throw Error('Consulta y selecciona una escena');await api('/obs-direct/action',{action:'obs_scene',value:scene.value});os.textContent='Stream confirmó el cambio de escena.';},os);
  for(const [label,action] of [['Mostrar fuente','obs_show'],['Ocultar fuente','obs_hide']])button(obs,label,async()=>{if(!source.value)throw Error('Selecciona una fuente');await api('/obs-direct/action',{action,value:scene.value+'|'+source.value});await sources();os.textContent='Stream confirmó el cambio de fuente.';},os);
  obs.append(el('p','En Automatizaciones avanzadas puedes elegir Cambiar escena de Stream, Mostrar fuente de Stream u Ocultar fuente de Stream. Para una fuente, escribe Escena|Fuente en el campo de valor.'));
  api('/obs-direct').then(d=>{port.value=d.port;enabled.checked=d.enabled;}).catch(e=>os.textContent=e.message);

  const {p:bot,status:bs}=page('chatbot','Chatbot de TikTok','Responde a comandos y publica un recordatorio periódico mientras el LIVE está conectado. Usa {usuario} en las respuestas para mencionar el nombre.');
  bot.append(el('p','El envío usa Eulerstream y requiere Premium Routes y un token OAuth con permiso de chat. Al activar, los mensajes se envían a TikTok mediante ese servicio. Las credenciales permanecen en memoria y debes ingresarlas otra vez al reiniciar.'));
  const docs=el('a','Configurar autorización en Eulerstream');docs.href='https://www.eulerstream.com/docs/oauth';docs.target='_blank';docs.rel='noopener';bot.append(docs);
  const apiKey=field(bot,'Clave API de Eulerstream','password'),oauth=field(bot,'Token de acceso OAuth de Eulerstream','password');apiKey.autocomplete=oauth.autocomplete='off';
  const botUser=field(bot,'Usuario de la cuenta que responde (sin @)'),active=field(bot,'Activar respuestas y recordatorios','checkbox');
  const rows=el('div');bot.append(el('h3','Comandos'),rows);let commands=[];
  function render(){rows.replaceChildren();commands.forEach((c,i)=>{const row=el('article'),command=field(row,'Comando'),reply=field(row,'Respuesta'),cooldown=field(row,'Intervalo mínimo (segundos)','number');command.value=c.command;reply.value=c.reply;reply.maxLength=150;cooldown.value=c.cooldown;cooldown.min=10;cooldown.max=3600;command.oninput=()=>c.command=command.value;reply.oninput=()=>c.reply=reply.value;cooldown.oninput=()=>c.cooldown=Number(cooldown.value);button(row,'Eliminar comando',()=>{commands.splice(i,1);render();},bs);rows.append(row);});}
  button(bot,'Añadir comando',()=>{commands.push({command:'!hola',reply:'Hola, {usuario}',cooldown:30});render();},bs);
  const message=field(bot,'Recordatorio periódico (vacío = desactivado)'),interval=field(bot,'Intervalo del recordatorio (segundos)','number');message.maxLength=150;interval.min=60;interval.max=3600;interval.value=300;
  async function saveBot(forget=false){const d=await api('/chatbot',{commands,message:message.value,interval:Number(interval.value),bot_user:botUser.value,enabled:forget?false:active.checked,api_key:forget?'':apiKey.value,oauth_token:forget?'':oauth.value,forget_credentials:forget});apiKey.value=oauth.value='';active.checked=d.enabled;bs.textContent=d.enabled?'Chatbot activo. Respeta una separación mínima de 5 segundos entre mensajes.':'Configuración guardada; chatbot desactivado.';}
  button(bot,'Guardar chatbot',()=>saveBot(),bs);button(bot,'Desactivar y olvidar credenciales',()=>saveBot(true),bs);
  const sample=field(bot,'Comando para probar sin publicar');sample.value='!hola';const result=el('p');bot.append(result);
  button(bot,'Probar respuesta guardada sin publicar',async()=>{const d=await api('/chatbot/preview',{text:sample.value,user:'Espectador'});result.textContent=d.reply;bs.textContent='Prueba local: no se envió ningún mensaje.';},bs);
  const log=el('div');bot.append(el('h3','Actividad del chatbot'),log);
  button(bot,'Actualizar actividad',async()=>{const d=await api('/chatbot');log.replaceChildren(...d.log.map(x=>el('p',new Date(x.at*1000).toLocaleTimeString()+' · '+x.text)));if(!d.log.length)log.textContent='Todavía no hay envíos.';},bs);
  api('/chatbot').then(d=>{commands=d.commands;render();message.value=d.message;interval.value=d.interval;botUser.value=d.bot_user;active.checked=d.enabled;bs.textContent=d.credentials_set?'Credenciales disponibles durante esta ejecución.':'Configura las credenciales para poder activar el envío.';}).catch(e=>bs.textContent=e.message);

  const {p:trace,status:ts}=page('event-diagnostics','Diagnóstico de eventos','Revisa qué regla coincidió, qué quedó en espera y por qué se omitió una acción. Se conservan los últimos 500 registros de esta ejecución.');
  const query=field(trace,'Buscar por evento, regla o motivo'),filter=field(trace,'Mostrar','select');options(filter,[['all','Todos'],['omitted','Omitidos y errores'],['pending','En espera'],['done','Ejecutados']]);
  const records=el('div');records.className='event-trace';trace.append(records);let traces=[];
  function drawTrace(){const q=query.value.toLowerCase();const list=traces.filter(r=>JSON.stringify(r).toLowerCase().includes(q)).filter(r=>filter.value==='all'||(filter.value==='pending'?/espera|cola|aceptada/i:filter.value==='done'?/confirm|ejecutad/i:/omit|no coincide|intervalo|límite|silenc|duplicad|sin |desactiv|cancel|caduc|rechaz|bloquead|no se pudo/i).test(r.outcome));records.replaceChildren(...list.map(r=>{const row=el('article');row.append(el('strong',r.rule+' · '+r.outcome),el('p',new Date(r.at*1000).toLocaleTimeString()+' · Evento '+(r.event||'—')+' · '+(r.action||'Regla')));return row;}));if(!list.length)records.textContent='No hay registros que coincidan.';ts.textContent=`${list.length} de ${traces.length} registros`;}
  query.oninput=filter.onchange=drawTrace;
  async function refresh(){const d=await api('/reliability/trace');traces=d.records;drawTrace();}
  button(trace,'Actualizar diagnóstico',refresh,ts);
  setInterval(()=>{if(!trace.hidden&&!document.hidden)refresh().catch(e=>ts.textContent=e.message);},2000);
})();
