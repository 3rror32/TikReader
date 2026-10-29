(()=>{
 const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n};
 const pane=el('section');pane.className='studio-pane';pane.dataset.section='minecraft';const notice=el('p');notice.setAttribute('role','status');
 const stylesheet=el('link');stylesheet.rel='stylesheet';stylesheet.href='/static/minecraft.css';document.head.append(stylesheet);
 async function api(path,data){const operation=operationSerial,mode=currentEdition;const r=await fetch(path,{method:data?'POST':'GET',headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(5000)});const d=await r.json();if(data&&(operation!==operationSerial||mode!==currentEdition))throw Error('La operación ya no corresponde a esta edición.');if(!r.ok)throw Error(d.error||'Error');return d}
 const edited=new Set();
 function field(label,type='text',parent=pane){const l=el('label',label),n=el(type==='textarea'?'textarea':'input');if(type!=='textarea')n.type=type;n.addEventListener('input',()=>edited.add(n));l.append(n);parent.append(l);return n}
 function disclosure(title){const node=el('details');node.append(el('summary',title));return node;}
 let busy=false,uncertain=false,operationSerial=0;const actionButtons=[];
 function syncControls(){for(const b of actionButtons)b.disabled=busy||uncertain||(b.needsBackend&&!backendReady);edition.disabled=busy||uncertain||!backendReady;permission.disabled=busy||uncertain||!backendReady;for(const row of presetRows.values()){row.gift.disabled=busy||uncertain||!backendReady;row.enabled.disabled=busy||uncertain||!backendReady||!row.gift.value;}}
 async function operate(fn){
  if(busy||uncertain)return;
  busy=true;operationSerial++;epoch++;clearTimeout(timer);syncControls();
  try{await fn();}catch(e){notice.textContent=e.message;}
  finally{busy=false;epoch++;syncControls();void refresh();}
 }
 const button=(text,fn,needsBackend=true)=>{const b=el('button',text);b.type='button';b.needsBackend=needsBackend;b.onclick=()=>{if(needsBackend&&!backendReady)return;return operate(fn);};actionButtons.push(b);return b};
 let backendReady=false,confirmedAuthorized=false,savedConfig={commands:{}};
 const header=el('div');header.className='minecraft-header';const heading=el('h2','Minecraft');header.append(heading);pane.append(header);
 const editionLabel=el('label','Edición'),edition=el('select');
 for(const [value,text] of [['java','Java (RCON)'],['bedrock','Bedrock (mundo local)']]){const option=el('option',text);option.value=value;edition.append(option);}
 edition.value='java';editionLabel.append(edition);header.append(editionLabel);
 const permissionArea=el('div');permissionArea.className='minecraft-permission';pane.append(permissionArea);
 const permission=field('Autorizar Minecraft','checkbox',permissionArea);permission.checked=false;
 const connection=disclosure('Conexión Java');connection.className='minecraft-connection';const connectionFields=el('div');connectionFields.className='minecraft-connection-fields';connection.append(connectionFields);pane.append(connection);
 const quickActions=el('section');quickActions.className='minecraft-quick-actions';pane.append(quickActions);
 const host=field('Dirección privada','text',connectionFields),port=field('Puerto RCON','number',connectionFields),password=field('Contraseña RCON','password',connectionFields);
 host.value='127.0.0.1';port.value=25575;
 const advanced=disclosure('Opciones avanzadas'),help=disclosure('Ayuda');
 const commands=field('Comandos autorizados: un alias = comando por línea','textarea',advanced);commands.rows=4;
 const status=el('p','Sin conectar'),log=el('div');status.setAttribute('role','status');header.append(status);
 const localInstructions=el('div'),connectCommand=el('p');
 localInstructions.className='minecraft-bedrock-setup';connectCommand.className='minecraft-connect-command';connectCommand.hidden=true;
 localInstructions.append(el('p','1. Prepara la conexión.  2. Pega el comando en el chat de tu mundo.  3. Marca Autorizar Minecraft.'),el('small','Mundo local de Windows · Trucos activados · Require Encrypted Websockets desactivado.'),connectCommand);
 permissionArea.append(localInstructions);
 help.append(el('p','Java necesita un servidor con RCON habilitado. En server.properties: enable-rcon=true, rcon.password y rcon.port. Un mundo individual sin RCON no es compatible.'),el('p','Bedrock: activa trucos y permisos de administrador; habilita Enable WebSockets si aparece y desactiva Require Encrypted Websockets para esta conexión local. Solo se admite este equipo.'),el('p','Si Bedrock no conecta, revisa los permisos de loopback de Minecraft en Windows. TikReader no cambia opciones de Windows ni del juego.'),el('p','Desconecta antes de cambiar de mundo: el juego puede conservar la conexión al salir. TikReader no verifica continuamente qué mundo está abierto.'),el('p','Las acciones se aplican a @p: el jugador más cercano al origen del comando, no al espectador que envió el regalo. Java usa el origen del servidor; Bedrock, el contexto del jugador conectado.'),el('p','Cada regalo finalizado activa una vez el efecto. Detener cancela pasos pendientes, pero no deshace lo que ya cambió en el mundo. Sin confirmar significa que la respuesta no permite asegurar el resultado.'));
 let currentEdition='java';const drafts=new Map();
 const presetRows=new Map();let presetValues={},presetDirty=false,presetRecovery=false,giftCatalog=[];
 const defaultActions=[['tnt_rain','Lluvia de TNT','5 TNT'],['zombie','Zombi','1 zombi'],['rain','Lluvia','Clima'],['thunder','Tormenta','Clima'],['night','Noche','Hora'],['diamonds','Diamantes','5 diamantes'],['speed','Velocidad II','20 s'],['jump','Salto II','20 s'],['heal','Curación II','Instantánea']].map(([id,name,description])=>({id,name,description}));
 const compatibility=el('p','Conectando con TikReader…');compatibility.className='minecraft-compatibility';
 const catalogNotice=el('p'),actionList=el('div');catalogNotice.setAttribute('role','status');
 function fillGiftOptions(row,value){
  const signature=JSON.stringify([giftCatalog,value.gift_id,value.gift_name]);
  if(row.signature!==signature){
   const options=[['','Selecciona un regalo'],...giftCatalog.map(g=>[String(g.id),g.diamonds?`${g.name} · ${g.diamonds} diamantes`:g.name])];
   if(value.gift_id&&!giftCatalog.some(g=>String(g.id)===value.gift_id))options.push([value.gift_id,`${value.gift_name||value.gift_id} · guardado`]);
   row.gift.replaceChildren(...options.map(([id,name])=>{const option=el('option',name);option.value=id;return option;}));row.signature=signature;
  }
  row.gift.value=value.gift_id;row.enabled.checked=!!value.enabled;
 }
 function renderPresets(d,force=false){
  if(force||!presetDirty)presetValues=structuredClone(d.presets||d.config?.presets||{});
  for(const preset of defaultActions){
   if(presetRows.has(preset.id))continue;
   const node=el('div');node.className='minecraft-action-row';node.dataset.quickAction=preset.id;
   const title=el('div');title.className='minecraft-action-title';title.append(el('strong',preset.name),el('small',preset.description));
   const gift=el('select');gift.dataset.presetGift=preset.id;gift.setAttribute('aria-label','Regalo para '+preset.name);
   const enabled=el('input');enabled.type='checkbox';enabled.dataset.presetEnabled=preset.id;enabled.setAttribute('aria-label','Activar '+preset.name);
   const enabledLabel=el('label');enabledLabel.className='minecraft-action-enabled';enabledLabel.append(enabled);
   const test=button('Probar',async()=>{await api('/minecraft/presets/test',{edition:currentEdition,id:preset.id});notice.textContent='Prueba en cola. Revisa el registro.';});test.setAttribute('aria-label','Probar '+preset.name);test.className='minecraft-action-test';
   node.append(title,gift,enabledLabel,test);actionList.append(node);presetRows.set(preset.id,{gift,enabled});
   for(const control of [gift,enabled])control.addEventListener('change',()=>savePreset(preset.id));
  }
  for(const [id,row] of presetRows)fillGiftOptions(row,presetValues[id]||{gift_id:'',gift_name:'',enabled:false});
  syncControls();
 }
 async function savePreset(id){
  if(busy||uncertain||!backendReady){renderPresets({presets:presetValues},true);return;}
  return operate(async()=>{
   const row=presetRows.get(id),giftId=row.gift.value;
   const name=giftCatalog.find(g=>String(g.id)===giftId)?.name||presetValues[id]?.gift_name||'';
   presetValues={...presetValues,[id]:{gift_id:giftId,gift_name:name,enabled:!!giftId&&row.enabled.checked}};presetDirty=true;
   try{
    const d=await api('/minecraft/presets',{edition:currentEdition,presets:presetValues});
    presetDirty=false;renderPresets(d,true);notice.textContent='Acciones rápidas guardadas.';
   }catch(e){
    try{
     const d=await api('/minecraft');presetDirty=false;
     if(d.edition&&d.edition!==currentEdition){drafts.set(currentEdition,{host:host.value,port:port.value,commands:commands.value});selectProfile(d);}
     renderPresets(d,true);notice.textContent=e.message+' Se muestra la configuración confirmada.';
    }catch(_){
     drafts.set(currentEdition,{host:host.value,port:port.value,commands:commands.value});
     uncertain=true;presetRecovery=true;notice.textContent='No se pudo confirmar el guardado. Espera a que se recupere la conexión.';
    }
   }
  });
 }
 async function loadGiftCatalog(){
  try{const d=await api('/gift-catalog');giftCatalog=Array.isArray(d.gifts)?d.gifts:[];catalogNotice.textContent=giftCatalog.length?'':'Conecta tu LIVE y actualiza los regalos.';}
  catch(_){catalogNotice.textContent='Regalos no disponibles. Puedes actualizar de nuevo.';}
  renderPresets({presets:presetValues},true);
 }
 const actionHeading=el('div');actionHeading.className='minecraft-actions-heading';
 const stopButton=button('Detener',async()=>{await api('/minecraft/presets/stop',{edition:currentEdition});notice.textContent='Acciones pendientes detenidas.';});stopButton.setAttribute('aria-label','Detener acciones rápidas');
 actionHeading.append(el('h3','Acciones predeterminadas'),button('Actualizar regalos',loadGiftCatalog,false),stopButton);
 const columns=el('div');columns.className='minecraft-action-columns';columns.setAttribute('aria-hidden','true');for(const text of ['Acción','Regalo','Activa',''])columns.append(el('span',text));
 quickActions.append(actionHeading,compatibility,catalogNotice,columns,actionList);
 function selectProfile(d){
  currentEdition=d.edition||currentEdition;edited.clear();hydratePending=false;
  password.value='';permission.checked=false;confirmedAuthorized=false;connectCommand.textContent='';connectCommand.hidden=true;showEdition();
  const draft=drafts.get(currentEdition);
  host.value=draft?.host||d.config.host||'127.0.0.1';port.value=draft?.port||d.config.port||25575;
  commands.value=draft?draft.commands:Object.entries(d.config.commands).map(([a,c])=>a+' = '+c).join('\n');
  presetDirty=false;renderPresets(d,true);
 }
 function showEdition(){
  const bedrock=currentEdition==='bedrock';edition.value=currentEdition;
  heading.textContent='Minecraft';connection.hidden=bedrock;
  for(const input of [host,port,password])input.parentElement.hidden=bedrock;
  localInstructions.hidden=!bedrock;prepareButton.hidden=!bedrock;
 }
 const labels={success:'Éxito confirmado',rejected:'Comando rechazado',connection_error:'Error de conexión',unconfirmed:'Sin confirmar',cancelled:'Cancelado'};
 let timer,inFlight=false,refreshPending=false,hydratePending=true,stopped=false,epoch=0;
 const active=()=>pane.isConnected&&!pane.hidden&&!document.hidden&&!stopped;
 function render(d,hydrate){
  backendReady=d.authorization_mode==='checkbox'&&Array.isArray(d.preset_catalog)&&defaultActions.every(p=>d.preset_catalog.some(s=>s.id===p.id));
  compatibility.textContent=backendReady?'':'Reinicia TikReader para cargar estas acciones.';compatibility.hidden=backendReady;
  savedConfig=d.config||savedConfig;
  if(uncertain&&!busy){selectProfile(d);uncertain=false;presetRecovery=false;presetDirty=false;syncControls();hydrate=false;}
  if(hydrate){currentEdition=d.edition||'java';showEdition();for(const [input,value] of [[host,d.config.host||'127.0.0.1'],[port,d.config.port||25575],[commands,Object.entries(d.config.commands).map(([a,c])=>a+' = '+c).join('\n')]])if(!edited.has(input))input.value=value;}
  const bedrock=currentEdition==='bedrock';
  if(!presetRecovery)renderPresets(d);
  confirmedAuthorized=backendReady&&d.authorized===true;permission.checked=confirmedAuthorized;
  status.textContent=(confirmedAuthorized?'Conectado':bedrock&&d.bedrock?.connected?'Mundo conectado':bedrock&&d.bedrock?.prepared?'Esperando tu mundo':'Sin conectar')+(d.queued?` · ${d.queued} en cola`:'');
  syncControls();
  log.replaceChildren(...d.log.slice(0,10).map(x=>{
   const label=labels[x.outcome];
   const detail=label?`${label} · ${x.alias}: ${x.response||x.text}`:x.text;
   return el('p',new Date(x.at*1000).toLocaleTimeString((window.I18n?.locale || 'es-419'))+' · '+detail);
  }));
 }
 async function refresh(){
  clearTimeout(timer);
  if(!active())return;
  if(busy){refreshPending=true;return;}
  if(inFlight){refreshPending=true;return;}
  inFlight=true;const generation=epoch,hydrate=hydratePending;
  try{
   const d=await api('/minecraft');
   if(active()&&generation===epoch){render(d,hydrate);hydratePending=false;}
  }catch(_){if(active()&&generation===epoch){backendReady=false;confirmedAuthorized=false;permission.checked=false;compatibility.hidden=false;compatibility.textContent='No se pudo conectar con TikReader. Reintentando…';status.textContent='Sin conexión';syncControls();}}
  finally{
   inFlight=false;
   if(active()){
    if(refreshPending){refreshPending=false;void refresh();}
    else timer=setTimeout(refresh,1000);
   }
  }
 }
 function sync(){epoch++;clearTimeout(timer);refreshPending=false;if(active())void refresh();}
 async function change(path,data){epoch++;await api(path,data);epoch++;void refresh();}
 function parse(){const out={};for(const line of commands.value.split('\n')){if(!line.trim())continue;const i=line.indexOf('=');if(i<1)throw Error('Usa alias = comando, uno por línea');out[line.slice(0,i).trim()]=line.slice(i+1).trim()}return out}
 const prepareButton=button('Preparar conexión',async()=>{if(currentEdition!=='bedrock')return;confirmedAuthorized=false;permission.checked=false;connectCommand.textContent='';const d=await api('/minecraft/bedrock/prepare',{});connectCommand.textContent=d.command;connectCommand.hidden=false;notice.textContent='Pega el comando en el chat de tu mundo.';});prepareButton.setAttribute('aria-label','Preparar conexión de Bedrock');
 const copyButton=button('Copiar comando',async()=>{if(!connectCommand.textContent){notice.textContent='Prepara la conexión primero.';return;}try{await navigator.clipboard.writeText(connectCommand.textContent);notice.textContent='Comando copiado.';}catch(_){notice.textContent='Selecciona y copia el comando mostrado.';}} ,false);
 localInstructions.append(prepareButton,copyButton);
 async function saveConnection(includeAliases=false){
  confirmedAuthorized=false;permission.checked=false;connectCommand.textContent='';
  const data={edition:currentEdition,commands:includeAliases?parse():savedConfig.commands||{}};
  if(currentEdition==='java')Object.assign(data,{host:host.value,port:Number(port.value),...(password.value?{password:password.value}:{})});
  const d=await api('/minecraft',data);password.value='';edited.delete(host);edited.delete(port);render(d,false);
 }
 connectionFields.append(button('Guardar conexión',async()=>{await saveConnection();notice.textContent='Conexión guardada. Marca Autorizar Minecraft.';}));
 permission.addEventListener('change',()=>{
  const enabled=permission.checked;
  permission.checked=confirmedAuthorized;
  if(busy||uncertain||!backendReady)return;
  return operate(async()=>{
   permission.checked=false;confirmedAuthorized=false;
   try{
    if(enabled&&currentEdition==='java'&&(password.value||host.value!==savedConfig.host||Number(port.value)!==savedConfig.port))await saveConnection();
    await api('/minecraft/authorize',{edition:currentEdition,enabled});
    if(!enabled){connectCommand.textContent='';connectCommand.hidden=true;password.value='';}
    const d=await api('/minecraft');render(d,false);notice.textContent=enabled?'Minecraft conectado.':'Comandos desactivados.';
   }catch(e){
    if(currentEdition==='java'&&enabled)connection.open=true;
    permission.checked=false;confirmedAuthorized=false;
    try{const d=await api('/minecraft');if(d.edition&&d.edition!==currentEdition)selectProfile(d);render(d,false);notice.textContent=e.message;}
    catch(_){drafts.set(currentEdition,{host:host.value,port:port.value,commands:commands.value});uncertain=true;notice.textContent='No se pudo confirmar la autorización. Reintentando…';}
   }
  });
 });
 permissionArea.append(button('Desconectar',async()=>{confirmedAuthorized=false;permission.checked=false;connectCommand.textContent='';connectCommand.hidden=true;await change('/minecraft/disconnect',{});notice.textContent='Minecraft desconectado.';},false),notice);
 advanced.append(button('Guardar conexión y comandos',async()=>{await saveConnection(true);notice.textContent='Comandos guardados. Autoriza de nuevo.';}));
 edition.addEventListener('change',()=>{
  if(busy||uncertain){edition.value=currentEdition;return;}
  const next=edition.value,previous=currentEdition;if(next===previous)return;
  return operate(async()=>{
  drafts.set(previous,{host:host.value,port:port.value,commands:commands.value});
  password.value='';permission.checked=false;confirmedAuthorized=false;connectCommand.textContent='';connectCommand.hidden=true;
  try{
   const d=await api('/minecraft',{edition:next,select_only:true});
   epoch++;
   selectProfile(d);
   render(d,false);notice.textContent='Edición seleccionada.';
  }catch(e){
   try{const d=await api('/minecraft');selectProfile(d);render(d,false);notice.textContent=e.message;}
   catch(_){uncertain=true;edition.value=previous;notice.textContent='No se pudo confirmar la edición. Los controles se reactivarán al recuperar la conexión.';}
  }
  });
 });
 advanced.append(button('Comprobar conexión sin ejecutar un alias',async()=>{const d=await api('/minecraft/check',{});notice.textContent=d.detail;}));
 const testAlias=field('Alias para prueba','text',advanced);advanced.append(button('Ejecutar alias de prueba',async()=>{if(!testAlias.value)throw Error('Escribe un alias guardado');await change('/minecraft/run',{alias:testAlias.value});notice.textContent='Comando enviado a la cola.';}),el('p','Formato: alias = comando. Usa el alias en Interactividad. Variables: {user}, {gift}, {count}.'));
 const activity=disclosure('Registro reciente');activity.className='minecraft-activity';activity.append(log);pane.append(activity,advanced,help);
 window.OperatorViewRegistry.register(pane.dataset.section,pane);
 showEdition();
 renderPresets({});
 new MutationObserver(sync).observe(pane,{attributes:true,attributeFilter:['hidden']});
 // Track both connection edges without refreshing for unrelated DOM changes.
 let connected=pane.isConnected;
 new MutationObserver(()=>{if(connected!==pane.isConnected){connected=pane.isConnected;sync();}}).observe(document.body,{childList:true,subtree:true});
 document.addEventListener('visibilitychange',sync);
 window.addEventListener('pagehide',()=>{stopped=true;sync();});
 window.addEventListener('pageshow',()=>{stopped=false;sync();});
 void refresh();
 void loadGiftCatalog();
})();
