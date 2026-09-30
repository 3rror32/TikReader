// Real catalog UI with local widget previews; API writes stay inside this fixture.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
function render(name){return fs.readFileSync(path.join(root,'web/templates',name),'utf8').replace(/{% include '([^']+)' %}/g,(_,file)=>render(file)).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,tag=>{const file=tag.match(/href="\/static\/([^"?]+\.css)/);return file?`<style>${fs.readFileSync(path.join(root,'web/static',file[1]),'utf8')}</style>`:'';});}
const settings={theme:'dark',background:'#101925',text_color:'#f4f7fc',accent_color:'#85dec5',border_color:'#2c3a4b',font_family:'Inter',font_size:23,title_size:15,radius:16,opacity:93,show_background:true,show_avatar:true,show_name:true,show_time:true,show_details:true,show_connection:false,max_items:8,alignment:'left',layout:'stack',animation:'none',canvas_format:'horizontal'};
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];let writes=0;
  page.on('pageerror',e=>errors.push(e.message));await page.emulateMedia({reducedMotion:'reduce'});
  await page.route('**/*',route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.origin!=='http://catalog.test')return route.abort();
   if(url.pathname.startsWith('/static/')){const file=path.resolve(root,'web',url.pathname.slice(1));if(file.startsWith(path.join(root,'web','static')+path.sep)&&fs.existsSync(file))return route.fulfill({path:file});return route.abort();}
   if(url.pathname.startsWith('/widget-settings/')){if(req.method()==='POST')writes++;return route.fulfill({json:{settings}});}
   if(url.pathname.startsWith('/overlay-goals/'))return route.fulfill({json:{settings:{title:'Objectif',goal:100,value:25,gift:'Rose'}}});
   if(url.pathname.startsWith('/overlay-animations/'))return route.fulfill({json:{settings:{enabled:false,trigger:'like',duration:4,size:40,cooldown:2,amount:1,volume:0,color:'#ff77aa',position:'center',motion:'reduced'}}});
   if(url.pathname.startsWith('/widget/')){const panel=url.pathname.split('/').pop();let html=fs.readFileSync(path.join(root,'web/templates/widget.html'),'utf8').replaceAll('{{ panel }}',panel);return route.fulfill({contentType:'text/html',body:html});}
   if(req.isNavigationRequest())return route.fulfill({contentType:'text/html',body:render('index.html')});
   return route.fulfill({json:{}});
  });
  async function boot(){await page.goto('http://catalog.test');for(const file of ['overlay_canvas_controls.js','overlay_animation_controls.js','overlay_gallery.js','shell.js','sidebar.js','skins.js'])await page.addScriptTag({path:path.join(root,'web/static',file)});await page.evaluate(()=>Shell.show('overlay-gallery'));}
  await boot();
  assert.equal(await page.locator('#overlay-catalog input[type=search]').count(),0);
  assert.equal(await page.locator('#overlay-editor').isVisible(),false);
  assert.equal(await page.locator('#overlay-categories button').count(),6);
  const keys=[];
  for(let index=0;index<6;index++){await page.locator(`#overlay-categories [data-index="${index}"]`).click();keys.push(...await page.locator('#overlay-grid .overlay-card').evaluateAll(nodes=>nodes.map(n=>n.dataset.key)));}
  assert.equal(new Set(keys).size,keys.length,'Each overlay has exactly one category');
  const server=fs.readFileSync(path.join(root,'app/server.py'),'utf8'),panels=[...server.split('WIDGET_PANELS = {')[1].split('}')[0].matchAll(/'([^']+)'/g)].map(m=>m[1]);
  assert(keys.length < panels.length, 'Variants must share catalog cards');
  const covered=new Set(keys);
  for(const key of keys){await page.evaluate(key=>window.dispatchEvent(new CustomEvent('tikreader:open-overlay',{detail:{key}})),key);for(const variant of await page.locator('#overlay-variant option').evaluateAll(nodes=>nodes.map(n=>n.value)))covered.add(variant);await page.locator('#overlay-back').click();}
  for(const key of panels)assert(covered.has(key),`Missing overlay variant ${key}`);
  await page.locator('#overlay-categories [data-index="0"]').click();
  const star=page.locator('#overlay-grid [data-key="chat"] .overlay-favorite');
  await star.focus();await page.keyboard.press('Space');
  assert.equal(await star.getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#overlay-favorites-grid .overlay-card').count(),1);
  assert.equal(await page.locator('#overlay-editor').isVisible(),false,'Starring must not open the editor');
  await boot();assert.equal(await page.locator('#overlay-favorites-grid [data-key="chat"]').count(),2); // card and its star
  await page.locator('#overlay-favorites-grid .overlay-card-open').click();
  assert.equal(await page.locator('#overlay-catalog').isVisible(),false);
  assert.equal(await page.locator('#overlay-preview-name').textContent(),'Chat y comentarios');
  await page.waitForFunction(()=>!document.getElementById('overlay-save').disabled);
  assert.equal(await page.locator('#overlay-selected-url').textContent(),'http://catalog.test/widget/chat');
  await page.locator('#overlay-style-form [data-key="canvas_format"]').selectOption('vertical');
  assert.equal(await page.locator('.overlay-screen').getAttribute('data-canvas-format'),'vertical');
  assert.equal(await page.locator('.overlay-stage-bar b').textContent(),'9:16 · ZONA SEGURA');
  await page.locator('#overlay-save').click();await page.waitForFunction(()=>document.getElementById('overlay-gallery-status').textContent.includes('Estilo guardado'));
  assert.equal(writes,1);
  await page.locator('#overlay-back').click();assert.equal(await page.locator('#overlay-catalog').isVisible(),true);
  assert.equal(await page.evaluate(()=>document.activeElement.className),'overlay-card-open');
  await page.locator('#overlay-categories [data-index="1"]').click();
  await page.locator('#overlay-grid [data-key="goals"] .overlay-favorite').click();
  await page.locator('#overlay-categories [data-index="0"]').click();
  await page.locator('#overlay-grid .overlay-card').first().scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>document.querySelector('#overlay-grid iframe')?.contentDocument?.querySelector('#widget')?.children.length>0,{},{timeout:10000});
  for(const skin of ['original','cloudfoam','aetheria','monolith','chromapulse','glass']){
   await page.evaluate(skin=>{document.documentElement.dataset.skin=skin;document.querySelector('.config-content').scrollTop=0;},skin);
   for(const width of [390,1440]){await page.setViewportSize({width,height:1100});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${skin} ${width}: page overflow`);
    const overflow=await page.locator('#overlay-categories').evaluate(e=>e.scrollWidth>e.clientWidth+1);assert.equal(overflow,false,'No horizontal category scrolling');
    await page.screenshot({path:path.join(root,`docs/screenshots/qa-catalog-${skin}-${width}.png`)});
   }
  }
  await page.locator('#overlay-favorites-grid [data-key="chat"] .overlay-favorite').click();
  assert.equal(await page.locator('#overlay-grid [data-key="chat"] .overlay-favorite').getAttribute('aria-pressed'),'false');
  await page.evaluate(()=>{localStorage.setItem('tikreader.overlay-favorites','broken json');});await boot();assert.equal(await page.locator('.overlay-favorites-empty').count(),1);
  await page.evaluate(()=>Object.defineProperty(Storage.prototype,'setItem',{configurable:true,value(){throw Error('blocked')}}));
  await page.locator('#overlay-grid [data-key="chat"] .overlay-favorite').click();assert((await page.locator('#overlay-catalog-status').textContent()).includes('No se pudo guardar'));
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('tikreader:open-overlay',{detail:{key:'goal-likes'}})));
  assert.equal(await page.locator('#overlay-preview-name').textContent(),'Metas y cuenta regresiva');
  await page.locator('#overlay-variant').selectOption('countdown-coins');
  await page.waitForFunction(()=>!document.getElementById('overlay-save').disabled);
  assert.equal(await page.locator('#overlay-selected-url').textContent(),'http://catalog.test/widget/countdown-coins');
  await page.locator('#overlay-save').click();
  await page.waitForFunction(()=>document.getElementById('overlay-gallery-status').textContent.includes('Estilo guardado'));
  await page.locator('#overlay-back').click();
  assert.equal(await page.evaluate(()=>document.activeElement.closest('.overlay-card').dataset.key),'goals');
  await boot();
  await page.evaluate(()=>localStorage.setItem('tikreader.overlay-favorites',JSON.stringify(['goal-likes','countdown-coins','animation-vip-hearts','animation-hearts'])));
  await boot();
  assert.equal(await page.locator('#overlay-favorites-grid .overlay-card').count(),3,'Goals merge; effects keep individual favorites');
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('tikreader:open-overlay',{detail:{key:'animation-vip-hearts'}})));
  assert.equal(await page.locator('#overlay-variant').isVisible(),false);
  await page.locator('#overlay-back').click();
  assert.equal(await page.locator('#overlay-grid .overlay-card').count(),10,'Every effect has its own card');
  await page.locator('#overlay-grid [data-key="animation-custom"] .overlay-card-open').click();
  assert.equal(await page.locator('#overlay-selected-url').textContent(),'http://catalog.test/widget/animation-custom');
  await page.setViewportSize({width:390,height:1100});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Variant editor fits mobile');
  await page.screenshot({path:path.join(root,'docs/screenshots/qa-overlay-variants-390.png')});
  assert.deepEqual(errors,[],'No browser errors');
  console.log(`${keys.length} overlays in 6 categories; favorites, keyboard, persistence, storage failure, editor, save, back, external navigation and 6 themes at 390/1440px OK`);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});




