const {chromium}=require('playwright');const assert=require('node:assert/strict');const fs=require('node:fs');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{const page=await b.newPage({viewport:{width:1440,height:980}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://localhost:5000/static/stream-buddies/walk-v3/review.html');await page.waitForFunction(()=>actors.length===80&&actors.every(a=>a.img.complete&&a.img.naturalWidth===a.meta.frames*128));
const results=[];
for(const theme of ['chibis','cyborgs','dinosaurios','elfos','fantasia','goblins','mascotas','monstruos']){
 await page.selectOption('#theme',theme);const phaseSets=Array.from({length:10},()=>new Set());
 for(let n=0;n<24;n++){const phases=await page.evaluate(()=>actors.filter(a=>!a.article.hidden).map(a=>a.frame));phases.forEach((f,i)=>phaseSets[i].add(f));await page.waitForTimeout(50);}
 assert.ok(phaseSets.every(s=>s.size>=8),theme);await page.screenshot({path:'assets/sprites/walk-v3/browser-'+theme+'.png',fullPage:true});results.push({theme,characters:10,minObservedPoses:Math.min(...phaseSets.map(s=>s.size))});
}
await page.evaluate(()=>{for(const a of actors)a.dir=-1});await page.waitForTimeout(200);await page.screenshot({path:'assets/sprites/walk-v3/browser-left.png',fullPage:true});
await page.goto('http://localhost:5000/widget/stream-buddies?preview=1');await page.waitForFunction(()=>document.images.length===10&&[...document.images].every(i=>i.complete&&i.naturalWidth===3072));
for(const speed of [10,40,100,0]){
 await page.evaluate(speed=>postMessage({type:'buddies-preview',settings:{speed}},location.origin),speed);
 await page.waitForFunction(speed=>[...document.images].every(i=>i.complete&&i.naturalWidth===(speed?3072:128)),speed);
 await page.waitForTimeout(100);
 const frames=await page.locator('.buddy-art').evaluateAll(nodes=>nodes.map(n=>Number(n.dataset.frame)));assert.ok(frames.every(f=>f>=0&&f<24));if(!speed)assert.ok(frames.every(f=>f===0));
}
assert.deepEqual(errors,[]);fs.writeFileSync('assets/sprites/walk-v3/browser-validation.json',JSON.stringify({results,errors},null,2));console.log(JSON.stringify({results,errors}));
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
