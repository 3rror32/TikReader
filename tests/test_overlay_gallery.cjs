process.chdir(require('node:path').resolve(__dirname, '..'));
const fs=require('node:fs'),assert=require('node:assert/strict'),test=require('node:test');
const vm=require('node:vm');
const gallery=fs.readFileSync('web/static/overlay_gallery.js','utf8');
const shell=fs.readFileSync('web/static/shell.js','utf8');
const menuStyles=fs.readFileSync('web/static/live_refinement.css','utf8');
const sidebarStyles=fs.readFileSync('web/static/sidebar.css','utf8');
const galleryStyles=fs.readFileSync('web/static/overlay_gallery.css','utf8');
const widgetsRoute=fs.readFileSync('app/widget_routes.py','utf8');
const canvas=fs.readFileSync('web/static/overlay_canvas_controls.js','utf8');

test('point-drop runtime scripts share the refreshed cache version',()=>{
 const index=fs.readFileSync('web/templates/index.html','utf8'),widget=fs.readFileSync('web/templates/widget.html','utf8');
 for(const [source,script] of [[index,'live_games.js'],[index,'bank_editor.js'],[index,'piggy_bank.js'],[index,'overlay_gallery.js'],[index,'overlay_canvas_controls.js'],[widget,'piggy_bank.js'],[widget,'widgets.js']])
  assert.match(source,new RegExp(`/static/${script.replace('.','\\.')}\\?v=point-drop-6`),script);
 assert.match(index,/overlay_gallery\.css\?v=point-drop-6/);
});

test('preview actions use concise labels and editor action styling is responsive and focusable', () => {
 const index=fs.readFileSync('web/templates/index.html','utf8'),styles=fs.readFileSync('web/static/overlay_gallery.css','utf8');
 assert.match(index,/class="overlay-actions"[^>]*><a[^>]*>Pantalla completa<\/a><button[^>]*>Repetir<\/button><button[^>]*>Copiar URL<\/button>/);
 assert.match(gallery,/open\.textContent='Pantalla completa'/);
 assert.match(gallery,/\$\('overlay-test-event'\)\.textContent='Repetir'/);
 assert.match(canvas,/copy\.textContent='Copiar URL'/);
 assert.match(styles,/\.bank-editor-actions\{[^}]*display:grid[^}]*gap:\s*8px/s);
 assert.match(styles,/\.bank-editor-actions button:focus-visible/);
 assert.match(styles,/@media\(max-width:650px\)\{[^}]*\.overlay-actions/s);
});

test('empty overlay editor status is hidden without suppressing useful feedback', () => {
 const styles=fs.readFileSync('web/static/overlay_gallery.css','utf8');
 assert.ok(styles.includes('.overlay-editor>#overlay-gallery-status:empty{display:none!important}'));
 assert.ok(styles.includes('.overlay-editor>#overlay-gallery-status{')&&styles.includes('background:#09151adf'));
 assert.doesNotMatch(styles,/\.overlay-editor>#overlay-gallery-status\{[^}]*position:\s*sticky|\.overlay-editor>#overlay-gallery-status\{[^}]*bottom:/s);
 assert.ok(styles.includes('.piggy-editor .bank-editor-placement>label[hidden]{display:none!important}'));
});

test('overlay control selection clears stale status without intro notices',()=>{
 const controls=['seasonal_controls.js','emoji_controls.js','user_info_controls.js','stream_buddies_controls.js','overlay_animation_controls.js'];
 for(const file of controls){
  const source=fs.readFileSync(`web/static/${file}`,'utf8');
  const select=source.slice(source.indexOf('async function select('));
  assert.match(select,/\$\('overlay-gallery-status'\)\.textContent\s*=\s*''/);
  assert.doesNotMatch(select,/overlay-gallery-status'\)\.textContent\s*=\s*['"`][^'"`]*(?:Vista privada|Vista previa privada|personajes por colección|emojis de ejemplo|usuario de ejemplo)/);
 }
});

test('overlay navigation exposes the built-in and user package destinations',()=>{
 for(const label of ['Animaciones','Efectos','Herramientas','Metas','Favoritos','Mis overlays','Mis animaciones'])assert.match(shell,new RegExp(`"${label}"`));
 for(const key of ['animations','effects','tools','goals'])assert.match(gallery,new RegExp(`key:'${key}'`));
 const start=shell.indexOf(' const overlaySections='),end=shell.indexOf(' function focusDestination');
 assert.ok(start>=0&&end>start,'the authored route resolver must be present');
 const resolveRoute=vm.runInNewContext(`${shell.slice(start,end)};resolveRoute`,{
  views:new Map(['overlay-gallery','alerts','custom-overlays'].map(key=>[key,{}])),destinationLabels:new Map(),window:{}
 });
 for(const [key,viewKey,activeKey,section] of [
  ['overlay-gallery','overlay-gallery','overlay-favorites','favorites'],
  ...['favorites','animations','effects','tools','goals'].map(section=>[`overlay-${section}`,'overlay-gallery',`overlay-${section}`,section]),
  ['overlay-custom','custom-overlays','overlay-custom',''],
  ['overlay-my-animations','alerts','overlay-my-animations',''],
  ['animation-studio','alerts','overlay-my-animations','']
 ]){
  const route=resolveRoute(key);
  assert.ok(route,`${key} is a known destination`);
  assert.equal(route.key,key,'aliases retain their URL identity');
  assert.equal(route.viewKey,viewKey,key);
  assert.equal(route.activeKey,activeKey,key);
  assert.equal(route.overlaySection,section,key);
 }
 assert.match(gallery,/section==='favorites'\)renderFavoritesView/);
});

test('piggy bank editor hides general appearance controls and keeps its preview portrait on mobile',()=>{
 assert.match(gallery,/form\.hidden\s*=\s*piggy/);
 assert.doesNotMatch(gallery,/piggySidebar\.append\(gameHost,form\)/);
 assert.match(galleryStyles,/\.piggy-editor \.overlay-screen\{[^}]*aspect-ratio:4\/5!important/s);
 assert.doesNotMatch(galleryStyles,/\.piggy-editor \.overlay-screen\{[^}]*aspect-ratio:1;/s);
});

test('overlay submenu offers favorites and animations as independent destinations',()=>{
 const submenu=shell.match(/["']overlay-gallery["']\s*,\s*\[([\s\S]*?)\]\s*\]/);
 assert.ok(submenu, 'the overlay navigation submenu must exist');
 const destinations=[...submenu[1].matchAll(/["'](overlay-[\w-]+)["']/g)].map(([,key])=>key);
 assert.ok(destinations.includes('overlay-favorites'), 'favorites must be a direct overlay destination');
 assert.ok(destinations.includes('overlay-animations'), 'animations must be a direct overlay destination');
 assert.ok(shell.includes("key.startsWith('overlay-')"));
 assert.ok(shell.includes('overlaySection=key.slice(8)'));
});

test('every server overlay appears in the categorized gallery',()=>{
 const block=widgetsRoute.split('WIDGET_PANELS = {')[1].split('}')[0];
 const panels=[...block.matchAll(/["']([^"']+)["']/g)].map(x=>x[1]);
 for(const panel of panels)assert.match(gallery,new RegExp(`\\['${panel.replaceAll('-','\\-')}'\\s*,`),panel);
});

test('overlay personalization is inline without a duplicate settings shortcut',()=>{
 const template=fs.readFileSync('web/templates/index.html','utf8');
 assert.ok(!gallery.includes('showModal'));
 assert.doesNotMatch(template,/widget_customizer\.js/);
 assert.match(gallery,/overlay-style-form/);
});

test('overlay catalog offers search and a private replay control',()=>{
 const template=fs.readFileSync('web/templates/index.html','utf8');
 assert.match(template,/id="overlay-search"/);
 assert.match(template,/id="overlay-test-event"/);
 assert.match(gallery,/function filterCards\(\)/);
 assert.match(gallery,/Prueba reproducida únicamente en esta vista previa/);
});

test('point-drop editor gives action feedback and refreshes its embedded widget',()=>{
 const games=fs.readFileSync('web/static/live_games.js','utf8');
 const widgets=fs.readFileSync('web/static/widgets.js','utf8');
 assert.doesNotMatch(gallery,/Alcancía en directo · los botones depositan regalos en el overlay\./);
 assert.match(games,/widget-point-drop-refresh/);
 assert.match(widgets,/widget-point-drop-refresh/);
 assert.match(games,/error\.message==='Emisión silenciada'\?'Activa la emisión para lanzar regalos\.'/);
 assert.match(games,/runDropAction\(pending,action\)/);
 for(const message of ['Guardando configuración…','Configuración guardada.','Enviando rosa de ejemplo…','Rosa de ejemplo enviada a la alcancía.','Iniciando lluvia…','Lluvia completada:','Vaciando alcancía…','Alcancía vacía y marcador reiniciado.'])assert.ok(games.includes(message),`Missing point-drop feedback: ${message}`);
 assert.match(games,/control\.disabled=true/);
});

test('point-drop synchronization accepts bank updates without runtime reference errors',async()=>{
 const games=fs.readFileSync('web/static/live_games.js','utf8'),start=games.indexOf('async function syncGames(){'),end=games.indexOf('\n  }',start)+4;
 assert.ok(start>=0&&end>start,'syncGames is present');
 const syncGames=games.slice(start,end),hydrateStart=games.indexOf('function hydrateBankState('),hydrateEnd=games.indexOf('\n  function applyInitialBankState',hydrateStart),hydrate=games.slice(hydrateStart,hydrateEnd),context={
  document:{hidden:false,activeElement:null},wheel:{hidden:false},drop:{hidden:false},gamesBusy:false,
  overlayCall:async()=>({wheel:{serial:0},drop:{shapes:[],bank:'pato',score:1,size:64,events:[]}}),
   window:{PiggyBank:{models:Object.fromEntries(['cochito','cochita','pato','oso','perro','gato','custom'].map(key=>[key,{}])),setShapes(){},prepare(_piggy,bank){this.bank=bank;},setSize(){}},dispatchEvent(event){this.lastHydration=event;}},
  CustomEvent:class{constructor(type,init){this.type=type;this.detail=init.detail;}},
  spinning:false,wheelSerial:0,bankSelect:{value:'cochito'},piggy:{},dropActionBusy:false,bankStateRevision:0,
  bankState:{custom_bank_asset:null,bank_position:{x:50,y:50},bank_scale:100,entry_point:{x:50,y:16}},
  total:0,score:{textContent:''},sizePending:false,sizeSending:false,dropSize:{value:32},
  arena:{querySelectorAll(){return[];}},settledCoins:0,showDeposit(){},configNote:{textContent:''}
 };
 const publishStart=games.indexOf('function publishBankHydration('),publishEnd=games.indexOf('\n  function applyInitialBankState',publishStart),publish=games.slice(publishStart,publishEnd);
 await vm.runInNewContext(`${hydrate};${publish};${syncGames}; syncGames()`,context);
 assert.equal(context.configNote.textContent,'');
 assert.equal(context.bankSelect.value,'pato');
 assert.equal(context.window.PiggyBank.bank,'pato');
 assert.equal(context.window.lastHydration.type,'point-drop-bank-hydrated');
 assert.equal(context.window.lastHydration.detail.bank,'pato');
});

test('best gift and best streak use different ranking values',()=>{
 const widgets=fs.readFileSync('web/static/widgets.js','utf8');
 assert.match(widgets,/byGift=.*diamonds/);
 assert.match(widgets,/byStreak=.*count/);
});

test('timer controls live inside the overlay editor instead of the production menu',()=>{
 const games=fs.readFileSync('web/static/live_games.js','utf8');
 const gamesCss=fs.readFileSync('web/static/live_games.css','utf8');
 assert.doesNotMatch(shell,/"Temporizador",\s*"timer-control"/);
 assert.match(games,/registerGameControls\('timer',timer\)/);
 assert.match(games,/timer\.applyOverlaySettings=applyTimerStyle/);
 assert.match(gallery,/timer-overlay-options/);
 for(const key of ['timer_title','timer_format','timer_warning_seconds','timer_show_label','timer_show_state','timer_digit_animation','timer_animation_speed','timer_glow'])assert.match(gallery,new RegExp(key));
 assert.match(gallery,/appearance\.hidden=!active\|\|piggy\|\|timer/);
 assert.match(gallery,/node\.insertBefore\(form,configuration\)/);
 assert.match(gallery,/timerSource\.append\(sourceActions,code,sourceResolution\)/);
 assert.match(gamesCss,/\.timer-editor \.overlay-workbench\{display:none\}/);
});

test('every overlay editor offers PC and celular canvas formats',()=>{
 assert.match(canvas,/PC horizontal \(16:9\)/);
 assert.match(canvas,/Celular vertical \(9:16\)/);
 assert.match(gallery,/canvas_format/);
 assert.match(widgetsRoute,/canvas_format="horizontal"/);
 for(const file of ['overlay_animation_controls.js','stream_buddies_controls.js','seasonal_controls.js','emoji_controls.js','user_info_controls.js']){
  assert.match(fs.readFileSync('web/static/'+file,'utf8'),/OverlayCanvas/);
 }
});

test('copied overlay URL follows the selected canvas format',()=>{
 const stage={dataset:{}};
 const screen={dataset:{},closest:selector=>selector==='.overlay-stage'?stage:null};
 const nodes={
  'overlay-preview':{closest:()=>screen},
  'overlay-selected-url':{textContent:''},
  'overlay-open':{href:''},
  'overlay-copy':{textContent:''},
  'overlay-source-resolution':{textContent:''},
 };
 const window={location:{origin:'http://localhost:5000'}};
 const document={getElementById:id=>nodes[id]||null,querySelector:()=>null};
 vm.runInNewContext(
  fs.readFileSync('web/static/overlay_url.js','utf8')+'\n'+canvas,
  {window,document,URL}
 );
 window.OverlayCanvas.setTarget('/widget/chat');
 window.OverlayCanvas.apply('horizontal');
 let copied=new URL(nodes['overlay-selected-url'].textContent);
 assert.equal(copied.searchParams.get('canvas_format'),'horizontal');
 assert.equal(copied.hash,'#tikreader.local');
 assert.match(nodes['overlay-source-resolution'].textContent,/1920 × 1080/);
 window.OverlayCanvas.apply('vertical');
 assert.equal(screen.dataset.canvasFormat,'vertical');
 assert.equal(stage.dataset.canvasFormat,'vertical');
 copied=new URL(nodes['overlay-selected-url'].textContent);
 assert.equal(copied.searchParams.get('canvas_format'),'vertical');
 assert.equal(new URL(nodes['overlay-open'].href).searchParams.get('canvas_format'),'vertical');
 assert.equal(nodes['overlay-copy'].textContent,'Copiar URL');
 assert.match(nodes['overlay-source-resolution'].textContent,/1080 × 1920/);
 window.OverlayCanvas.setTarget('/widget/stream-buddies',{preview:true});
 const previewUrl=new URL(nodes['overlay-open'].href);
 assert.equal(previewUrl.searchParams.get('canvas_format'),'vertical');
 assert.equal(previewUrl.searchParams.get('preview'),'1');
});

test('effects catalog includes every ambient renderer',()=>{
 for(const key of ['fireflies','aurora','fog','embers','stars','petals','bubbles','digital-rain']){
  assert.match(gallery,new RegExp(`seasonal-${key}`),key);
 }
 const renderer=fs.readFileSync('web/static/seasonal_overlay.js','utf8');
 for(const key of ['fireflies','aurora','fog','embers','stars','petals','bubbles','digital-rain'])assert.match(renderer,new RegExp(`kind==='${key}'`),key);
});

test('bubble editor exposes separate body and reflection colors',()=>{
 const controls=fs.readFileSync('web/static/seasonal_controls.js','utf8');
 const renderer=fs.readFileSync('web/static/seasonal_overlay.js','utf8');
 assert.match(controls,/active==='bubbles'\?'Color de la burbuja':'Color principal'/);
 assert.match(controls,/active==='bubbles'\?'Color del reflejo':'Color secundario'/);
 assert.match(renderer,/body=settings\.primary_color,reflection=settings\.secondary_color/);
 assert.match(renderer,/rgba\(reflection,\.88\)/);
 assert.match(renderer,/rgba\(body,\.3\)/);
});

test('fog renderer builds organic depth layers instead of flat ellipses',()=>{
 const controls=fs.readFileSync('web/static/seasonal_controls.js','utf8');
 const renderer=fs.readFileSync('web/static/seasonal_overlay.js','utf8');
 assert.match(renderer,/fogLayers/);
 assert.match(renderer,/createImageData\(sw,sh\)/);
 assert.match(renderer,/const octaves=/);
 assert.match(renderer,/bankHeight/);
 assert.match(renderer,/globalCompositeOperation='source-over'/);
 assert.match(renderer,/1000\/30/);
 assert.match(renderer,/fogQuality/);
 assert.match(renderer,/dt\/\.7/);
 assert.match(renderer,/fog_clear_zone/);
 assert.match(controls,/Niebla baja/);
 assert.match(controls,/Niebla envolvente/);
 assert.match(controls,/Bruma cinematográfica/);
 assert.match(controls,/Mantener despejado/);
 assert.match(controls,/Densidad de la niebla/);
 assert.match(controls,/Hacia la izquierda/);
 assert.match(controls,/Visible en transmisión/);
 assert.match(controls,/Color de la niebla/);
 assert.match(controls,/Color de iluminación/);
 assert.match(controls,/values\.wind=0/);
 assert.match(controls,/inputs\.speed\.disabled/);
 assert.doesNotMatch(controls,/Probar ambiente/);
 assert.match(gallery,/selected\.startsWith\('seasonal-'\)\?'Movimiento reiniciado únicamente en esta vista previa\.'/);
});
