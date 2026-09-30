window.UserInfoControls=(()=>{
 const $=id=>document.getElementById(id),host=document.createElement('form'),inputs={};let active='',ready=false;
 host.className='overlay-style-form';host.hidden=true;$('overlay-style-form').after(host);
 const title=document.createElement('h4');title.textContent='Información del usuario';host.append(title);
 const note=document.createElement('p');note.textContent='Escribe !score en el chat para mostrar tus puntos, nivel y posición. Puedes cambiar el comando. Los puntos se acumulan al activar Puntos y niveles. Si hay empate, comparten posición; una nueva consulta reemplaza la anterior.';host.append(note);
 const grid=document.createElement('div');grid.className='overlay-control-grid';host.append(grid);
 function field(k,label,type,options=[]){const wrap=document.createElement('label'),span=document.createElement('span'),n=document.createElement(type==='select'?'select':'input');span.textContent=label;if(type==='select')for(const[value,label]of options){const o=document.createElement('option');o.value=value;o.textContent=label;n.append(o);}else n.type=type;wrap.append(span,n);grid.append(wrap);inputs[k]=n;return n;}
 field('enabled','Activar consulta en el LIVE','checkbox');
 field('canvas_format','Lienzo para transmitir','select',OverlayCanvas.options);
 const command=field('command','Comando del chat','text');command.required=true;command.pattern='![a-zA-Z0-9_]{1,24}';
 field('show_avatar','Foto del usuario','checkbox');field('show_crown','Corona del primer lugar','checkbox');
 for(const[k,label,min,max]of [['font_size','Tamaño de texto (px)',14,64],['duration','Tiempo en pantalla (segundos)',3,30]]){const n=field(k,label,'number');n.min=min;n.max=max;n.required=true;}
 const bar=document.createElement('div');bar.className='overlay-savebar';const test=document.createElement('button'),save=document.createElement('button');test.type='button';test.className='btn';test.textContent='Probar información';save.type='submit';save.className='btn btn-primary';save.textContent='Guardar información';bar.append(test,save);host.append(bar);
 function read(){return Object.fromEntries(Object.entries(inputs).map(([k,n])=>[k,n.type==='checkbox'?n.checked:n.type==='number'?Number(n.value):n.value]));}
 function preview(){if(active&&ready&&host.reportValidity()){OverlayCanvas.apply(inputs.canvas_format.value);$('overlay-preview').contentWindow?.postMessage({type:'user-info-preview',settings:read()},location.origin);}}
 async function api(options){const r=await fetch('/user-info-overlay',options);if(r.status===404)throw Error('Reinicia TikReader para cargar Información del usuario.');const d=await r.json();if(!r.ok)throw Error(d.error||'No se pudo guardar');return d;}
 test.onclick=preview;host.onchange=()=>{preview();$('overlay-gallery-status').textContent='Cambios sin guardar · vista privada con información de ejemplo.';};$('overlay-preview').addEventListener('load',preview);
 host.onsubmit=async e=>{e.preventDefault();if(!ready)return;save.disabled=true;try{await api({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(read())});$('overlay-gallery-status').textContent='Información guardada. Copia la URL como fuente de navegador en tu programa de Stream.';}catch(e){$('overlay-gallery-status').textContent=e.message;}finally{save.disabled=false;}};
 async function select(value){active=value;ready=false;host.hidden=!active;if(!active)return;$('overlay-style-form').hidden=true;save.disabled=true;try{const key=active;const d=await api();if(active!==key)return;for(const[k,n]of Object.entries(inputs))if(n.type==='checkbox')n.checked=d.settings[k];else n.value=d.settings[k]??(k==='canvas_format'?'horizontal':'');ready=true;preview();$('overlay-gallery-status').textContent='Vista privada · usuario de ejemplo. Guarda y copia la URL para mostrar las consultas de puntos.';}catch(e){if(active)$('overlay-gallery-status').textContent=e.message;}finally{save.disabled=!ready;}}
 return {select};
})();
