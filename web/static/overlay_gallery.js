(()=>{
 const groups=[
  ['Animaciones','Efectos que responden al LIVE',[['animation-energy-ring','Aro de energía'],['animation-hearts','Lluvia de corazones'],['animation-fountain','Fuente de Me gusta'],['animation-coins','Explosión de monedas'],['animation-welcome','Bienvenida de seguidores'],['animation-celebration','Celebración de meta'],['animation-custom','GIF o video personalizado'],['animation-cannon','Cañón de regalos']]],
  ['Metas','Progreso acumulado',[['goals','Metas combinadas'],['goal-likes','Meta de likes'],['goal-shares','Meta de compartidos'],['goal-follows','Meta de seguidores'],['goal-viewers','Meta de espectadores'],['goal-coins','Meta de monedas'],['goal-subscribers','Meta de suscriptores'],['goal-custom-1','Meta personalizada 1'],['goal-custom-2','Meta personalizada 2'],['goal-custom-3','Meta personalizada 3']]],
  ['Cuenta regresiva','Lo que falta para llegar',[['countdown-likes','Likes restantes'],['countdown-shares','Compartidos restantes'],['countdown-follows','Seguidores restantes'],['countdown-viewers','Espectadores restantes'],['countdown-coins','Monedas restantes'],['countdown-subscribers','Suscriptores restantes'],['countdown-custom-1','Objetivo personalizado 1'],['countdown-custom-2','Objetivo personalizado 2'],['countdown-custom-3','Objetivo personalizado 3']]],
  ['Regalos','Reconocimiento y actividad',[['gifts','Regalos recientes'],['top-gift','Mejor regalo'],['top-streak','Mejor racha'],['gift-counter-1','Contador de regalo 1'],['gift-counter-2','Contador de regalo 2'],['gift-counter-3','Contador de regalo 3']]],
  ['Actividad','Últimos eventos del LIVE',[['latest-gifts','Últimos regalos'],['latest-comments','Últimos comentarios'],['latest-events','Actividad reciente'],['chat','Chat en pantalla'],['highlight','Comentario destacado']]],
  ['Celebraciones','Agradecimientos editables',[['animation-vip-runway','Pasarela VIP'],['animation-vip-diamonds','Lluvia de diamantes'],['animation-vip-hearts','Lluvia de cariño']]],
  ['Ambientes','Efectos continuos para tu escena',[['seasonal-fireflies','Luciérnagas'],['seasonal-aurora','Aurora neón'],['seasonal-fog','Niebla ambiental'],['seasonal-embers','Brasas y cenizas'],['seasonal-stars','Cielo estrellado'],['seasonal-petals','Pétalos flotantes'],['seasonal-bubbles','Burbujas'],['seasonal-digital-rain','Lluvia digital'],['seasonal-snow','Nieve suave'],['seasonal-leaves','Hojas de otoño'],['seasonal-wind','Viento suave'],['seasonal-rain','Lluvia sobre cristal'],['seasonal-rain-original','Lluvia · Raindrop FX original']]],
  ['Comunidad','Personajes de tus donadores',[['stream-buddies','Amigos de la transmisión'],['chat-emojis','Emojis en pantalla'],['user-info','Información del usuario']]],
  ['Escena','Composición y presencia',[['webcam-frame','Marco de webcam'],['talking-banner','Rótulo del canal'],['announcement','Escena y anuncio'],['timer','Temporizador'],['fortune-wheel','Rueda de la fortuna'],['point-drop','Caída de puntos']]],
  ['Datos','Lectura rápida de la sesión',[['top-donors','Principales donadores'],['top-likes','Ranking de likes'],['ranking','Ranking de regalos'],['stats','Panel de métricas']]]
 ];
 const $=id=>document.getElementById(id),el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n};
 const categories=$('overlay-categories'),grid=$('overlay-grid'),frame=$('overlay-preview'),name=$('overlay-preview-name'),open=$('overlay-open'),code=$('overlay-selected-url'),status=$('overlay-gallery-status'),controls=$('overlay-style-controls'),form=$('overlay-style-form');
 if(!categories||!grid||!frame||!controls)return;
 // Match the catalog to the six destinations in the Overlays menu.
 const sections=[
  {key:'animations',title:'Animaciones',description:'Animaciones que reaccionan a tu comunidad y celebran momentos del LIVE.',icon:'spark',parts:[groups[0],groups[5]]},
  {key:'effects',title:'Efectos',description:'Ambientes continuos para transformar el fondo de tu escena.',icon:'effects',parts:[groups[6]]},
  {key:'tools',title:'Herramientas',description:'Chat, regalos, rankings, datos y elementos útiles para tu transmisión.',icon:'tools',parts:[['Chat y actividad','Muestra la conversación y los eventos recientes',['chat','highlight','latest-comments','latest-events'].map(key=>groups[4][2].find(item=>item[0]===key))],groups[7],[groups[3][0],groups[3][1],[...groups[3][2],groups[4][2].find(item=>item[0]==='latest-gifts')]],groups[9],groups[8]]},
  {key:'goals',title:'Metas',description:'Progreso, cuentas regresivas y objetivos personalizados.',icon:'goal',parts:[groups[1],groups[2]]}
 ];
 // Keep the existing widget IDs as variants so saved streaming sources remain valid.
 const variants=new Map(groups.flatMap(group=>group[2]));
 const families=[
  ['goals','Metas y cuenta regresiva',[...groups[1][2],...groups[2][2]]],
  ['gift-counter-1','Contador de regalos',groups[3][2].filter(([key])=>key.startsWith('gift-counter-'))],
  ['gifts','Regalos recientes', [['gifts','Regalos recientes'],['latest-gifts','Últimos regalos']]],
  ['top-gift','Regalo destacado',[['top-gift','Mayor valor'],['top-streak','Mejor racha']]],
  ['chat','Chat y comentarios',[['chat','Chat en pantalla'],['latest-comments','Comentarios recientes'],['highlight','Comentario destacado']]],
  ['top-donors','Ranking de la comunidad',groups[9][2].filter(([key])=>key!=='stats')],
  ['seasonal-snow','Ambiente de la escena',groups[6][2]]
 ];
 const familyByVariant=new Map(families.flatMap(family=>family[2].map(([key])=>[key,family])));
 const canonical=key=>familyByVariant.get(key)?.[0]||key;
 const entries=new Map([...variants].filter(([key])=>canonical(key)===key).map(([key,label])=>[key,familyByVariant.get(key)?.[1]||label]));
 const placed=new Set();
 for(const section of sections)section.parts=section.parts.map(([title,description,items])=>[title,description,items.flatMap(([key])=>{const id=canonical(key);if(placed.has(id))return [];placed.add(id);return [[id,entries.get(id)]];})]).filter(part=>part[2].length);
 const catalog=$('overlay-catalog'),editor=$('overlay-editor'),favoritesGrid=$('overlay-favorites-grid'),favoritesSection=favoritesGrid.closest('.overlay-favorites'),browseTitle=catalog.querySelector('.overlay-browse-title'),resultsHeading=catalog.querySelector('.overlay-results-heading');
 const favoriteStorage='tikreader.overlay-favorites';
 let favorites=new Set(),categoryIndex=0,catalogMode='animations',returnKey='';
 try{const saved=JSON.parse(localStorage.getItem(favoriteStorage)||'[]');if(Array.isArray(saved))favorites=new Set(saved.map(canonical).filter(key=>entries.has(key)));}catch(_){}
 const iconPaths={
  chat:'M4 4h16v12H9l-5 4V4m4 5h8m-8 3h5',
  goal:'M20 12a8 8 0 1 1-8-8m0 4a4 4 0 1 0 4 4m-4 0 9-9m-5 0h5v5',
  gift:'M3 8h18v4H3V8m2 4v9h14v-9M12 8v13m0-13C3 8 6 0 10 4l2 4c9 0 6-8 2-4l-2 4',
  spark:'m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7',
  scene:'M3 4h18v16H3V4m0 11 5-5 5 5 3-3 5 5M16 8h.01',
  game:'M7 7h10c3 0 4 3 5 10 0 3-3 3-6-1H8c-3 4-6 4-6 1 1-7 2-10 5-10m0 3v5m-2-2h4m7-2h.01m3 3h.01',
  effects:'M5 19c5 2 9-1 9-6 0-3-2-5-5-5 1-3 4-5 8-4 4 1 5 6 2 9-3 3-8 4-14 1m13-10 2-2m-2-2 2 2',
  tools:'M4 7h16M7 4v6m10 2v8m-3-5h6M4 15h6m-3-3v6',
  star:'m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3'
 };
 function icon(kind){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.7');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',iconPaths[kind]);svg.append(path);return svg;}
 const descriptions={
  'animation-energy-ring':'La foto de quien participa rodeada de un aro de energía animado.',
  'latest-gifts':'Lista de los últimos regalos recibidos.','latest-comments':'Una lista compacta de mensajes recientes.','latest-events':'Regalos y otros eventos en una misma lista.',chat:'La conversación del chat, visible en tu escena.',highlight:'Un solo comentario seleccionado en primer plano.',
  'stream-buddies':'Personajes animados que representan a tus donadores.','chat-emojis':'Los emojis del chat aparecen sobre tu escena.','user-info':'Foto, nivel y puntos de un usuario.',goals:'Varios objetivos reunidos en un panel.',
  gifts:'Muestra quién regala y qué regalo envía.','top-gift':'Destaca el regalo de mayor valor.','top-streak':'Destaca la mejor racha de regalos.','top-donors':'Clasificación de tus principales donadores.','top-likes':'Clasificación de quienes envían más likes.',ranking:'Tabla de posiciones de regalos.',stats:'Las cifras principales de tu transmisión.',
  'animation-hearts':'Corazones animados para acompañar los eventos.','animation-fountain':'Una fuente de partículas al recibir likes.','animation-coins':'Monedas que estallan para agradecer regalos.','animation-welcome':'Recibe a los nuevos seguidores con una animación.','animation-celebration':'Celebra cuando se completa un objetivo.','animation-custom':'Usa tu propio GIF, imagen o video.','animation-cannon':'Un cañón lanza los regalos sobre la escena.',
  'animation-vip-runway':'Una entrada especial para tus donadores.','animation-vip-diamonds':'Agradece con una lluvia de diamantes.','animation-vip-hearts':'Dedica una lluvia de corazones a tu comunidad.',
  'seasonal-fireflies':'Luces vivas que flotan y parpadean con profundidad.','seasonal-aurora':'Bandas de color translúcidas que ondulan sobre la escena.','seasonal-fog':'Capas de niebla suave que cruzan la transmisión.','seasonal-embers':'Brasas luminosas y ceniza que ascienden desde la parte inferior.','seasonal-stars':'Estrellas que titilan con destellos fugaces ocasionales.','seasonal-petals':'Pétalos de colores que caen y giran con la brisa.','seasonal-bubbles':'Burbujas transparentes que suben con reflejos de color.','seasonal-digital-rain':'Columnas de símbolos luminosos con estilo tecnológico.',
  'seasonal-rain':'Lluvia transparente con gotas que golpean el cristal y escurren por la pantalla.','seasonal-snow':'Nieve continua como fondo ambiental.','seasonal-leaves':'Hojas que caen para una escena otoñal.','seasonal-wind':'Movimiento suave de viento en tu escena.',
  'webcam-frame':'Un marco para integrar tu cámara.','talking-banner':'Identifica tu canal con un rótulo.',announcement:'Muestra un anuncio o mensaje de tu escena.',timer:'El tiempo restante, visible para tu audiencia.','fortune-wheel':'Gira la rueda para elegir un resultado.','point-drop':'Los regalos caen dentro de una alcancía interactiva.'
 };
 function describe(key){const family=familyByVariant.get(key);if(family)return `Elige entre ${family[2].length} variantes y personaliza su configuración.`;if(descriptions[key])return descriptions[key];return 'Personaliza este elemento para tu escena.';}
 const previewBackground=$('overlay-preview-background'),previewScreen=frame.parentElement;
 function setPreviewBackground(){previewScreen.dataset.previewBackground=previewBackground.value;try{localStorage.setItem('overlay-preview-background',previewBackground.value)}catch(_){}}
 if(previewBackground){try{const saved=localStorage.getItem('overlay-preview-background');if(['transparent','dark','light'].includes(saved))previewBackground.value=saved}catch(_){}previewBackground.onchange=setPreviewBackground;setPreviewBackground();}
 const gameControls=new Map(),gameHost=el('div',undefined,'overlay-game-controls'),appearance=el('h4','Apariencia del overlay','overlay-appearance-title');
 gameHost.hidden=true;appearance.hidden=true;
 const workbench=$('overlay-editor').querySelector('.overlay-workbench'),editorCopy=$('overlay-editor').querySelector('.overlay-editor-heading>p'),defaultEditorCopy=editorCopy.textContent;
 workbench.before(gameHost,appearance);
 const piggySidebar=el('div',undefined,'piggy-sidebar');piggySidebar.hidden=true;workbench.append(piggySidebar);
 function showGameControls(key){
  for(const [game,node] of gameControls)node.hidden=game!==key;
  const active=gameControls.has(key),piggy=key==='point-drop';gameHost.hidden=!active;appearance.hidden=!active||piggy;
  $('overlay-editor').classList.toggle('piggy-editor',piggy);
  piggySidebar.hidden=!piggy;
  if(piggy){piggySidebar.append(gameHost,form);}else{workbench.before(gameHost,appearance);workbench.insertBefore(form,piggySidebar);}
  frame.title=piggy?'Alcancía en directo':'Vista previa con datos de ejemplo';
  for(const input of controls.querySelectorAll('[data-key]'))input.closest('label').hidden=piggy&&!['canvas_format','text_color','accent_color','font_family','font_size','title_size'].includes(input.dataset.key);
  controls.querySelector('.overlay-style-section').hidden=piggy;
  const layoutGroup=controls.querySelectorAll('.overlay-control-group')[1];if(layoutGroup)layoutGroup.hidden=false;
  editorCopy.textContent=key==='point-drop'?'Una sola alcancía en directo. Ajusta su caída y apariencia aquí; guarda los cambios para publicarlos.':active?'Los controles actúan en directo. La vista previa de apariencia usa datos de ejemplo; guarda el estilo para publicarlo.':defaultEditorCopy;
 }
 window.OverlayGallery={registerGameControls(key,node){
  node.removeAttribute('data-section');node.dataset.overlayGame=key;node.hidden=true;
  const heading=node.querySelector('.live-tool-hero h2'),title=el('h4','Control en directo');title.id='overlay-game-'+key;heading.replaceWith(title);node.setAttribute('aria-labelledby',title.id);
  node.querySelector('.overlay-link-card')?.remove();gameControls.set(key,node);gameHost.append(node);showGameControls(selected);
 }};
 const presets={dark:['#101925','#f4f7fc','#85dec5','#2c3a4b',93],light:['#f7fafc','#172331','#176951','#cbd5df',96],neon:['#080b17','#f7f7ff','#00f5d4','#9b51e0',88],minimal:['#000000','#ffffff','#ffffff','#ffffff',0]};
 const presetLabels={dark:'Cabina',light:'Luz',neon:'Pulso',minimal:'Cristal'};let selected='',settingsPanel='',settings={};
 const variantBox=el('section',undefined,'overlay-control-group overlay-variant-controls'),variantLabel=el('label'),variantSelect=el('select');
 variantSelect.id='overlay-variant';variantLabel.append(el('span','Variante del overlay'),variantSelect);variantBox.append(variantLabel);workbench.before(variantBox);
 function showVariants(key){const family=familyByVariant.get(key);variantBox.hidden=!family;variantSelect.replaceChildren();if(!family)return;for(const[value,label]of family[2]){const option=el('option',label);option.value=value;variantSelect.append(option);}variantSelect.value=key;}
 variantSelect.onchange=()=>select(variantSelect.value,variants.get(variantSelect.value),undefined,true);
 async function api(path,options){const r=await fetch(path,{cache:'no-store',...options}),d=await r.json();if(!r.ok)throw Error(d.error||'No se pudo completar la acción');return d}
 function field(parent,label,key,type='number',options=[]){const l=el('label'),span=el('span',label),input=type==='select'?el('select'):el('input');input.dataset.key=key;if(type==='select')for(const[value,text]of options){const o=el('option',text);o.value=value;input.append(o)}else input.type=type;l.append(span,input);parent.append(l);return input}
 const styleSection=el('section',undefined,'overlay-style-section'),presetGrid=el('div',undefined,'overlay-presets');styleSection.append(el('h4','Estilos rápidos'),presetGrid);controls.append(styleSection);
 const colorSection=el('details',undefined,'overlay-control-group'),colorGrid=el('div',undefined,'overlay-control-grid');colorSection.open=true;colorSection.append(el('summary','Colores y texto'),colorGrid);controls.append(colorSection);
 const theme=field(colorGrid,'Tema','theme','select',[['dark','Cabina'],['light','Luz'],['neon','Pulso'],['minimal','Cristal'],['custom','Personalizado']]);
 const background=field(colorGrid,'Fondo','background','color'),textColor=field(colorGrid,'Texto','text_color','color'),accent=field(colorGrid,'Acento','accent_color','color'),border=field(colorGrid,'Borde','border_color','color');
 const font=field(colorGrid,'Fuente','font_family','select',['Inter','Arial','Verdana','Georgia','Trebuchet MS','Courier New','system-ui'].map(x=>[x,x])),fontSize=field(colorGrid,'Contenido','font_size'),titleSize=field(colorGrid,'Títulos','title_size');
 const layoutSection=el('details',undefined,'overlay-control-group'),layoutGrid=el('div',undefined,'overlay-control-grid');layoutSection.append(el('summary','Distribución y elementos'),layoutGrid);controls.append(layoutSection);
 const canvasFormat=field(layoutGrid,'Lienzo para transmitir','canvas_format','select',OverlayCanvas.options),alignment=field(layoutGrid,'Alineación','alignment','select',[['left','Izquierda'],['center','Centro'],['right','Derecha']]),layout=field(layoutGrid,'Columnas','layout','select',[['stack','Una'],['grid','Dos']]),animation=field(layoutGrid,'Entrada','animation','select',[['none','Ninguna'],['fade','Aparecer'],['slide','Deslizar'],['pop','Escala']]);
 const radius=field(layoutGrid,'Esquinas','radius','range'),opacity=field(layoutGrid,'Opacidad','opacity','range'),maxItems=field(layoutGrid,'Máximo visible','max_items');radius.min=0;radius.max=40;opacity.min=0;opacity.max=100;maxItems.min=1;maxItems.max=50;fontSize.min=12;fontSize.max=64;titleSize.min=10;titleSize.max=36;
 const bools={};for(const[key,label]of Object.entries({show_background:'Fondo',show_avatar:'Fotos',show_name:'Usuarios',show_time:'Hora',show_details:'Detalles',show_connection:'Estado de conexión'}))bools[key]=field(layoutGrid,label,key,'checkbox');
 const goalBox=el('section',undefined,'overlay-control-group');goalBox.hidden=true;controls.append(goalBox);
 const goalTitle=field(goalBox,'Título del objetivo','goal_title','text'),goalTarget=field(goalBox,'Meta','goal_target'),goalValue=field(goalBox,'Valor actual (objetivo personalizado)','goal_value'),goalGift=field(goalBox,'Nombre del regalo a contar','goal_gift','text');
 const goalSave=el('button','Guardar objetivo');goalSave.type='button';goalBox.append(goalSave);goalSave.onclick=async()=>{const key=selected;try{await api(`/overlay-goals/${key}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:goalTitle.value,goal:Number(goalTarget.value),value:Number(goalValue.value),gift:goalGift.value})});status.textContent='Objetivo guardado y aplicado al overlay.'}catch(e){status.textContent=e.message}};
 async function loadGoal(key){goalBox.hidden=!/^(goal-|countdown-|gift-counter-)/.test(key);if(goalBox.hidden)return;const d=await api(`/overlay-goals/${key}`);if(selected!==key||editor.hidden)return;goalTitle.value=d.settings.title;goalTarget.value=d.settings.goal;goalValue.value=d.settings.value;goalGift.value=d.settings.gift;goalValue.parentElement.hidden=!key.includes('custom');goalGift.parentElement.hidden=!key.startsWith('gift-counter-')}
 const inputs=[theme,background,textColor,accent,border,font,fontSize,titleSize,canvasFormat,alignment,layout,animation,radius,opacity,maxItems,...Object.values(bools)];
 function read(){const out={};for(const input of inputs)out[input.dataset.key]=input.type==='checkbox'?input.checked:input.type==='number'||input.type==='range'?Number(input.value):input.value;return out}
 function fill(){for(const input of inputs){const value=settings[input.dataset.key];if(input.type==='checkbox')input.checked=!!value;else input.value=value}OverlayCanvas.apply(canvasFormat.value);markPreset()}
 function markPreset(){for(const b of presetGrid.children)b.classList.toggle('active',b.dataset.preset===theme.value)}
 function preview(){if(!selected||settingsPanel!==selected)return;frame.contentWindow?.postMessage({type:'widget-preview-settings',settings:read(),goal:goalBox.hidden?null:{title:goalTitle.value,goal:Number(goalTarget.value),value:Number(goalValue.value),gift:goalGift.value}},location.origin)}
 function choosePreset(key){const p=presets[key];theme.value=key;[background.value,textColor.value,accent.value,border.value,opacity.value]=p;markPreset();preview();status.textContent='Estilo aplicado a la vista privada. Guarda para enviarlo al programa de streaming.'}
 for(const key of Object.keys(presets)){const b=el('button',undefined,'overlay-preset');b.type='button';b.dataset.preset=key;b.style.setProperty('--preset-bg',presets[key][0]);b.style.setProperty('--preset-fg',presets[key][1]);b.style.setProperty('--preset-accent',presets[key][2]);b.append(el('i'),el('span',presetLabels[key]));b.onclick=()=>choosePreset(key);presetGrid.append(b)}
 function updateStar(button,key){const active=favorites.has(key);button.setAttribute('aria-pressed',String(active));button.setAttribute('aria-label',`${active?'Quitar de':'Añadir a'} favoritos: ${entries.get(key)}`);button.title=active?'Quitar de favoritos':'Añadir a favoritos';}
 function toggleFavorite(key,button){
  const wasFavorite=favorites.has(key),inFavorites=favoritesGrid.contains(button);
  if(wasFavorite)favorites.delete(key);else favorites.add(key);
  let saved=true;try{localStorage.setItem(favoriteStorage,JSON.stringify([...favorites]));}catch(_){saved=false;}
  window.dispatchEvent(new CustomEvent('tikreader:overlay-favorites',{detail:{count:favorites.size}}));
  renderFavorites();
  for(const star of grid.querySelectorAll('.overlay-favorite'))updateStar(star,star.dataset.key);
  if(inFavorites){const next=favoritesGrid.querySelector('.overlay-favorite')||$('overlay-favorites-title');next.focus({preventScroll:true});}
  $('overlay-catalog-status').textContent=`${entries.get(key)} ${wasFavorite?'quitado de':'añadido a'} favoritos.${saved?'':' No se pudo guardar en este navegador; se conservará mientras esta página siga abierta.'}`;
 }
 const previewObserver=new IntersectionObserver(entries=>{
  for(const entry of entries){
   const view=entry.target;
   if(!view.isConnected){previewObserver.unobserve(view);continue;}
   if(entry.isIntersecting&&!document.hidden){
    if(view.dataset.previewSource&&(!view.getAttribute('src')||view.getAttribute('src')==='about:blank'))view.src=view.dataset.previewSource;
   }else if(view.getAttribute('src')&&view.getAttribute('src')!=='about:blank'){
    view.dataset.previewSource=view.getAttribute('src');view.src='about:blank';
   }
  }
 });
 previewObserver.observe(frame);
 document.addEventListener('visibilitychange',()=>{
  for(const view of [frame,...grid.querySelectorAll('iframe')]){
   if(document.hidden&&view.getAttribute('src')&&view.getAttribute('src')!=='about:blank'){
    view.dataset.previewSource=view.getAttribute('src');view.src='about:blank';
   }else if(!document.hidden){previewObserver.unobserve(view);previewObserver.observe(view);}
  }
 });
 function createCard(key,label,compact=false){
  const card=el('article',undefined,'overlay-card');card.dataset.key=key;card.classList.toggle('overlay-card-compact',compact);card.classList.toggle('selected',key===selected);
  const choose=el('button',undefined,'overlay-card-open');choose.type='button';choose.setAttribute('aria-label',`Configurar ${label}`);
  const viewport=el('span',undefined,compact?'overlay-favorite-symbol':'overlay-card-preview');if(compact){const section=sections.find(section=>section.parts.some(part=>part[2].some(item=>item[0]===key)));viewport.append(icon(section.icon));}else{const mini=el('iframe');mini.loading='lazy';mini.dataset.previewSource=key==='animation-energy-ring'?'/static/energy_ring_preview.html?preview=1':`/widget/${key}?preview=1`;mini.title=`Vista previa de ${label}`;mini.tabIndex=-1;mini.setAttribute('aria-hidden','true');mini.setAttribute('sandbox','allow-scripts allow-same-origin');viewport.append(mini);previewObserver.observe(mini);}
  const copy=el('span',undefined,'overlay-card-copy');copy.append(el('strong',label,'overlay-card-name'),el('span',describe(key),'overlay-card-description'),el('span','Configurar →','overlay-card-cta'));
  choose.append(viewport,copy);choose.onclick=()=>{returnKey=key;select(key,label,card);};
  const star=el('button',undefined,'overlay-favorite');star.type='button';star.dataset.key=key;star.append(icon('star'));updateStar(star,key);star.onclick=()=>toggleFavorite(key,star);
  card.append(choose,star);return card;
 }
 function renderFavorites(){
  favoritesGrid.replaceChildren();$('overlay-favorites-count').textContent=favorites.size?`${favorites.size} guardados`:'';
  if(!favorites.size){const empty=el('div',undefined,'overlay-favorites-empty');empty.append(icon('star'),el('p','Tus favoritos aparecerán aquí. Pulsa la estrella de cualquier overlay para guardarlo.'));favoritesGrid.append(empty);return;}
  for(const key of favorites)favoritesGrid.append(createCard(key,entries.get(key),catalogMode!=='favorites'));
 }
 function renderCategory(index){
  categoryIndex=index;const section=sections[index];catalogMode=section.key;favoritesSection.hidden=true;categories.hidden=true;browseTitle.hidden=true;resultsHeading.hidden=false;grid.hidden=false;
  for(const button of categories.children){const active=Number(button.dataset.index)===index;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));}
  $('overlay-results-title').textContent=section.title;$('overlay-results-description').textContent=section.description;
  $('overlay-results-count').textContent=`${section.parts.reduce((n,part)=>n+part[2].length,0)} overlays`;
  for(const view of grid.querySelectorAll('iframe'))previewObserver.unobserve(view);
  grid.replaceChildren();
  for(const [title,description,items] of section.parts){
    const group=el('section',undefined,'overlay-result-group'),heading=el('div',undefined,'overlay-group-heading'),headingTitle=el('h4',title);headingTitle.id=`overlay-group-${index}-${grid.children.length}`;group.setAttribute('aria-labelledby',headingTitle.id);heading.append(headingTitle,el('p',description));
    const cards=el('div',undefined,'overlay-card-grid');for(const [key,label] of items)cards.append(createCard(key,label));group.append(heading,cards);grid.append(group);
  }
 }
 function renderFavoritesView(){
  catalogMode='favorites';categoryIndex=-1;favoritesSection.hidden=false;categories.hidden=true;browseTitle.hidden=true;resultsHeading.hidden=true;grid.hidden=true;
  $('overlay-favorites-title').textContent='Favoritos';renderFavorites();$('overlay-catalog-status').textContent=favorites.size?'Tus overlays guardados.':'Aún no tienes favoritos. Añádelos con la estrella desde Animaciones, Efectos, Herramientas o Metas.';
 }
 sections.forEach((section,index)=>{
  const button=el('button',undefined,'overlay-category');button.type='button';button.dataset.index=index;button.setAttribute('aria-controls','overlay-grid');
  const copy=el('span',undefined,'overlay-category-copy');copy.append(el('strong',section.title),el('span',section.description));
  button.append(icon(section.icon),copy,el('span',String(section.parts.reduce((n,part)=>n+part[2].length,0)),'overlay-category-count'));
  button.onclick=()=>{renderCategory(index);$('overlay-catalog-status').textContent=`Categoría: ${section.title}.`;$('overlay-results-title').focus({preventScroll:true});$('overlay-results-title').scrollIntoView({block:'nearest',behavior:'auto'});};categories.append(button);
 });
 function showEditor(){catalog.hidden=true;editor.hidden=false;name.tabIndex=-1;name.focus({preventScroll:true});editor.scrollIntoView({block:'start',behavior:'auto'});}
 $('overlay-back').onclick=()=>{
  editor.hidden=true;catalog.hidden=false;
  const target=[...catalog.querySelectorAll('.overlay-card')].find(card=>card.dataset.key===returnKey)?.querySelector('.overlay-card-open')||categories.children[categoryIndex];
  target?.focus({preventScroll:true});target?.scrollIntoView({block:'nearest',behavior:'auto'});
 };
 async function select(key,label,card,changingVariant=false){selected=key;returnKey=canonical(key);showVariants(key);settingsPanel='';form.inert=true;$('overlay-save').disabled=true;$('overlay-reset').disabled=true;OverlayCanvas.apply('horizontal');showGameControls(key);AnimationControls.select(key.startsWith('animation-')?key.slice(10):'');window.BuddiesControls?.select(key==='stream-buddies');window.SeasonalControls?.select(key.startsWith('seasonal-')?key.slice(9):'');window.EmojiControls?.select(key==='chat-emojis');window.UserInfoControls?.select(key==='user-info');for(const b of catalog.querySelectorAll('.overlay-card'))b.classList.toggle('selected',b.dataset.key===canonical(key));name.textContent=entries.get(canonical(key));if(!changingVariant)showEditor();const url=`${location.origin}/widget/${key}`;frame.src=key==='animation-energy-ring'?'/static/energy_ring_preview.html?preview=1':key==='point-drop'?`${url}?editor=1`:`${url}?preview=1`;OverlayCanvas.setTarget(`/widget/${key}`,{preview:key==='stream-buddies'});open.textContent=key==='stream-buddies'?'Abrir vista previa en pantalla completa':'Abrir en pantalla completa';status.textContent='Cargando estilo guardado…';if(key.startsWith('animation-')||key==='user-info'||key==='chat-emojis'||key==='stream-buddies'||key.startsWith('seasonal-')){$('overlay-editor').scrollIntoView({block:'start'});return;}try{const d=await api(`/widget-settings/${key}`);if(selected!==key||editor.hidden)return;settings=d.settings;settingsPanel=key;fill();form.inert=false;$('overlay-save').disabled=false;$('overlay-reset').disabled=false;await loadGoal(key);if(selected!==key||editor.hidden)return;preview();status.textContent=key==='point-drop'?'Alcancía en directo · los botones depositan regalos en el overlay.':'Vista previa privada · datos de ejemplo.';}catch(e){if(selected===key)status.textContent=e.message}}
 frame.addEventListener('load',preview);form.addEventListener('input',()=>{preview();status.textContent='Cambios sin guardar · la vista previa es privada.'});form.addEventListener('change',preview);theme.onchange=()=>presets[theme.value]?choosePreset(theme.value):markPreset();
 canvasFormat.onchange=()=>OverlayCanvas.apply(canvasFormat.value);
 form.onsubmit=async e=>{e.preventDefault();if(!selected||settingsPanel!==selected)return;const button=$('overlay-save');button.disabled=true;try{const d=await api(`/widget-settings/${selected}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(read())});settings=d.settings;fill();status.textContent='Estilo guardado. El programa de streaming recibirá esta configuración.'}catch(err){status.textContent=err.message}finally{button.disabled=false}};
 $('overlay-reset').onclick=async()=>{if(!selected||!(window.I18n?.confirm ?? confirm)('¿Restaurar el estilo predeterminado de este overlay?'))return;try{const d=await api(`/widget-settings/${selected}`,{method:'DELETE'});settings=d.settings;fill();preview();status.textContent='Estilo predeterminado restaurado.'}catch(e){status.textContent=e.message}};
 $('overlay-copy').onclick=async()=>{try{await navigator.clipboard.writeText(code.textContent);status.textContent=OverlayCanvas.current()==='vertical'?'URL 9:16 copiada. Usa 1080 × 1920 en tu fuente de navegador.':'URL 16:9 copiada. Usa 1920 × 1080 en tu fuente de navegador.'}catch(_){status.textContent='Selecciona y copia la dirección mostrada.'}};
 window.addEventListener('tikreader:open-overlay',event=>{const key=event.detail?.key;if(!variants.has(key))return;const index=sections.findIndex(section=>section.parts.some(part=>part[2].some(item=>item[0]===canonical(key))));renderCategory(index);select(key,event.detail?.label||entries.get(canonical(key)));});
 window.addEventListener('tikreader:open-overlay-section',event=>{const section=event.detail?.section;editor.hidden=true;catalog.hidden=false;if(section==='favorites')renderFavoritesView();else{const index=sections.findIndex(item=>item.key===section),safeIndex=index<0?2:index;renderCategory(safeIndex);$('overlay-catalog-status').textContent=`Sección: ${sections[safeIndex].title}.`;}});
 renderFavorites();renderCategory(0);
})();

