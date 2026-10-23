(()=>{
 const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n};
 const pane=el('section');pane.className='studio-pane';pane.dataset.section='minecraft';const notice=el('p');notice.setAttribute('role','status');
 async function api(path,data){const r=await fetch(path,{method:data?'POST':'GET',headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(5000)});const d=await r.json();if(!r.ok)throw Error(d.error||'Error');return d}
 const edited=new Set();
 function field(label,type='text'){const l=el('label',label),n=el(type==='textarea'?'textarea':'input');if(type!=='textarea')n.type=type;n.addEventListener('input',()=>edited.add(n));l.append(n);pane.append(l);return n}
 const button=(text,fn)=>{const b=el('button',text);b.type='button';b.onclick=async()=>{b.disabled=true;try{await fn()}catch(e){notice.textContent=e.message}finally{b.disabled=false}};return b};
 pane.append(el('h2','Minecraft Java por RCON'),el('p','Conecta un servidor local o de tu red privada. Solo se ejecutan los alias guardados aquí; la contraseña permanece en memoria y se borra al reiniciar.'));
 const host=field('Dirección privada'),port=field('Puerto RCON','number'),password=field('Contraseña RCON','password'),commands=field('Comandos autorizados: un alias = comando por línea','textarea');
 commands.rows=8;commands.placeholder='zombi = summon zombie ~ ~ ~\ntormenta = weather thunder 30\npremio = give Jugador minecraft:diamond 1';
 const confirmation=field('Escribe AUTORIZAR MINECRAFT');const status=el('p'),log=el('div');
 const labels={success:'Éxito confirmado',rejected:'Comando rechazado',connection_error:'Error de conexión',unconfirmed:'Sin confirmar',cancelled:'Cancelado'};
 let timer,inFlight=false,refreshPending=false,hydratePending=true,stopped=false,epoch=0;
 const active=()=>pane.isConnected&&!pane.hidden&&!document.hidden&&!stopped;
 function render(d,hydrate){
  if(hydrate){for(const [input,value] of [[host,d.config.host],[port,d.config.port],[commands,Object.entries(d.config.commands).map(([a,c])=>a+' = '+c).join('\n')]])if(!edited.has(input))input.value=value;}
  status.textContent=(d.authorized?'RCON autorizado · listo':'RCON desconectado')+(d.queued?` · En cola: ${d.queued}`:'');
  log.replaceChildren(...d.log.slice(0,10).map(x=>{
   const label=labels[x.outcome];
   const detail=label?`${label} · ${x.alias}: ${x.response||x.text}`:x.text;
   return el('p',new Date(x.at*1000).toLocaleTimeString((window.I18n?.locale || 'es-419'))+' · '+detail);
  }));
 }
 async function refresh(){
  clearTimeout(timer);
  if(!active())return;
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
 async function change(path,data){epoch++;await api(path,data);void refresh();}
 function parse(){const out={};for(const line of commands.value.split('\n')){if(!line.trim())continue;const i=line.indexOf('=');if(i<1)throw Error('Usa alias = comando, uno por línea');out[line.slice(0,i).trim()]=line.slice(i+1).trim()}return out}
 pane.append(button('Guardar conexión y comandos',async()=>{await change('/minecraft',{host:host.value,port:Number(port.value),...(password.value?{password:password.value}:{}),commands:parse()});password.value='';notice.textContent='Guardado. La contraseña quedó en memoria; ahora autoriza la conexión.';}),button('Autorizar y probar RCON',async()=>{await change('/minecraft/authorize',{confirmation:confirmation.value});confirmation.value='';notice.textContent='Minecraft conectado y autorizado.';}),button('Desconectar',async()=>{await change('/minecraft/disconnect',{});notice.textContent='Minecraft desconectado.';}),status);
 pane.append(button('Comprobar conexión sin ejecutar un alias',async()=>{const d=await api('/minecraft/check',{});notice.textContent=d.detail;}));
 const testAlias=field('Alias para prueba');pane.append(button('Ejecutar alias de prueba',async()=>{if(!testAlias.value)throw Error('Escribe un alias guardado');await change('/minecraft/run',{alias:testAlias.value});notice.textContent='Comando enviado a la cola.';}),el('p','En Interactividad selecciona “Comando autorizado de Minecraft” y escribe el alias. Puedes usar {user}, {gift} y {count} dentro del comando.'),el('h3','Registro reciente'),el('p','El registro se actualiza automáticamente. Sin confirmar significa que la respuesta no permite asegurar el resultado.'),log,notice);
 window.OperatorViewRegistry.register(pane.dataset.section,pane);
 new MutationObserver(sync).observe(pane,{attributes:true,attributeFilter:['hidden']});
 // Track both connection edges without refreshing for unrelated DOM changes.
 let connected=pane.isConnected;
 new MutationObserver(()=>{if(connected!==pane.isConnected){connected=pane.isConnected;sync();}}).observe(document.body,{childList:true,subtree:true});
 document.addEventListener('visibilitychange',sync);
 window.addEventListener('pagehide',()=>{stopped=true;sync();});
 window.addEventListener('pageshow',()=>{stopped=false;sync();});
 void refresh();
})();
