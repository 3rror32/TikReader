process.env.PLAYWRIGHT_BROWSERS_PATH ||= require('node:path').resolve(__dirname,'../runtime/playwright-browsers');
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const base='http://localhost:5000',dest='assets/sprites/walk-v3';
const capture=!process.argv.includes('--no-screenshots');
const themes=['chibis','cyborgs','dinosaurios','elfos','fantasia','goblins','mascotas','monstruos'];

(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:980}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base+'/static/stream-buddies/walk-v3/review.html');
  await page.waitForFunction(()=>actors.length===80&&actors.every(a=>a.img.complete&&a.img.naturalWidth===a.meta.frames*128));
  const results=[];
  for(const theme of themes){
   await page.selectOption('#theme',theme);
   const observed=await page.evaluate(async()=>{
    const visible=actors.filter(a=>!a.article.hidden),sets=visible.map(()=>new Set()),start=performance.now();
    await new Promise(resolve=>{function sample(){visible.forEach((a,i)=>sets[i].add(a.frame));if(performance.now()-start<1500)requestAnimationFrame(sample);else resolve()}sample()});
    return visible.map((a,i)=>({character:a.key,frames:a.meta.frames,observed:sets[i].size}));
   });
   assert.ok(observed.every(a=>a.observed>=Math.min(8,a.frames)),theme);
   if(capture)await page.screenshot({path:dest+'/browser-'+theme+'.png',fullPage:true});results.push(...observed);
  }
  const representatives=['chibis-2','mascotas-0','dinosaurios-0','dinosaurios-1','cyborgs-0','cyborgs-6','fantasia-0'],directional=[];
  for(const speed of [4,18])for(const direction of [1,-1]){
   const observed=await page.evaluate(async({representatives,speed,direction})=>{
    $('speed').value=String(speed);$('travel').checked=false;
    const visible=actors.filter(a=>representatives.includes(a.key)),sets=visible.map(()=>new Set());
    for(const a of actors){a.article.hidden=!visible.includes(a);a.dir=direction}
    const duration=Math.max(...visible.map(a=>128*a.meta.stride/Math.min(speed,128*a.meta.stride*1.8)))*1000+300,start=performance.now();
    await new Promise(resolve=>{function sample(){visible.forEach((a,i)=>sets[i].add(a.frame));if(performance.now()-start<duration)requestAnimationFrame(sample);else resolve()}sample()});
    return visible.map((a,i)=>({character:a.key,frames:a.meta.frames,observed:sets[i].size}));
   },{representatives,speed,direction});
   assert.ok(observed.every(a=>a.observed===a.frames),JSON.stringify({speed,direction,observed}));
   if(capture)await page.screenshot({path:`${dest}/browser-representatives-${speed}-${direction}.png`,fullPage:true});
   directional.push({speed,direction,cycles:observed});
  }
  await page.goto(base+'/widget/stream-buddies?preview=1');
  const overlay=[];
  for(const theme of themes)for(const speed of [10,40,100,0]){
   await page.evaluate(settings=>postMessage({type:'buddies-preview',settings},location.origin),{theme,speed,max_friends:10});
   await page.waitForFunction(({theme,speed})=>{
    const images=[...document.querySelectorAll('.buddy-art img')];
    return images.length===10&&images.every(img=>{
     const key=img.src.match(/\/([^/]+?)(?:-idle)?\.png/)[1],meta=BUDDY_WALK_METADATA[key];
     return key.startsWith(theme+'-')&&meta&&img.complete&&img.naturalWidth===(speed?meta.frames*128:128);
    });
   },{theme,speed});
   await page.waitForTimeout(80);
   const poses=await page.locator('.buddy-art').evaluateAll(nodes=>nodes.map(art=>{
    const img=art.querySelector('img'),key=img.src.match(/\/([^/]+?)(?:-idle)?\.png/)[1];
    return {character:key,frame:Number(art.dataset.frame),frames:BUDDY_WALK_METADATA[key].frames};
   }));
   assert.equal(new Set(poses.map(p=>p.character)).size,10);
   assert.ok(poses.every(p=>p.frame>=0&&p.frame<p.frames&&(!speed?p.frame===0:true)),JSON.stringify({theme,speed,poses}));
   overlay.push({theme,speed,characters:poses.length,frameCounts:[...new Set(poses.map(p=>p.frames))]});
  }
  assert.deepEqual(errors,[]);
  const report={characters:results.length,frames:results.reduce((n,a)=>n+a.frames,0),results,directional,overlay,errors};
  fs.writeFileSync(dest+'/browser-validation.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify({characters:report.characters,frames:report.frames,directionalRuns:directional.length,overlayRuns:overlay.length,errors}));
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
