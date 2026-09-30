const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
function render(name){return fs.readFileSync(path.join(root,'web/templates',name),'utf8').replace(/{% include '([^']+)' %}/g,(_,file)=>render(file)).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,tag=>{const file=tag.match(/href="\/static\/([^"?]+\.css)/);return file?`<style>${fs.readFileSync(path.join(root,'web/static',file[1]),'utf8')}</style>`:'';});}
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
const page=await browser.newPage();let html=render('index.html');await page.route('**/*',r=>r.request().isNavigationRequest()?r.fulfill({contentType:'text/html',body:html}):r.abort());await page.goto('http://ui.test');
for(const skin of ['original','light','ice','kawai','dark','cute','dracula','one-dark-pro','github-dark','monokai']){
await page.evaluate(s=>document.documentElement.dataset.skin=s,skin);
const result=await page.evaluate(()=>{const buttons=[...document.querySelectorAll('button')];return {count:buttons.length,bad:buttons.filter(b=>{const s=getComputedStyle(b);return s.paddingTop==='0px'||s.fontFamily==='Arial';}).map(b=>b.id)};});assert.deepEqual(result.bad,[],skin+': buttons without styling');console.log(skin+': '+result.count+' buttons styled');}
html=render('moderator.html');await page.goto('http://ui.test/moderator');
for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`moderator overflow ${width}`);await page.locator('#token').focus();assert.notEqual(await page.locator('#token').evaluate(e=>getComputedStyle(e).outlineStyle),'none');}
await page.screenshot({path:path.join(root,'docs/screenshots/qa-ui-moderator.png')});
await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(root,'docs/screenshots/qa-ui-moderator-mobile.png')});
await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('button').last().evaluate(e=>getComputedStyle(e).transitionDuration),'1e-05s');console.log('Moderator: 320–1440px, keyboard focus and reduced motion OK');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
