(()=>{
 const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n};
 const pane=el('section');pane.className='studio-pane';pane.dataset.section='minecraft';const notice=el('p');notice.setAttribute('role','status');
 const stylesheet=el('link');stylesheet.rel='stylesheet';stylesheet.href='/static/minecraft.css';document.head.append(stylesheet);
 async function api(path,data){const operation=operationSerial,mode=currentEdition;const r=await fetch(path,{method:data?'POST':'GET',headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(5000)});const d=await r.json();if(data&&(operation!==operationSerial||mode!==currentEdition))throw Error('La operación ya no corresponde a esta edición.');if(!r.ok)throw Error(d.error||'Error');return d}
 const edited=new Set();
 function field(label,type='text'){const l=el('label',label),n=el(type==='textarea'?'textarea':'input');if(type!=='textarea')n.type=type;n.addEventListener('input',()=>edited.add(n));l.append(n);pane.append(l);return n}
 let busy=false,uncertain=false,operationSerial=0;const actionButtons=[];
 function syncControls(){for(const b of actionButtons)b.disabled=busy||uncertain;edition.disabled=busy||uncertain;for(const row of presetRows.values()){row.gift.disabled=busy||uncertain;row.enabled.disabled=busy||uncertain||!row.gift.value;}}
 async function operate(fn){
  if(busy||uncertain)return;
  busy=true;operationSerial++;epoch++;clearTimeout(timer);syncControls();
  try{await fn();}catch(e){notice.textContent=e.message;}
  finally{busy=false;epoch++;syncControls();void refresh();}
 }
 const button=(text,fn)=>{const b=el('button',text);b.type='button';b.onclick=()=>operate(fn);actionButtons.push(b);return b};
 const heading=el('h2'),intro=el('p');pane.append(heading,intro);
 const editionLabel=el('label','Edición'),edition=el('select');
 for(const [value,text] of [['java','Java (RCON)'],['bedrock','Bedrock (mundo local)']]){const option=el('option',text);option.value=value;edition.append(option);}
 edition.value='java';editionLabel.append(edition);pane.append(editionLabel);
 const quickActions=el('section');quickActions.className='minecraft-quick-actions';pane.append(quickActions);
 const host=field('Dirección privada'),port=field('Puerto RCON','number'),password=field('Contraseña RCON','password'),commands=field('Comandos autorizados: un alias = comando por línea','textarea');
 commands.rows=8;commands.placeholder='zombi = summon zombie ~ ~ ~\ntormenta = weather thunder 30\npremio = give Jugador minecraft:diamond 1';
 const confirmation=field('Escribe AUTORIZAR MINECRAFT');const status=el('p'),log=el('div');
 const localInstructions=el('div'),connectCommand=el('p');
 localInstructions.append(el('p','Solo Minecraft Bedrock para Windows y un mundo de este equipo. Activa trucos y permisos de administrador en tu mundo; habilita Enable WebSockets si aparece y desactiva Require Encrypted Websockets para esta conexión local. TikReader no cambia esas opciones.'),el('p','Prepara la conexión, copia el comando mostrado y ejecútalo en el chat del mundo. Después escribe AUTORIZAR MINECRAFT y autoriza. Si Windows bloquea el acceso de la aplicación al bucle local, revisa los permisos de loopback de Minecraft; no se modifica Windows ni se usa una dirección de red alternativa.'),el('p','Desconecta aquí antes de cambiar de mundo: el juego puede conservar la conexión al salir y TikReader no puede verificar continuamente qué mundo está abierto.'),connectCommand);
 pane.append(localInstructions);
 let currentEdition='java';const drafts=new Map();
 const presetRows=new Map();let presetValues={},presetDirty=false,presetRecovery=false,giftCatalog=[];
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
  for(const preset of d.preset_catalog||[]){
   if(presetRows.has(preset.id))continue;
   const node=el('div');node.className='minecraft-action-row';node.dataset.quickAction=preset.id;
   const title=el('div');title.className='minecraft-action-title';title.append(el('strong',preset.name),el('small',preset.description));
   const gift=el('select');gift.dataset.presetGift=preset.id;gift.setAttribute('aria-label','Regalo para '+preset.name);
   const enabled=el('input');enabled.type='checkbox';enabled.dataset.presetEnabled=preset.id;enabled.setAttribute('aria-label','Activar '+preset.name);
   const enabledLabel=el('label','Activada');enabledLabel.className='minecraft-action-enabled';enabledLabel.append(enabled);
   const test=button('Probar '+preset.name,async()=>{await api('/minecraft/presets/test',{edition:currentEdition,id:preset.id});notice.textContent='Acción de prueba en cola. Consulta el resultado en el registro.';});test.className='minecraft-action-test';
   node.append(title,gift,enabledLabel,test);actionList.append(node);presetRows.set(preset.id,{gift,enabled});
   for(const control of [gift,enabled])control.addEventListener('change',()=>savePreset(preset.id));
  }
  for(const [id,row] of presetRows)fillGiftOptions(row,presetValues[id]||{gift_id:'',gift_name:'',enabled:false});
  syncControls();
 }
 async function savePreset(id){
  if(busy||uncertain){renderPresets({presets:presetValues},true);return;}
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
  try{const d=await api('/gift-catalog');giftCatalog=Array.isArray(d.gifts)?d.gifts:[];catalogNotice.textContent=giftCatalog.length?`${giftCatalog.length} regalos disponibles.`:'No hay catálogo de regalos. Conecta tu LIVE y pulsa Actualizar regalos; las selecciones guardadas se conservan.';}
  catch(_){catalogNotice.textContent='No se pudo actualizar el catálogo. Las selecciones guardadas se conservan.';}
  renderPresets({presets:presetValues},true);
 }
 quickActions.append(el('h3','Acciones rápidas por regalo'),el('p','Cada regalo finalizado activa una vez el efecto fijo. Activar controla futuros regalos; no crea un bucle. @p es el jugador más cercano al origen del comando, no quien envió el regalo: Java usa el origen del servidor y Bedrock el contexto del jugador conectado.'),button('Actualizar regalos',loadGiftCatalog),button('Detener acciones rápidas',async()=>{await api('/minecraft/presets/stop',{edition:currentEdition});notice.textContent='Se cancelaron las acciones rápidas pendientes y los pasos restantes. Los cambios ya realizados en el mundo no se deshacen.';}),catalogNotice,actionList);
 function selectProfile(d){
  currentEdition=d.edition||currentEdition;edited.clear();hydratePending=false;
  password.value='';confirmation.value='';connectCommand.textContent='';showEdition();
  const draft=drafts.get(currentEdition);
  host.value=draft?.host||d.config.host||'127.0.0.1';port.value=draft?.port||d.config.port||25575;
  commands.value=draft?draft.commands:Object.entries(d.config.commands).map(([a,c])=>a+' = '+c).join('\n');
  presetDirty=false;renderPresets(d,true);
 }
 function showEdition(){
  const bedrock=currentEdition==='bedrock';edition.value=currentEdition;
  heading.textContent=bedrock?'Minecraft Bedrock · mundo local':'Minecraft Java por RCON';
  intro.textContent=bedrock?'Conecta tu mundo local a TikReader. Solo se ejecutan los alias guardados para Bedrock.':'Conecta un servidor Java con RCON de este equipo o de tu red privada; un mundo individual sin servidor RCON no es compatible. La contraseña permanece en memoria.';
  for(const input of [host,port,password])input.parentElement.hidden=bedrock;
  localInstructions.hidden=!bedrock;prepareButton.hidden=!bedrock;
  authorizeButton.textContent=bedrock?'Autorizar y probar Bedrock':'Autorizar y probar RCON';
 }
 const labels={success:'Éxito confirmado',rejected:'Comando rechazado',connection_error:'Error de conexión',unconfirmed:'Sin confirmar',cancelled:'Cancelado'};
 let timer,inFlight=false,refreshPending=false,hydratePending=true,stopped=false,epoch=0;
 const active=()=>pane.isConnected&&!pane.hidden&&!document.hidden&&!stopped;
 function render(d,hydrate){
  if(uncertain&&!busy){selectProfile(d);uncertain=false;presetRecovery=false;presetDirty=false;syncControls();hydrate=false;}
  if(hydrate){currentEdition=d.edition||'java';showEdition();for(const [input,value] of [[host,d.config.host||'127.0.0.1'],[port,d.config.port||25575],[commands,Object.entries(d.config.commands).map(([a,c])=>a+' = '+c).join('\n')]])if(!edited.has(input))input.value=value;}
  const bedrock=currentEdition==='bedrock';
  if(!presetRecovery)renderPresets(d);
  status.textContent=(bedrock?(d.authorized?'Bedrock autorizado · listo':d.bedrock?.connected?'Mundo conectado · falta autorización':d.bedrock?.prepared?'Esperando el mundo local':'Bedrock desconectado'):(d.authorized?'RCON autorizado · listo':'RCON desconectado'))+(d.queued?` · En cola: ${d.queued}`:'');
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
  }catch(_){if(active()&&generation===epoch)status.textContent='No se pudo actualizar el registro. Reintentando…';}
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
 const prepareButton=button('Preparar conexión de Bedrock',async()=>{if(currentEdition!=='bedrock')throw Error('Selecciona Bedrock primero.');epoch++;connectCommand.textContent='';const d=await api('/minecraft/bedrock/prepare',{});epoch++;connectCommand.textContent=d.command;notice.textContent='Ejecuta este comando en tu mundo local y luego autoriza.';void refresh();});
 const authorizeButton=button('Autorizar y probar RCON',async()=>{await change('/minecraft/authorize',{confirmation:confirmation.value});confirmation.value='';notice.textContent='Minecraft conectado y autorizado.';});
 pane.append(prepareButton,button('Guardar conexión y comandos',async()=>{connectCommand.textContent='';await change('/minecraft',{edition:currentEdition,...(currentEdition==='java'?{host:host.value,port:Number(port.value),...(password.value?{password:password.value}:{})}:{}),commands:parse()});password.value='';notice.textContent='Guardado. Autoriza de nuevo la conexión.';}),authorizeButton,button('Desconectar',async()=>{connectCommand.textContent='';await change('/minecraft/disconnect',{});notice.textContent='Minecraft desconectado.';}),status);
 edition.addEventListener('change',()=>{
  if(busy||uncertain){edition.value=currentEdition;return;}
  const next=edition.value,previous=currentEdition;if(next===previous)return;
  return operate(async()=>{
  drafts.set(previous,{host:host.value,port:port.value,commands:commands.value});
  password.value='';confirmation.value='';connectCommand.textContent='';
  try{
   const d=await api('/minecraft',{edition:next,select_only:true});
   epoch++;
   selectProfile(d);
   render(d,false);notice.textContent='Edición seleccionada. Guarda tus alias y autoriza la conexión.';
  }catch(e){
   try{const d=await api('/minecraft');selectProfile(d);render(d,false);notice.textContent=e.message;}
   catch(_){uncertain=true;edition.value=previous;notice.textContent='No se pudo confirmar la edición. Los controles se reactivarán al recuperar la conexión.';}
  }
  });
 });
 pane.append(button('Comprobar conexión sin ejecutar un alias',async()=>{const d=await api('/minecraft/check',{});notice.textContent=d.detail;}));
 const testAlias=field('Alias para prueba');pane.append(button('Ejecutar alias de prueba',async()=>{if(!testAlias.value)throw Error('Escribe un alias guardado');await change('/minecraft/run',{alias:testAlias.value});notice.textContent='Comando enviado a la cola.';}),el('p','En Interactividad selecciona “Comando autorizado de Minecraft” y escribe el alias. Puedes usar {user}, {gift} y {count} dentro del comando.'),el('h3','Registro reciente'),el('p','El registro se actualiza automáticamente. Sin confirmar significa que la respuesta no permite asegurar el resultado.'),log,notice);
 window.OperatorViewRegistry.register(pane.dataset.section,pane);
 showEdition();
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
