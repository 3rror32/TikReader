process.env.PLAYWRIGHT_BROWSERS_PATH ||= require('node:path').resolve(__dirname,'../runtime/playwright-browsers');
const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
const dest='assets/sprites/walk-v3',url='http://127.0.0.1:5000/static/stream-buddies/walk-v3/dragon-prototype.html';
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1320,height:850}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));await page.goto(url);await page.waitForFunction(()=>ready);
  const result=await page.evaluate(async()=>{
   // Record the actual canvas playback, including translation, at both speeds
   // and directions. A little over two complete slow cycles are observed.
   const duration=2*metadata.stride*128/4*1000+500,sets=panels.map(()=>new Set()),positions=panels.map(()=>[]);
   const chunks=[],recorder=new MediaRecorder(canvas.captureStream(60),{mimeType:'video/webm;codecs=vp8'});
   recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data)};
   const recording=new Promise(resolve=>recorder.onstop=async()=>{
    const bytes=new Uint8Array(await new Blob(chunks,{type:'video/webm'}).arrayBuffer());let text='';
    for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));resolve(btoa(text));
   });
   start=performance.now();recorder.start();const began=performance.now();
   await new Promise(resolve=>{function sample(){
    panels.forEach((panel,i)=>{if(Number.isInteger(panel.frame))sets[i].add(panel.frame);positions[i].push(panel.distance||0)});
    if(performance.now()-began<duration)requestAnimationFrame(sample);else resolve();
   }sample()});
   recorder.stop();const video=await recording;
   return {video,duration,cycles:panels.map((panel,i)=>({speed:panel.speed,direction:panel.dir,observed:[...sets[i]].sort((a,b)=>a-b),distance:Math.max(...positions[i])-Math.min(...positions[i])}))};
  });
  assert.ok(result.cycles.every(c=>c.observed.length===24&&c.distance>20),JSON.stringify(result.cycles));assert.deepEqual(errors,[]);
  fs.writeFileSync(dest+'/dragon-prototype-playback.webm',Buffer.from(result.video,'base64'));
  fs.writeFileSync(dest+'/dragon-prototype-contact.png',Buffer.from(await page.evaluate(()=>chronologicalSheet()),'base64'));
  await page.screenshot({path:dest+'/dragon-prototype-browser.png',fullPage:true});
  const report={character:'fantasia-0',duration:result.duration,cycles:result.cycles,errors,preview:url};
  fs.writeFileSync(dest+'/dragon-prototype-validation.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
