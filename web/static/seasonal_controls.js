window.SeasonalControls=(()=>{
 const $=id=>document.getElementById(id),host=document.createElement('form'),inputs={};let active='',ready=false,backgroundImage='',backgroundVisible=true,previewTimer=0;
 host.className='overlay-style-form';host.hidden=true;$('overlay-style-form').after(host);
 const title=document.createElement('h4');title.textContent='Ambiente visual';host.append(title);
 const note=document.createElement('p');note.textContent='Efecto continuo con fondo transparente. Usa una fuente de navegador del tamaño de tu escena. La vista de prueba funciona aunque el ambiente esté desactivado.';host.append(note);
 const grid=document.createElement('div');grid.className='overlay-control-grid';host.append(grid);
 function field(k,label,type,options=[]){const wrap=document.createElement('label'),span=document.createElement('span'),n=document.createElement(type==='select'?'select':'input');span.textContent=label;if(type==='select')for(const[value,label]of options){const o=document.createElement('option');o.value=value;o.textContent=label;n.append(o);}else n.type=type;wrap.append(span,n);grid.append(wrap);inputs[k]=n;return n;}
 field('enabled','Mostrar ambiente','checkbox');
 field('canvas_format','Lienzo para transmitir','select',OverlayCanvas.options);
 field('fog_style','Estilo de niebla','select',[['low','Niebla baja'],['enveloping','Niebla envolvente'],['cinematic','Bruma cinematográfica']]);
 field('fog_clear_zone','Mantener despejado','select',[['none','Ninguna zona'],['left','Lado izquierdo'],['center','Centro'],['right','Lado derecho']]);
 field('fog_density','Densidad de la niebla','select',[['8','Suave'],['18','Media'],['60','Densa'],['140','Intensa']]);
 field('fog_direction','Dirección de deriva','select',[['-90','Hacia la izquierda'],['90','Hacia la derecha'],['180','Ascendente'],['0','Descendente'],['-135','Diagonal superior izquierda'],['135','Diagonal superior derecha']]);
 for(const[k,label,min,max]of [['density','Intensidad (partículas)',5,180],['size','Tamaño (px)',3,70],['speed','Velocidad de movimiento',1,120],['direction','Dirección (°): 0 abajo · −90 izquierda · 90 derecha · ±180 arriba',-180,180],['wind','Brisa lateral (− izquierda / + derecha)',-100,100],['opacity','Opacidad (%)',10,100],['thickness','Grosor de la lluvia (px)',0.3,5],['glass_count','Máximo de gotas en el cristal (0 = ninguna)',0,180],['glass_speed','Velocidad de escurrimiento',1,120]]){const n=field(k,label,'number');n.min=min;n.max=max;n.step=k==='thickness'?'0.1':'1';n.required=true;}
 field('primary_color','Color principal','color');
 field('secondary_color','Color secundario','color');
 field('motion','Movimiento','select',[['full','Animado'],['reduced','Sin movimiento'],['system','Según el sistema']]);
 const backgroundBox=document.createElement('div');backgroundBox.hidden=true;
 const backgroundLabel=document.createElement('label');backgroundLabel.textContent='Imagen de fondo (PNG, JPG o WebP, máximo 3 MB)';
 const backgroundInput=document.createElement('input');backgroundInput.type='file';backgroundInput.accept='image/png,image/jpeg,image/webp';backgroundLabel.append(backgroundInput);
 const backgroundReset=document.createElement('button');backgroundReset.type='button';backgroundReset.textContent='Usar fondo de ejemplo';
 const backgroundRemove=document.createElement('button');backgroundRemove.type='button';backgroundRemove.textContent='Quitar fondo';
 backgroundRemove.onclick=()=>{backgroundVisible=false;preview();$('overlay-gallery-status').textContent='Sin fondo · guarda el ambiente para aplicarlo.';};
 backgroundBox.append(backgroundLabel,backgroundRemove,backgroundReset);host.append(backgroundBox);
 backgroundInput.onchange=async()=>{const file=backgroundInput.files[0];if(!file)return;if(file.size>2900000||!['image/png','image/jpeg','image/webp'].includes(file.type)){backgroundInput.value='';$('overlay-gallery-status').textContent='Elige una imagen PNG, JPG o WebP de menos de 3 MB.';return;}const key=active;const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});if(active!==key)return;backgroundImage=data;backgroundVisible=true;preview();$('overlay-gallery-status').textContent='Fondo cargado en vista privada. Guarda el ambiente para aplicarlo.';};
 backgroundReset.onclick=()=>{backgroundVisible=true;backgroundImage='';backgroundInput.value='';preview();$('overlay-gallery-status').textContent='Fondo de ejemplo · cambios sin guardar.';};
 const bar=document.createElement('div');bar.className='overlay-savebar';const save=document.createElement('button');save.type='submit';save.className='btn btn-primary';save.textContent='Guardar ambiente';const reset=document.createElement('button');reset.type='button';reset.className='btn';reset.textContent='Restablecer configuración';bar.append(reset,save);host.append(bar);
 const defaultsByKind={
  snow:{density:70,size:12,speed:30,direction:0,wind:15,opacity:80,primary_color:'#f0f8ff',secondary_color:'#8bdcff'},
  leaves:{density:70,size:26,speed:30,direction:0,wind:15,opacity:80,primary_color:'#d9823b',secondary_color:'#f3c969'},
  wind:{density:18,size:12,speed:30,direction:0,wind:15,opacity:80,primary_color:'#e9e5d4',secondary_color:'#b9e8ff'},
  rain:{density:70,size:12,speed:30,direction:0,wind:15,opacity:80,primary_color:'#ccecff',secondary_color:'#78bce8'},
  'rain-original':{density:10,size:60,speed:30,direction:0,wind:15,opacity:100,primary_color:'#f0f8ff',secondary_color:'#8bdcff',glass_count:2000},
  fireflies:{density:55,size:9,speed:18,direction:0,wind:4,opacity:88,primary_color:'#ffd86b',secondary_color:'#72ffbd'},
  aurora:{density:7,size:52,speed:8,direction:12,wind:0,opacity:58,primary_color:'#52f2c5',secondary_color:'#826cff'},
  fog:{density:18,size:45,speed:12,direction:90,wind:0,opacity:45,primary_color:'#d9e4ef',secondary_color:'#91a9bf',fog_style:'low',fog_clear_zone:'center',fog_density:'18',fog_direction:'90'},
  embers:{density:105,size:9,speed:32,direction:180,wind:7,opacity:90,primary_color:'#ffcf7a',secondary_color:'#ff481f'},
  stars:{density:95,size:6,speed:8,direction:90,wind:0,opacity:82,primary_color:'#fff4cf',secondary_color:'#8fc7ff'},
  petals:{density:52,size:18,speed:24,direction:0,wind:10,opacity:85,primary_color:'#ff9fc8',secondary_color:'#ffe0ed'},
  bubbles:{density:46,size:20,speed:25,direction:180,wind:3,opacity:62,primary_color:'#b9f4ff',secondary_color:'#ffffff'},
  'digital-rain':{density:58,size:18,speed:46,direction:0,wind:0,opacity:75,primary_color:'#65ff9a',secondary_color:'#d7ffe3'}
 };
 reset.onclick=()=>{
  if(!active||!ready)return;
  const defaults={enabled:true,canvas_format:'horizontal',motion:'full',thickness:1,glass_count:45,glass_speed:25,fog_style:'low',fog_clear_zone:'center',fog_density:'18',fog_direction:'90',...defaultsByKind[active]};
  for(const[k,n]of Object.entries(inputs)){if(n.type==='checkbox')n.checked=defaults[k];else n.value=defaults[k];}
  backgroundImage='';backgroundVisible=true;backgroundInput.value='';syncMotionControls();
  preview();$('overlay-gallery-status').textContent='Configuración restablecida en la vista previa. Pulsa Guardar ambiente para conservarla.';
 };
 function read(){const values=Object.fromEntries(Object.entries(inputs).filter(([k])=>!['fog_density','fog_direction'].includes(k)).map(([k,n])=>[k,n.type==='checkbox'?n.checked:n.type==='number'?Number(n.value):n.value]));if(active==='fog'){values.density=Number(inputs.fog_density.value);values.direction=Number(inputs.fog_direction.value);values.wind=0;}return {background_image:backgroundImage,background_visible:backgroundVisible,...values};}
 function preview(){if(active&&ready&&host.reportValidity()){OverlayCanvas.apply(inputs.canvas_format.value);$('overlay-preview').contentWindow?.postMessage({type:'seasonal-preview',settings:read()},location.origin);}}
 function queuePreview(){clearTimeout(previewTimer);previewTimer=setTimeout(preview,80);}
 function closest(select,value){select.value=[...select.options].reduce((best,option)=>Math.abs(Number(option.value)-value)<Math.abs(Number(best.value)-value)?option:best,select.options[0]).value;}
 function syncMotionControls(){const still=active==='fog'&&inputs.motion.value==='reduced';inputs.speed.disabled=active==='fog'?still:false;if(active==='fog')inputs.fog_direction.disabled=still;}
 async function api(options){const r=await fetch('/seasonal-overlays/'+active,options);if(r.status===404)throw Error('Reinicia TikReader para cargar Ambientes estacionales.');const d=await r.json();if(!r.ok)throw Error(d.error||'No se pudo guardar');return d;}
 addEventListener('message',e=>{if(e.origin===location.origin&&e.source===$('overlay-preview').contentWindow&&e.data?.type==='seasonal-renderer-status')$('overlay-gallery-status').textContent=e.data.message;});
 host.oninput=()=>{syncMotionControls();queuePreview();$('overlay-gallery-status').textContent='Cambios sin guardar · vista privada con ambiente de prueba.';};$('overlay-preview').addEventListener('load',preview);
 host.onsubmit=async e=>{e.preventDefault();if(!ready)return;save.disabled=true;try{await api({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(read())});$('overlay-gallery-status').textContent='Ambiente guardado. Copia la URL como fuente de navegador en tu programa de Stream.';}catch(e){$('overlay-gallery-status').textContent=e.message;}finally{save.disabled=false;}};
 async function select(value){
  active=value;ready=false;clearTimeout(previewTimer);host.hidden=!active;$('overlay-gallery-status').textContent='';if(!active)return;
  const fog=active==='fog',rain=active==='rain',original=active==='rain-original',classic=['leaves','wind','rain','rain-original'].includes(active);
  for(const k of ['fog_style','fog_clear_zone','fog_density','fog_direction']){inputs[k].parentElement.hidden=!fog;inputs[k].disabled=!fog;}
  for(const k of ['thickness','glass_count','glass_speed']){inputs[k].parentElement.hidden=!rain;inputs[k].disabled=!rain;}
  inputs.enabled.previousElementSibling.textContent=fog?'Visible en transmisión':'Mostrar ambiente';
  inputs.density.parentElement.hidden=fog;inputs.density.disabled=fog;
  inputs.size.previousElementSibling.textContent=rain?'Longitud de las gotas (px)':active==='aurora'?'Altura de las ondas':fog?'Altura de la bruma':'Tamaño (px)';
  inputs.primary_color.previousElementSibling.textContent=fog?'Color de la niebla':active==='bubbles'?'Color de la burbuja':'Color principal';
  inputs.secondary_color.previousElementSibling.textContent=fog?'Color de iluminación':active==='bubbles'?'Color del reflejo':'Color secundario';
  const directionHidden=fog||classic&&active!=='snow',windHidden=fog||active==='snow'||active==='digital-rain'||active==='aurora';
  inputs.direction.parentElement.hidden=directionHidden;inputs.direction.disabled=directionHidden;
  inputs.wind.parentElement.hidden=windHidden;inputs.wind.disabled=windHidden;
  for(const k of ['primary_color','secondary_color'])inputs[k].parentElement.hidden=active==='rain'||original||active==='leaves';
  backgroundBox.hidden=!original;inputs.size.max=original?120:70;inputs.glass_count.max=original?2000:180;
  if(original){for(const k of ['wind','direction','thickness','glass_speed']){inputs[k].parentElement.hidden=true;inputs[k].disabled=true;}inputs.glass_count.parentElement.hidden=false;inputs.glass_count.disabled=false;inputs.glass_count.previousElementSibling.textContent='Límite de gotas principales';inputs.density.previousElementSibling.textContent='Gotas nuevas por segundo';inputs.size.previousElementSibling.textContent='Tamaño de gotas en el cristal';}
  else{inputs.glass_count.previousElementSibling.textContent='Máximo de gotas en el cristal (0 = ninguna)';if(!fog){inputs.direction.disabled=directionHidden;inputs.wind.disabled=windHidden;}}
  note.textContent=original?'Raindrop FX original con refracción sobre una imagen de fondo. Puedes elegir una imagen, quitar el fondo o recuperar el de ejemplo.':fog?'La vista privada permanece visible aunque desactives la transmisión. Elige estilo, densidad y una zona despejada; después guarda los cambios.':active==='bubbles'?'Burbujas transparentes con cuerpo y reflejo configurables. Combina dos colores y revisa el resultado en la vista previa.':'Efecto continuo con fondo transparente. Ajusta intensidad, movimiento y color sin tapar los elementos importantes de tu escena.';
  $('overlay-style-form').hidden=true;save.disabled=true;
  try{const key=active,d=await api();if(active!==key)return;backgroundImage=d.settings.background_image||'';backgroundVisible=d.settings.background_visible!==false;backgroundInput.value='';for(const[k,n]of Object.entries(inputs)){if(k==='fog_density'||k==='fog_direction')continue;if(n.type==='checkbox')n.checked=d.settings[k];else n.value=d.settings[k]??(k==='canvas_format'?'horizontal':({direction:0,thickness:1,glass_count:45,glass_speed:25,fog_style:'low',fog_clear_zone:'center'}[k]??''));}if(fog){closest(inputs.fog_density,d.settings.density);closest(inputs.fog_direction,d.settings.direction);}ready=true;syncMotionControls();preview();}
  catch(e){if(active)$('overlay-gallery-status').textContent=e.message;}finally{save.disabled=!ready;}
 }
 return {select};
})();
