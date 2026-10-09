window.BuddiesControls=(()=>{
 const $=id=>document.getElementById(id),host=document.createElement('form'),inputs={};let active=false,ready=false;
 host.className='overlay-style-form';host.hidden=true;$('overlay-style-form').after(host);
 const title=document.createElement('h4');title.textContent='Amigos de la transmisión';host.append(title);
 const note=document.createElement('p');note.textContent='Los principales donadores de esta sesión aparecen como personajes. Cada colección tiene 10 personajes distintos con 24 fotogramas de caminata. Se asignan al azar y se conservan toda la sesión; se repiten después de agotar los 10. Crecen en 10 niveles según las monedas, con un tamaño máximo para no tapar el LIVE.';host.append(note);
 const grid=document.createElement('div');grid.className='overlay-control-grid';host.append(grid);
 function field(key,label,type,options=[]){const wrap=document.createElement('label'),span=document.createElement('span'),n=document.createElement(type==='select'?'select':'input');span.textContent=label;if(type==='select')for(const[value,label]of options){const o=document.createElement('option');o.value=value;o.textContent=label;n.append(o);}else n.type=type;n.name=key;wrap.append(span,n);grid.append(wrap);inputs[key]=n;return n;}
 field('enabled','Mostrar en el LIVE','checkbox');field('show_names','Mostrar nombres','checkbox');
 field('canvas_format','Lienzo para transmitir','select',OverlayCanvas.options);
 const canvasNote=document.createElement('p');host.append(canvasNote);
 function layout(){
  OverlayCanvas.apply(inputs.canvas_format.value,canvasNote);
 }
 field('theme','Colección','select',[['mascotas','Mascotas · 10 distintos'],['dinosaurios','Dinosaurios · 10 distintos'],['goblins','Goblins · 10 distintos'],['cyborgs','Robots · 10 distintos'],['elfos','Elfos · 10 distintos'],['monstruos','Monstruos · 10 distintos'],['chibis','Personas chibi · 10 distintos'],['fantasia','Dragones · 10 distintos']]);
 field('font','Fuente','select',['Verdana','Arial','Georgia','Trebuchet MS','Courier New','system-ui'].map(x=>[x,x]));
 for(const[k,label,min,max]of [['font_size','Tamaño de fuente (px)',10,64],['line_spacing','Interlineado (%)',80,200],['letter_spacing','Espaciado de letras (px)',0,10],['max_friends','Máximo de donadores',1,50],['base_size','Tamaño nivel 1 (px)',32,160],['max_size','Tamaño nivel 10 (px)',32,160],['coins_to_max','Monedas para nivel 10',10,1000000],['speed','Velocidad máxima (px/s)',0,150],['speech_duration','Duración de burbujas (segundos)',1,20]]){const n=field(k,label,'number');n.min=min;n.max=max;n.required=true;}
 field('bubbles','Burbujas de comentarios','checkbox');
 const bar=document.createElement('div');bar.className='overlay-savebar';const test=document.createElement('button'),save=document.createElement('button');test.type='button';test.className='btn';test.textContent='Probar amigos';save.type='submit';save.className='btn btn-primary';save.textContent='Guardar amigos';bar.append(test,save);host.append(bar);
 function read(){return Object.fromEntries(Object.entries(inputs).map(([k,n])=>[k,n.type==='checkbox'?n.checked:n.type==='number'?Number(n.value):n.value]));}
 function preview(){if(active&&ready)layout();if(active&&ready&&host.reportValidity()&&Number(inputs.max_size.value)>=Number(inputs.base_size.value))$('overlay-preview').contentWindow?.postMessage({type:'buddies-preview',settings:read()},location.origin);}
 async function api(options){const r=await fetch('/stream-buddies',options);if(r.status===404)throw Error('Reinicia TikReader para cargar Amigos de la transmisión.');const d=await r.json();if(!r.ok)throw Error(d.error||'No se pudo guardar');return d;}
 test.onclick=preview;host.onchange=()=>{preview();$('overlay-gallery-status').textContent='Cambios sin guardar · vista privada con donadores de ejemplo.';};$('overlay-preview').addEventListener('load',preview);
  host.onsubmit=async e=>{e.preventDefault();if(!ready)return;save.disabled=true;try{await api({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(read())});$('overlay-gallery-status').textContent='Amigos guardados. Copia la URL como fuente de navegador en tu programa de Stream.';}catch(e){$('overlay-gallery-status').textContent=e.message;}finally{save.disabled=false;}};
 async function select(value){active=value;ready=false;host.hidden=!active;$('overlay-gallery-status').textContent='';if(!active)return;$('overlay-style-form').hidden=true;save.disabled=true;try{const d=await api();if(!active)return;for(const[k,n]of Object.entries(inputs))if(n.type==='checkbox')n.checked=d.settings[k];else n.value=d.settings[k]??(k==='canvas_format'?'horizontal':' ');ready=true;preview();}catch(e){if(active)$('overlay-gallery-status').textContent=e.message;}finally{save.disabled=!ready;}}
 return {select};
})();
