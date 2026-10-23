process.env.PLAYWRIGHT_BROWSERS_PATH ||= require('node:path').resolve(__dirname,'../runtime/playwright-browsers');
const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
const theme=process.argv[2]||'chibis';
assert.ok(['chibis','goblins'].includes(theme),'Choose an accepted WALK-7 theme.');
const dest='assets/sprites/walk-v3',prefix=`character-walk-${theme}`,keys=Array.from({length:10},(_,i)=>`${theme}-${i}`);
const url=`http://127.0.0.1:5000/static/stream-buddies/walk-v3/character-walk-review.html?theme=${theme}`;
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1320,height:1900}}),errors=[],httpErrors=[];
  page.on('pageerror',error=>errors.push(error.message));page.on('response',response=>{if(response.status()>=400)httpErrors.push({url:response.url(),status:response.status()})});
  await page.goto(url);await page.waitForFunction(()=>ready&&actors.length===10);
  await page.evaluate(()=>setCase({speed:4,direction:1,grid:true}));
  const bounds=await page.locator('canvas').boundingBox();assert.ok(bounds.y+bounds.height<=1900,'Every theme character must be visible in the recording viewport.');
  const result=await page.evaluate(async()=>{
   // Every case shows all ten actual sprites at twice source resolution.
   const cases=[];
   const chunks=[],recorder=new MediaRecorder(canvas.captureStream(60),{mimeType:'video/webm;codecs=vp8',videoBitsPerSecond:16000000});
   recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data)};
   const recording=new Promise(resolve=>recorder.onstop=async()=>{
    const bytes=new Uint8Array(await new Blob(chunks,{type:'video/webm'}).arrayBuffer());let text='';
    for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));resolve(btoa(text));
   });
   recorder.start();const recordingStart=performance.now();
   for(const speed of [4,18])for(const direction of [1,-1]){
    setCase({speed,direction,grid:true});const duration=2*Math.max(...actors.map(a=>a.meta.stride))*128/speed*1000+500;
    const sets=actors.map(()=>new Set()),positions=actors.map(()=>[]),began=performance.now();
    await new Promise(resolve=>{function sample(){
     actors.forEach((actor,i)=>{sets[i].add(actor.frame);positions[i].push(actor.distance)});
     if(performance.now()-began<duration)requestAnimationFrame(sample);else resolve();
    }requestAnimationFrame(sample)});
    cases.push({speed,direction,duration:performance.now()-began,startMs:began-recordingStart,requestedDuration:duration,cycles:actors.map((a,i)=>({character:a.key,frames:a.meta.frames,observed:[...sets[i]].sort((a,b)=>a-b),distance:Math.max(...positions[i])-Math.min(...positions[i])}))});
   }
   recorder.stop();const video=await recording;
   return {video,cases};
  });
  assert.ok(result.cases.every(c=>c.cycles.every(a=>a.observed.length===a.frames&&a.distance>20)),JSON.stringify(result.cases));assert.deepEqual(errors,[]);assert.deepEqual(httpErrors,[]);
  fs.writeFileSync(`${dest}/${prefix}-playback.webm`,Buffer.from(result.video,'base64'));
  for(const key of keys)fs.writeFileSync(`${dest}/${prefix}-${key}-poses.png`,Buffer.from(await page.evaluate(key=>chronologicalSheet(key),key),'base64'));
  await page.screenshot({path:`${dest}/${prefix}-browser.png`,fullPage:true});
  const report={theme,characters:10,requestedFps:60,scale:2,productionCycleCap:1.8,visibleCanvas:bounds,cases:result.cases,errors,httpErrors,preview:url};
  fs.writeFileSync(`${dest}/${prefix}-validation.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({theme,characters:10,cases:4,completeCycles:40,errors,httpErrors}));
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
