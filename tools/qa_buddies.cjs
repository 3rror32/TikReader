const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const settings={theme:'fantasia',font:'Verdana',font_size:14,line_spacing:120,letter_spacing:0,max_friends:20,base_size:56,max_size:112,coins_to_max:1000,bubbles:true,speech_duration:4,speed:40,show_names:true};
 const themes=['fantasia','mascotas','dinosaurios','cyborgs','goblins','elfos','monstruos','chibis'];
 const characters=themes.flatMap(theme=>Array.from({length:10},(_,i)=>({id:theme+'-'+i,theme})));
 let coins=1000; const errors=[];
 const page=await browser.newPage({viewport:{width:390,height:844}});page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>{
  const u=new URL(r.request().url());
  if(u.pathname==='/broadcast/stream-buddies')return r.fulfill({json:{settings,session:'qa',muted:false,members:[{id:'a',character_id:'fantasia-0',user:'Luna',coins},{id:'b',character_id:'fantasia-1',user:'Carlos',coins:200}]}});
  if(u.pathname.startsWith('/static/')){const f=u.pathname.replace('/static/stream-buddies/','assets/sprites/').replace('/static/','web/static/');return r.fulfill({path:path.join(root,f)});}
  const html=fs.readFileSync(path.join(root,'web/templates/stream_buddies.html'),'utf8').replace(/{{[\s\S]*?}}/,JSON.stringify({settings,characters}));return r.fulfill({contentType:'text/html',body:html});
 });
 await page.goto('http://buddies.test/widget/stream-buddies');
 await page.waitForFunction(()=>document.querySelectorAll('.buddy img').length===2&&[...document.images].every(i=>i.complete&&i.naturalWidth===(globalThis.BUDDY_WALK_METADATA?.[i.src.split('/').pop().split('.')[0]]?.frames||24)*128));
 const size=await page.locator('.buddy').first().evaluate(e=>parseFloat(e.style.width));assert.ok(size<=390*.24);
 const small=await page.locator('.buddy').nth(1).evaluate(e=>parseFloat(e.style.width));assert.ok(small<size);
 assert.equal(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgba(0, 0, 0, 0)');
 coins=99999;await page.waitForTimeout(1100);assert.equal(await page.locator('.buddy').first().evaluate(e=>parseFloat(e.style.width)),size);
 assert.equal(await page.locator('.buddy').first().getAttribute('data-level'),'10');
 const f1=await page.locator('.buddy-art').first().getAttribute('data-frame');await page.waitForTimeout(80);const f2=await page.locator('.buddy-art').first().getAttribute('data-frame');assert.notEqual(f1,f2);
 await page.goto('http://buddies.test/widget/stream-buddies?preview=1');await page.waitForFunction(()=>document.images.length===10&&[...document.images].every(i=>i.complete));
 await page.screenshot({path:path.join(root,'assets/sprites/mobile-preview.png'),omitBackground:true});
 for(const theme of themes){await page.evaluate(theme=>window.postMessage({type:'buddies-preview',settings:{theme}},location.origin),theme);await page.waitForFunction(()=>document.images.length===10&&[...document.images].every(i=>i.complete&&i.naturalWidth===(globalThis.BUDDY_WALK_METADATA?.[i.src.split('/').pop().split('.')[0]]?.frames||24)*128));assert.equal(await page.evaluate(()=>new Set([...document.images].map(i=>i.src)).size),10);}
 await page.setViewportSize({width:1280,height:720});await page.screenshot({path:path.join(root,'assets/sprites/desktop-preview.png'),omitBackground:true});
 assert.deepEqual(errors,[]);console.log('Browser QA passed: 8 collections, unique sprites, walking, transparent canvas, mobile sizing, 1000-coin cap.');
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
