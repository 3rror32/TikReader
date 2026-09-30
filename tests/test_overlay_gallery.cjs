process.chdir(require('node:path').resolve(__dirname, '..'));
const fs=require('node:fs'),assert=require('node:assert/strict'),test=require('node:test');
const vm=require('node:vm');
const gallery=fs.readFileSync('web/static/overlay_gallery.js','utf8');
const customizer=fs.readFileSync('web/static/widget_customizer.js','utf8');
const shell=fs.readFileSync('web/static/shell.js','utf8');
const widgetsRoute=fs.readFileSync('app/widget_routes.py','utf8');
const canvas=fs.readFileSync('web/static/overlay_canvas_controls.js','utf8');

test('overlay navigation exposes the requested six destinations',()=>{
 for(const label of ['Animaciones','Efectos','Herramientas','Metas','Favoritos','Mis animaciones'])assert.match(shell,new RegExp(`"${label}"`));
 for(const key of ['animations','effects','tools','goals'])assert.match(gallery,new RegExp(`key:'${key}'`));
 assert.match(shell,/key==='overlay-my-animations'\)viewKey='alerts'/);
 assert.match(gallery,/section==='favorites'\)renderFavoritesView/);
});

test('every server overlay appears in the categorized gallery',()=>{
 const block=widgetsRoute.split('WIDGET_PANELS = {')[1].split('}')[0];
 const panels=[...block.matchAll(/["']([^"']+)["']/g)].map(x=>x[1]);
 for(const panel of panels)assert.match(gallery,new RegExp(`\\['${panel.replaceAll('-','\\-')}'\\s*,`),panel);
});

test('overlay personalization is inline and legacy buttons route to it',()=>{
 assert.ok(!gallery.includes('showModal'));
 assert.ok(!customizer.includes('showModal'));
 assert.match(customizer,/Shell\?\.show\('overlay-gallery'\)/);
 assert.match(gallery,/overlay-style-form/);
});

test('best gift and best streak use different ranking values',()=>{
 const widgets=fs.readFileSync('web/static/widgets.js','utf8');
 assert.match(widgets,/byGift=.*diamonds/);
 assert.match(widgets,/byStreak=.*count/);
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
 assert.equal(nodes['overlay-copy'].textContent,'Copiar URL · 9:16');
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
