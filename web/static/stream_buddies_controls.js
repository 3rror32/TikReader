window.BuddiesControls=(()=>{
 const $=id=>document.getElementById(id),host=document.createElement('form'),inputs={};let active=false,ready=false,currentGrid;
 host.className='overlay-style-form stream-buddies-settings';host.hidden=true;$('overlay-style-form').after(host);host.closest('.overlay-workbench')?.classList.add('stream-buddies-workbench');
 const title=document.createElement('h4');title.className='stream-buddies-settings__title';title.textContent='Amigos de la transmisión';host.append(title);
 const note=document.createElement('p');note.className='stream-buddies-settings__intro';note.textContent='Tus principales donadores aparecen como personajes. Se asignan al azar por sesión y vuelven al sorteo al agotarse la colección. Su tamaño sube en 10 niveles según sus monedas.';host.append(note);
 const previewNote=document.createElement('div');previewNote.className='stream-buddies-settings__preview-note';const previewLabel=document.createElement('span');previewLabel.textContent='Vista previa';const previewCopy=document.createElement('p');previewCopy.textContent='Usa donadores de ejemplo. Guarda para mostrar los cambios en el LIVE.';previewNote.append(previewLabel,previewCopy);host.append(previewNote);
 function group(label){const section=document.createElement('fieldset');section.className='stream-buddies-settings__group';const legend=document.createElement('legend');legend.textContent=label;const grid=document.createElement('div');grid.className='overlay-control-grid stream-buddies-settings__grid';section.append(legend,grid);host.append(section);currentGrid=grid;}
 function field(key,label,type,options=[]){const wrap=document.createElement('label'),span=document.createElement('span'),n=document.createElement(type==='select'?'select':'input');span.textContent=label;if(type==='select')for(const[value,label]of options){const o=document.createElement('option');o.value=value;o.textContent=label;n.append(o);}else n.type=type;n.name=key;wrap.append(span,n);currentGrid.append(wrap);inputs[key]=n;return n;}
 group('En directo y colección');
 field('enabled','Mostrar en el LIVE','checkbox');OverlayActivation.mount(inputs.enabled,host,$('overlay-preview-name').parentElement);field('show_names','Mostrar nombres','checkbox');
 field('canvas_format','Lienzo para transmitir','select',OverlayCanvas.options);
 const canvasNote=document.createElement('p');canvasNote.className='stream-buddies-settings__canvas-note';currentGrid.append(canvasNote);
 function layout(){
  OverlayCanvas.apply(inputs.canvas_format.value,canvasNote);
 }
 field('theme','Colección','select',[['mascotas','Mascotas · 10 distintos'],['dinosaurios','Dinosaurios · 10 distintos'],['goblins','Goblins · 10 distintos'],['cyborgs','Robots · 10 distintos'],['elfos','Elfos · 10 distintos'],['monstruos','Monstruos · 10 distintos'],['chibis','Personas chibi · 10 distintos'],['fantasia','Dragones · 10 distintos'],['pokemon','Pokémon · 16 distintos'],['anime','Anime · 11 distintos']]);
 const donorCount=field('max_friends','Máximo de donadores','number');donorCount.min=1;donorCount.max=50;donorCount.required=true;
 group('Apariencia y tamaño');
 field('font','Fuente','select',['Verdana','Arial','Georgia','Trebuchet MS','Courier New','system-ui'].map(x=>[x,x]));
 for(const[k,label,min,max]of [['font_size','Tamaño de fuente (px)',10,64],['line_spacing','Interlineado (%)',80,200],['letter_spacing','Espaciado de letras (px)',0,10],['base_size','Tamaño nivel 1 (px)',32,160],['max_size','Tamaño nivel 10 (px)',32,160]]){const n=field(k,label,'number');n.min=min;n.max=max;n.required=true;}
 group('Movimiento y comentarios');
 for(const[k,label,min,max]of [['coins_to_max','Monedas para nivel 10',10,1000000],['speed','Velocidad máxima (px/s)',0,150],['speech_duration','Duración de burbujas (segundos)',1,20]]){const n=field(k,label,'number');n.min=min;n.max=max;n.required=true;}
 field('bubbles','Burbujas de comentarios','checkbox');
 const bar=document.createElement('div');bar.className='overlay-savebar';const test=document.createElement('button'),save=document.createElement('button');test.type='button';test.className='btn stream-buddies-settings__preview-action';test.textContent='Actualizar vista previa';save.type='submit';save.className='btn btn-primary stream-buddies-settings__save-action';save.textContent='Guardar amigos';bar.append(test,save);host.append(bar);
 function read(){return Object.fromEntries(Object.entries(inputs).map(([k,n])=>[k,n.type==='checkbox'?n.checked:n.type==='number'?Number(n.value):n.value]));}
 function preview(){if(active&&ready)layout();if(active&&ready&&host.reportValidity()&&Number(inputs.max_size.value)>=Number(inputs.base_size.value))$('overlay-preview').contentWindow?.postMessage({type:'buddies-preview',settings:read()},location.origin);}
 async function api(options){const r=await fetch('/stream-buddies',options);if(r.status===404)throw Error('Reinicia TikReader para cargar Amigos de la transmisión.');const d=await r.json();if(!r.ok)throw Error(d.error||'No se pudo guardar');return d;}
 test.onclick=preview;host.onchange=()=>{preview();$('overlay-gallery-status').textContent='Cambios sin guardar · vista privada con donadores de ejemplo.';};$('overlay-preview').addEventListener('load',preview);
  host.onsubmit=async e=>{e.preventDefault();if(!ready)return;save.disabled=true;try{await api({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(read())});$('overlay-gallery-status').textContent='Amigos guardados. Copia la URL como fuente de navegador en tu programa de Stream.';}catch(e){$('overlay-gallery-status').textContent=e.message;}finally{save.disabled=false;}};
 async function select(value){if(value)OverlayActivation.show(inputs.enabled);else OverlayActivation.hide(inputs.enabled);active=value;ready=false;host.hidden=!active;$('overlay-gallery-status').textContent='';if(!active)return;$('overlay-style-form').hidden=true;save.disabled=true;try{const d=await api();if(!active)return;for(const[k,n]of Object.entries(inputs))if(n.type==='checkbox')n.checked=d.settings[k];else n.value=d.settings[k]??(k==='canvas_format'?'horizontal':' ');ready=true;preview();}catch(e){if(active)$('overlay-gallery-status').textContent=e.message;}finally{save.disabled=!ready;}}
 return {select};
})();
