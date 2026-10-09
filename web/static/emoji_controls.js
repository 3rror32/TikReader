window.EmojiControls=(()=>{
 const $=id=>document.getElementById(id),host=document.createElement('form'),inputs={};let active='',ready=false;
 host.className='overlay-style-form';host.hidden=true;$('overlay-style-form').after(host);
 const title=document.createElement('h4');title.textContent='Emojis en pantalla';host.append(title);
 const note=document.createElement('p');note.textContent='Los emojis del chat se deslizan junto a la foto del espectador, cuando está disponible. Detecta emojis Unicode, incluidos familias, banderas y tonos de piel.';host.append(note);
 const grid=document.createElement('div');grid.className='overlay-control-grid';host.append(grid);
 function field(k,label,type,options=[]){const wrap=document.createElement('label'),span=document.createElement('span'),n=document.createElement(type==='select'?'select':'input');span.textContent=label;if(type==='select')for(const[value,label]of options){const o=document.createElement('option');o.value=value;o.textContent=label;n.append(o);}else n.type=type;wrap.append(span,n);grid.append(wrap);inputs[k]=n;return n;}
 field('enabled','Activar en el LIVE','checkbox');field('canvas_format','Lienzo para transmitir','select',OverlayCanvas.options);field('show_avatar','Foto del espectador','checkbox');
 field('direction','Dirección','select',[['up','Hacia arriba'],['left','Hacia la izquierda'],['right','Hacia la derecha']]);
 for(const[k,label,min,max]of [['size','Tamaño del emoji (px)',20,120],['duration','Duración (segundos)',2,20],['max_emojis','Máximo por comentario',1,12]]){const n=field(k,label,'number');n.min=min;n.max=max;n.required=true;}
 field('motion','Movimiento','select',[['full','Animado'],['reduced','Sin movimiento'],['system','Según el sistema']]);
 const bar=document.createElement('div');bar.className='overlay-savebar';const test=document.createElement('button'),save=document.createElement('button');test.type='button';test.className='btn';test.textContent='Probar emojis';save.type='submit';save.className='btn btn-primary';save.textContent='Guardar emojis';bar.append(test,save);host.append(bar);
 function read(){return Object.fromEntries(Object.entries(inputs).map(([k,n])=>[k,n.type==='checkbox'?n.checked:n.type==='number'?Number(n.value):n.value]));}
 function preview(){if(active&&ready&&host.reportValidity()){OverlayCanvas.apply(inputs.canvas_format.value);$('overlay-preview').contentWindow?.postMessage({type:'emoji-preview',settings:read()},location.origin);}}
 async function api(options){const r=await fetch('/emoji-overlay',options);if(r.status===404)throw Error('Reinicia TikReader para cargar Emojis en pantalla.');const d=await r.json();if(!r.ok)throw Error(d.error||'No se pudo guardar');return d;}
 test.onclick=preview;host.onchange=()=>{preview();$('overlay-gallery-status').textContent='Cambios sin guardar · vista privada con emojis de ejemplo.';};$('overlay-preview').addEventListener('load',preview);
 host.onsubmit=async e=>{e.preventDefault();if(!ready)return;save.disabled=true;try{await api({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(read())});$('overlay-gallery-status').textContent='Emojis guardados. Copia la URL como fuente de navegador en tu programa de Stream.';}catch(e){$('overlay-gallery-status').textContent=e.message;}finally{save.disabled=false;}};
 async function select(value){active=value;ready=false;host.hidden=!active;$('overlay-gallery-status').textContent='';if(!active)return;$('overlay-style-form').hidden=true;save.disabled=true;try{const key=active;const d=await api();if(active!==key)return;for(const[k,n]of Object.entries(inputs))if(n.type==='checkbox')n.checked=d.settings[k];else n.value=d.settings[k]??(k==='canvas_format'?'horizontal':'');ready=true;preview();}catch(e){if(active)$('overlay-gallery-status').textContent=e.message;}finally{save.disabled=!ready;}}
 return {select};
})();
