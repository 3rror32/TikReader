const assert=require('node:assert/strict');
const {RippleField}=require('../web/static/voice_ripple_renderer.js');
const {SmokeField,smokeShape}=require('../web/static/voice_ripple_renderer.js');
assert.equal(typeof SmokeField,'function','Smoke needs persistent evolving puffs, rather than a frozen procedural image');
for(const reduced of [false,true]){
 const plume=new SmokeField(42),twin=new SmokeField(42);
 for(let i=0;i<120;i++){plume.step(1/60,.8,1,reduced);twin.step(1/60,.8,1,reduced);}
 assert.deepEqual(plume.puffs,twin.puffs,'A seed reproduces the same evolving plume');
 assert(plume.puffs.length>5&&plume.puffs.length<=48);
 assert(plume.puffs.every(p=>p.originX===0&&p.originY===0),'All smoke originates from one fixed emitter');
 assert(new Set(plume.puffs.map(p=>p.curl)).size>5,'Consecutive puffs have independent smooth curl variation');
 const before=smokeShape(plume.puffs[0]);plume.step(.02,.8,1,reduced);
 assert.notDeepEqual(smokeShape(plume.puffs[0]),before,'Smoke continues evolving even under reduced motion');
 const count=plume.emitted;
 for(let i=0;i<400;i++)plume.step(.02,0,1,reduced);
 assert.equal(plume.emitted,count,'Silence never emits new puffs');assert.equal(plume.puffs.length,0,'Existing smoke fully dissipates in silence');
}
const smoke30=new SmokeField(8),smoke60=new SmokeField(8);
for(let i=0;i<60;i++)smoke30.step(1/30,.8);for(let i=0;i<120;i++)smoke60.step(1/60,.8);
assert.deepEqual(smoke30.puffs,smoke60.puffs,'Fixed smoke integration is independent of display frame rate');
const slowSmoke=new SmokeField(8),fastSmoke=new SmokeField(8);
for(let i=0;i<120;i++){slowSmoke.step(1/60,.8,.5);fastSmoke.step(1/60,.8,2);}
assert(fastSmoke.emitted>slowSmoke.emitted,'Smoke speed controls the flow');
for(let i=0;i<3000;i++)fastSmoke.step(1/60,1,2);
assert(fastSmoke.puffs.length<=48&&fastSmoke.puffs.every(p=>Object.values(smokeShape(p)).every(Number.isFinite)),'Long-running smoke remains finite and bounded');
for(const reduced of [false,true]){
 global.matchMedia=()=>({matches:reduced});let callback;global.requestAnimationFrame=fn=>(callback=fn,1);global.cancelAnimationFrame=()=>{};
 let state={style:'smoke',amplitude:.8,intensity:1};const positions=[],opacity=[];
 const smokeContext=new Proxy({translate(x,y){positions.push([x,y]);},fill(){opacity.push(this.globalAlpha);},createRadialGradient(){return {addColorStop(){}};}},{get:(o,k)=>k in o?o[k]:(o[k]=()=>{})});
 const disposeSmoke=require('../web/static/voice_ripple_renderer.js').mount({clientWidth:640,clientHeight:360,getContext:()=>smokeContext},()=>state);
 for(let i=1;i<=120;i++)callback(i*16);positions.length=0;opacity.length=0;callback(1936);
 const first=positions.slice(),normalAlpha=opacity.slice();positions.length=0;opacity.length=0;callback(1952);
 assert.notDeepEqual(positions,first,'Actual smoke drawing evolves at successive times in both motion settings');
 assert(positions.every(([x,y])=>Math.abs(x-320)<36&&y<=180),'Visible plume stays near its fixed central emitter and rises');
 state.intensity=.25;opacity.length=0;callback(1968);
 assert(Math.max(...opacity)<Math.max(...normalAlpha)*.4,'Intensity controls smoke density');
 state.amplitude=0;for(let i=0;i<300;i++)callback(1984+i*16);positions.length=0;callback(6800);
 assert.equal(positions.length,0,'Actual smoke drawing fully expires after silence');
 state.amplitude=1;for(let i=0;i<100;i++)callback(6816+i*16);state.style='halo';callback(8432);state.style='smoke';positions.length=0;callback(8448);
 assert.equal(positions.length,0,'Switching styles clears old smoke instead of reviving a stale plume');disposeSmoke();
}
const {waterWaves,lightningPaths}=require('../web/static/voice_ripple_renderer.js');
assert.equal(typeof waterWaves,'function','Water exposes its single expanding ring geometry');
const drop={age:.5,power:.8,x:0,y:0};
const waves=waterWaves(drop,360,false),laterWaves=waterWaves({...drop,age:.7},360,false);
assert.equal(waves.length,1,'Each voice pulse produces one original water ring');
assert(Math.abs(waves[0].radius-(.05+.5/2.4*.48)*360)<1e-9,'Original water radius is restored');
assert(laterWaves[0].radius>waves[0].radius);
const reducedWaves=waterWaves(drop,360,true),reducedLater=waterWaves({...drop,age:.7},360,true);
assert(reducedLater[0].radius>reducedWaves[0].radius,'Reduced motion still travels outward');
assert(reducedLater[0].radius-reducedWaves[0].radius<laterWaves[0].radius-waves[0].radius,'Reduced travel stays smaller');
assert.equal(waterWaves({...drop,age:0},360,false)[0].alpha,0);
assert(waterWaves({...drop,age:2.39},360,false)[0].alpha<.0001,'Water fades smoothly before removal');
assert.equal(waterWaves({...drop,age:2.4},360,false)[0].alpha,0);
const cadence=new RippleField();cadence.level=1;cadence.last=0;cadence.step(.1,1);cadence.step(.04,1);assert.equal(cadence.rings.length,0);cadence.step(.001,1);assert.equal(cadence.rings.length,1,'Original .14-second loud voice cadence is restored');
const quietCadence=new RippleField();quietCadence.level=.04;quietCadence.last=0;for(let i=0;i<3;i++)quietCadence.step(.1,.04);assert.equal(quietCadence.rings.length,0);quietCadence.step(.04,.04);assert.equal(quietCadence.rings.length,1,'Quiet voice preserves original slower cadence');
const lightningCadence=new RippleField();lightningCadence.level=1;lightningCadence.last=0;lightningCadence.step(.1,1,[],1,'lightning');lightningCadence.step(.05,1,[],1,'lightning');assert.equal(lightningCadence.rings.length,0,'Other styles retain their existing cadence');
const bolt=lightningPaths(3),sameBolt=lightningPaths(3);
assert.deepEqual(bolt,sameBolt,'A bolt retains its geometry throughout its lifetime');
assert.equal(bolt.length,5,'One trunk, two short branches and two fine forks');
assert(bolt[0].length>=32,'Lightning has fine jagged detail');
const variants=Array.from({length:24},(_,i)=>lightningPaths(i));
assert(new Set(variants.map(paths=>JSON.stringify(paths[0][0]))).size>=12,'Lightning origins vary between strikes');
assert(new Set(variants.map(paths=>Math.round(Math.atan2(paths[0].at(-1).y-paths[0][0].y,paths[0].at(-1).x-paths[0][0].x)*3))).size>=4,'Lightning includes vertical and opposing diagonal silhouettes');
const strikeCenters=variants.map(paths=>{const trunk=paths[0];return {x:(Math.min(...trunk.map(p=>p.x))+Math.max(...trunk.map(p=>p.x)))/2,y:(Math.min(...trunk.map(p=>p.y))+Math.max(...trunk.map(p=>p.y)))/2};});
for(const x of [-1,1])for(const y of [-1,1])assert(strikeCenters.some(p=>p.x*x>.16&&p.y*y>.16),'Lightning occupies each outer screen quadrant, not a central pivot');
for(const [width,height] of [[1920,1080],[360,640],[640,640],[2560,720]])for(const paths of variants)for(const path of paths)for(const p of path){
 const px=width*(.5+p.x),py=height*(.5+p.y);
 assert(px>=width*.035&&px<=width*.965&&py>=height*.035&&py<=height*.965,'Projected lightning retains a safe inset in every viewport ratio');
}
assert(variants.every(paths=>paths.reduce((total,path)=>total+path.length,0)<=65),'Subdivision has a fixed bounded point budget');
for(const path of bolt)for(const point of path)assert(Number.isFinite(point.x)&&Number.isFinite(point.y));
for(const [i,branch] of bolt.slice(1).entries()){
 assert(bolt.slice(0,i+1).some(path=>path.some(point=>point.x===branch[0].x&&point.y===branch[0].y)),'Branches join existing lightning');
 assert(Math.hypot(branch.at(-1).x-branch[0].x,branch.at(-1).y-branch[0].y)<.18,'Forks remain short');
}
const field=new RippleField();for(let i=0;i<100;i++)field.step(.016,0);assert.equal(field.rings.length,0);
for(let i=0;i<1000;i++)field.step(.016,1);assert(field.rings.length<=18);assert(field.rings.length>0);
assert(field.bolts.length>0&&field.bolts.length<=4,'Lightning remains visible and bounded during speech');
assert(field.rings.length<=18,'Original pulse cadence remains bounded');
assert(field.rings.every(ring=>ring.x===0&&ring.y===0),'Every water impact shares a stable concentric origin');
for(const ring of field.rings)for(const wave of waterWaves(ring,360,false))assert(Number.isFinite(wave.radius)&&Number.isFinite(wave.alpha));
for(let i=0;i<200;i++)field.step(.016,0);assert.equal(field.rings.length,0);assert(field.level<.001);
assert.equal(field.bolts.length,0,'Lightning trails finish during silence');
field.step(.016,NaN);assert(Number.isFinite(field.level));
console.log('Renderer silence, bounded emission and fade passed');
const {mount,STYLES}=require('../web/static/voice_ripple_renderer.js');
assert.equal(STYLES.length,11);
const counts={};let next;global.devicePixelRatio=3;global.requestAnimationFrame=fn=>(next=fn,1);global.cancelAnimationFrame=()=>{};global.matchMedia=()=>({matches:false});
for(const style of STYLES){const calls=[];const context=new Proxy({},{get:(o,k)=>o[k]||(o[k]=(...args)=>{calls.push(k);if(k==='createRadialGradient')return {addColorStop(){}}})});const canvas={clientWidth:640,clientHeight:360,getContext:()=>context};let state={style,amplitude:1,bands:Array(16).fill(.8),avatar:'🎙️'};const stop=mount(canvas,()=>state);for(let i=0;i<90;i++)next(i*16);assert(calls.length>0);assert.equal(canvas.width,1280);counts[style]=calls.length;state.amplitude=0;state.bands.fill(0);for(let i=90;i<400;i++)next(i*16);calls.length=0;next(6416);assert(calls.every(k=>['setTransform','clearRect'].includes(k)),`${style} must completely disappear at silence`);stop();}
assert(new Set(Object.values(counts)).size>=7,'Styles should use distinct drawing paths');
console.log('All eleven styles render and decay with bounded DPR');

const slow=new RippleField(),fast=new RippleField();for(let i=0;i<50;i++)slow.step(.02,1);for(let i=0;i<100;i++)fast.step(.01,1);for(let i=0;i<50;i++)slow.step(.02,0);for(let i=0;i<100;i++)fast.step(.01,0);assert(Math.abs(slow.level-fast.level)<1e-9,'Release must be independent of frame rate');
const gentle=new RippleField(),shapes=new Set(),emissions=[];let lastEmission=-1;
const quietLightning=new RippleField(),loudLightning=new RippleField();quietLightning.level=.1;loudLightning.level=1;
quietLightning.step(.016,.1,[],1,'lightning');loudLightning.step(.016,1,[],1,'lightning');
assert.equal(quietLightning.bolts.length,1,'Quiet speech emits a single strike');assert.equal(loudLightning.bolts.length,3,'Strong speech emits several distinct strikes');
assert.equal(new Set(loudLightning.bolts.map(b=>JSON.stringify(b.paths))).size,3,'Simultaneous strikes have distinct silhouettes');
const heldGeometry=JSON.stringify(loudLightning.bolts.map(b=>b.paths));loudLightning.step(.016,1,[],1,'lightning');assert.equal(JSON.stringify(loudLightning.bolts.map(b=>b.paths)),heldGeometry,'Live bolts never redraw their shape between frames');
for(let i=0;i<120;i++){gentle.step(.1,1,[],2,'lightning',true);if(gentle.lastBolt!==lastEmission){emissions.push(i*.1);lastEmission=gentle.lastBolt;}for(const b of gentle.bolts)shapes.add(JSON.stringify(b.paths));assert(gentle.bolts.length<=4);}
assert(shapes.size>=9,'Reduced motion cycles through multiple stable lightning images');
assert(emissions.slice(1).every((t,i)=>t-emissions[i]>=1.7),'Reduced motion never accelerates into rapid flashes at maximum speed');
for(let i=0;i<40;i++)gentle.step(.1,0,[],2,'lightning',true);assert.equal(gentle.bolts.length,0,'Reduced lightning fully expires after silence');
global.matchMedia=()=>({matches:true});let points=[];const context=new Proxy({},{get:(o,k)=>o[k]||(o[k]=(...args)=>{if(k==='lineTo')points.push(args)})});const stopMotion=mount({clientWidth:640,clientHeight:360,getContext:()=>context},()=>({style:'lightning',amplitude:1}));for(let i=0;i<40;i++)next(i*16);points=[];next(640);const still=points;points=[];next(656);assert.deepEqual(points,still,'Reduced-motion silhouettes remain fixed between slow crossfades');points=[];for(let i=42;i<260;i++)next(i*16);assert.notDeepEqual(points.slice(-still.length),still,'Reduced-motion drawing eventually displays another silhouette');stopMotion();
console.log('Silence disappearance, frame-rate-independent release and reduced-motion geometry passed');
for(const [width,height] of [[1920,1080],[360,640],[640,640]]){
 const drawn=[];const viewportContext=new Proxy({},{get:(o,k)=>k in o?o[k]:(o[k]=(...args)=>{if(k==='moveTo'||k==='lineTo')drawn.push(args);})});
 const stopViewport=mount({clientWidth:width,clientHeight:height,getContext:()=>viewportContext},()=>({style:'lightning',amplitude:1}));
 for(let i=0;i<600;i++)next(i*16);
 assert(drawn.length>0);
 assert(drawn.every(([x,y])=>Number.isFinite(x)&&Number.isFinite(y)&&x>=width*.035&&x<=width*.965&&y>=height*.035&&y<=height*.965),'Actual drawing uses independent viewport axes without clipping');
 const bounds=drawn.reduce((b,[x,y])=>[Math.min(b[0],x),Math.min(b[1],y),Math.max(b[2],x),Math.max(b[3],y)],[Infinity,Infinity,-Infinity,-Infinity]);
 assert(bounds[2]-bounds[0]>width*.75,'Actual reduced-motion drawing visits left and right edges');
 assert(bounds[3]-bounds[1]>height*.75,'Actual reduced-motion drawing visits upper and lower edges');
 stopViewport();
}
const alphas=[],brightContext=new Proxy({stroke(){alphas.push(this.globalAlpha);}},{get:(o,k)=>k in o?o[k]:(o[k]=()=>{})});
const stopBright=mount({clientWidth:640,clientHeight:360,getContext:()=>brightContext},()=>({style:'lightning',amplitude:1}));
for(let i=0;i<45;i++)next(i*16);
assert(Math.max(...alphas)>.85,'The first reduced-motion strike brightens with rising voice instead of retaining its weak initial sample');stopBright();
function quietStrike(reduced,intensity=1){
 global.matchMedia=()=>({matches:reduced});
 let amplitude=.14;const strokes=[];
 const ctx=new Proxy({stroke(){strokes.push({alpha:this.globalAlpha,width:this.lineWidth,blur:this.shadowBlur,color:this.strokeStyle});}},{get:(o,k)=>k in o?o[k]:(o[k]=()=>{})});
 const dispose=mount({clientWidth:640,clientHeight:360,getContext:()=>ctx},()=>({style:'lightning',amplitude,intensity}));
 next(1000);assert(strokes.every(s=>s.alpha===0),'An initial zero-age envelope stays transparent despite the brightness floor');strokes.length=0;next(1016);
 const onset=strokes.slice();strokes.length=0;next(1096);const peak=strokes.slice();
 amplitude=0;for(let time=1112;time<4500;time+=16)next(time);
 strokes.length=0;next(4516);assert.equal(strokes.length,0,'Brightness floor never outlives a strike during silence');dispose();return {onset,peak};
}
for(const reduced of [false,true]){
 const {onset,peak}=quietStrike(reduced);
 assert(onset.some(s=>s.color==='#f7feff'&&s.alpha>.2),'Quiet speech has a visible white core within the first active frame');
 const cores=peak.filter(s=>s.color==='#f7feff');
 assert(cores.every(s=>s.width<=1),'Lightning white cores stay thin instead of becoming thick neon tubes');
 assert(cores.some(s=>s.alpha>.55&&s.width>=.7),'Quiet triggered strikes retain a luminous sharp leader');
 assert(cores[0].width>cores[1].width&&cores[1].width>cores[2].width,'A leader narrows along its length');
 assert(cores.some(s=>s.width>.3&&s.width<.5)&&cores.some(s=>s.width<.2),'Secondary and tertiary filaments remain finer than the leader');
 assert(peak.filter(s=>s.color!=='#f7feff').every(s=>s.width<=2.1&&s.alpha<.2),'Colored halos remain soft and restrained without broad solid outlines');
 assert(peak.some(s=>s.blur>=16&&s.alpha>.03),'Thin lightning keeps a visible diffuse colored glow');
 const low=quietStrike(reduced,.25),high=quietStrike(reduced,2);
 assert(Math.max(...high.peak.map(s=>s.alpha))>Math.max(...low.peak.map(s=>s.alpha))*2,'Intensity still controls strike brightness');
}
global.matchMedia=()=>({matches:true});
let fadingAmplitude=1,fadeStrokes=0;
const fadeContext=new Proxy({stroke(){fadeStrokes++;}},{get:(o,k)=>k in o?o[k]:(o[k]=()=>{})});
const stopFade=mount({clientWidth:640,clientHeight:360,getContext:()=>fadeContext},()=>({style:'lightning',amplitude:fadingAmplitude}));
for(let i=0;i<=25;i++)next(i*16);
fadingAmplitude=0;
for(let i=26;i<=130;i++)next(i*16);
fadeStrokes=0;next(2096);assert(fadeStrokes>0,'Reduced lightning keeps fading after the shared voice level falls below its drawing threshold');
for(let i=132;i<=210;i++)next(i*16);
fadeStrokes=0;next(3376);assert.equal(fadeStrokes,0,'Surviving lightning finishes its own lifetime without silence emissions');stopFade();

const {CameraFlashField,flashEnvelope}=require('../web/static/voice_ripple_renderer.js');
assert.equal(typeof CameraFlashField,'function','Camera flashes need their own bounded persistent field');
for(const reduced of [false,true])for(const speed of [.25,1,2]){
 const f=new CameraFlashField(42),twin=new CameraFlashField(42),seen=[],times=[];let count=0;
 for(let i=0;i<2400;i++){
  f.step(1/60,.8,speed,reduced);twin.step(1/60,.8,speed,reduced);
  assert.deepEqual(f.flashes,twin.flashes,'Seeded flash timing and geometry are deterministic');
  assert(f.flashes.length<=2,'At most two localized flashes coexist');
  for(const v of f.flashes){assert(Object.values(v).every(Number.isFinite));assert(v.x>=.18&&v.x<=.82&&v.y>=.18&&v.y<=.82);}
  if(f.emitted!==count){times.push(i/60);seen.push(f.flashes.at(-1));count=f.emitted;}
 }
 assert(times.length>3);for(let i=1;i<times.length;i++)assert(times[i]-times[i-1]>=(reduced?1.8:.65)-1/60-1e-8,'Flash rate is bounded in real seconds independently of speed');
 if(!reduced)assert(new Set(seen.map(v=>v.x)).size>3,'Photographic flashes appear at varied positions');
 assert(new Set(seen.map(v=>v.size)).size>3,'Each flash has its own size');
 if(reduced){assert(seen.every(v=>v.x===.5&&v.y===.5),'Reduced pulses remain anchored');}
 const held=JSON.stringify(f.flashes.map(({age,...geometry})=>geometry));f.step(1/120,0,speed,reduced);
 assert.equal(JSON.stringify(f.flashes.map(({age,...geometry})=>geometry)),held,'Existing geometry stays fixed while fading');
 for(let i=0;i<600;i++)f.step(1/60,0,speed,reduced);
 assert.equal(f.emitted,count,'Silence emits no flashes');assert.equal(f.flashes.length,0,'Flash lifetimes expire independently in silence');
}
assert.equal(flashEnvelope({age:0,life:2,reduced:1}),0);
assert.equal(flashEnvelope({age:2,life:2,reduced:1}),0);
assert(flashEnvelope({age:.1,life:2,reduced:1})<.1,'Reduced pulse has a soft slow arrival');
console.log('Camera flash seeded geometry, bounded realtime cadence and silence expiry passed');

const flash30=new CameraFlashField(9),flash60=new CameraFlashField(9);
for(let i=0;i<60;i++)flash30.step(1/30,.8);for(let i=0;i<120;i++)flash60.step(1/60,.8);
assert.deepEqual(flash30.flashes,flash60.flashes,'Flash simulation is independent of display frame rate');
for(const reduced of [false,true]){
 let tick,draws=[],state={style:'camera-flashes',amplitude:.8,intensity:1,color:'#123456'};
 global.requestAnimationFrame=fn=>(tick=fn,1);global.matchMedia=()=>({matches:reduced});
 const ctx=new Proxy({fill(){draws.push({alpha:this.globalAlpha,fill:this.fillStyle});},createRadialGradient(){return {stops:[],addColorStop(at,color){this.stops.push([at,color]);}};}},{get:(o,k)=>k in o?o[k]:(o[k]=()=>{})});
 const dispose=mount({clientWidth:640,clientHeight:360,getContext:()=>ctx},()=>state);
 tick(1000);tick(1016);tick(1096);tick(1196);tick(1296);draws=[];tick(1312);
 const normal=draws.slice();assert(normal.some(d=>d.fill==='#ffffff'&&d.alpha>0),'Photographic glints have a white core');
 assert(normal.some(d=>d.fill?.stops?.some(([_,color])=>color==='#123456')),'Halo uses the selected color');
 state.intensity=.25;draws=[];tick(1328);assert(Math.max(...draws.map(d=>d.alpha))<Math.max(...normal.map(d=>d.alpha))*.4,'Intensity controls flash brightness');
 state.amplitude=0;for(let i=0;i<80;i++)tick(1344+i*16);draws=[];tick(2640);
 if(reduced)assert(draws.length>0,'Reduced pulse completes its own fade after shared voice gate closes');
 for(let i=0;i<200;i++)tick(2656+i*16);draws=[];tick(5872);assert.equal(draws.length,0,'Actual flash drawing expires fully in silence');
 state.amplitude=1;tick(5888);tick(5904);state.style='halo';tick(5920);state.style='camera-flashes';state.amplitude=0;draws=[];tick(5936);assert.equal(draws.length,0,'Style change clears old flash state');
 dispose();
}
console.log('Camera flash draw, color/intensity, frame rate, reduced fade and style cleanup passed');

const {ButterflyField,butterflyShape}=require('../web/static/voice_ripple_renderer.js');
assert.equal(typeof ButterflyField,'function','Butterflies need independent persistent upward flight');
for(const reduced of [false,true]){
 const a=new ButterflyField(72),b=new ButterflyField(72);
 for(let i=0;i<120;i++){a.step(1/60,.8,1,reduced);b.step(1/60,.8,1,reduced);}
 assert.deepEqual(a.butterflies,b.butterflies);
 assert(a.butterflies.length>3&&a.butterflies.length<=28);
 assert(a.butterflies.every(p=>p.originX===0&&p.originY===0));
 assert(new Set(a.butterflies.map(p=>p.phase)).size>3);
 const first=a.butterflies[0],before=butterflyShape(first);a.step(.05,.8,1,reduced);const after=butterflyShape(first);
 assert(after.y<before.y,'Butterflies rise in both motion settings');assert.notEqual(after.wing,before.wing,'Wings keep beating under reduced motion');
 assert(Math.abs(after.x)<.2);const emitted=a.emitted;
 for(let i=0;i<500;i++)a.step(.02,0,1,reduced);
 assert.equal(a.emitted,emitted);assert.equal(a.butterflies.length,0,'Silence lets existing butterflies fully fade');
}
const b30=new ButterflyField(9),b60=new ButterflyField(9);
for(let i=0;i<60;i++)b30.step(1/30,1);for(let i=0;i<120;i++)b60.step(1/60,1);
assert.deepEqual(b30.butterflies,b60.butterflies,'Flight is display-frame independent');
for(let i=0;i<4000;i++)b60.step(1/60,1,2);
assert(b60.butterflies.length<=28&&b60.butterflies.every(p=>Object.values(butterflyShape(p)).every(Number.isFinite)));
for(const reduced of [false,true]){
 global.matchMedia=()=>({matches:reduced});let callback;global.requestAnimationFrame=fn=>(callback=fn,1);
 let state={style:'butterflies',amplitude:.8,color:'#ab88ee',intensity:1};const positions=[],wings=[],alpha=[],pigments=[],veins=[],spots=[];
 const context=new Proxy({translate(x,y){positions.push([x,y]);},scale(x,y){wings.push([x,y]);},fill(){alpha.push(this.globalAlpha);},quadraticCurveTo(...points){veins.push(points);},ellipse(...points){spots.push(points);},createLinearGradient(){return {addColorStop(offset,color){pigments.push([offset,color]);}};},createRadialGradient(){return {addColorStop(){}};}},{get:(o,k)=>k in o?o[k]:(o[k]=()=>{})});
 const dispose=mount({clientWidth:640,clientHeight:360,getContext:()=>context},()=>state);
 for(let i=1;i<=120;i++)callback(i*16);positions.length=0;wings.length=0;callback(1936);const oldPositions=positions.slice(),oldWings=wings.slice();positions.length=0;wings.length=0;callback(1952);
 assert.notDeepEqual(positions,oldPositions);assert.notDeepEqual(wings,oldWings);
 assert(pigments.some(([offset,color])=>offset===.25&&color==='#ab88ee'),'Natural wing pigmentation preserves the chosen tint');
 assert(veins.length>positions.length*5&&spots.length>positions.length*8,'Wing contours retain veins and marginal markings');
 assert(wings.some(([fold],i)=>i%2&&fold!==wings[i-1][0]),'Left and right wings fold with perspective');
 assert(positions.every(([x,y])=>Math.abs(x-320)<72&&y<=252),'Butterflies rise from a fixed lower-center source');
 state.amplitude=0;for(let i=0;i<600;i++)callback(1968+i*16);positions.length=0;callback(11600);assert.equal(positions.length,0);
 state.amplitude=1;for(let i=0;i<100;i++)callback(11616+i*16);state.style='halo';callback(13232);state.style='butterflies';positions.length=0;callback(13248);assert.equal(positions.length,0,'Style changes clear butterfly state');dispose();
}
console.log('Butterfly upward flight, wingbeats, variation, lifetime and cleanup passed');

const butterflySlow=new ButterflyField(9),butterflyFast=new ButterflyField(9);
for(let i=0;i<120;i++){butterflySlow.step(1/60,.8,.5);butterflyFast.step(1/60,.8,2);}
assert(butterflyFast.emitted>butterflySlow.emitted,'Speed changes butterfly flow');
butterflyFast.step(NaN,NaN,NaN);assert(Number.isFinite(butterflyFast.accumulator));

// Capture the actual silk canvas paths, including their visible stroke envelope.
function silkCanvas(width=640,height=360,reduced=false,speed=1,intensity=1,amplitude=1){
 let callback,paths=[],points=[],time=1000;
 const state={style:'silk',amplitude,speed,intensity,color:'#ab88ee'};
 global.matchMedia=()=>({matches:reduced});global.requestAnimationFrame=fn=>(callback=fn,1);
 const context=new Proxy({beginPath(){points=[];},moveTo(x,y){points.push({x,y});},lineTo(x,y){points.push({x,y});},stroke(){paths.push({points:points.slice(),width:this.lineWidth,blur:this.shadowBlur,alpha:this.globalAlpha,color:this.strokeStyle});}},{get:(o,k)=>k in o?o[k]:(o[k]=()=>{})});
 const dispose=mount({clientWidth:width,clientHeight:height,getContext:()=>context},()=>state);
 const frame=(dt=1/60)=>{paths=[];time+=dt*1000;callback(time);return paths;};
 for(let i=0;i<180;i++)frame();
 return {frame,dispose,state};
}
const silkView=silkCanvas(),silkFirst=silkView.frame();
assert.equal(silkFirst.length,5,'Silk retains five individual flowing waves');
for(let ribbon=1;ribbon<silkFirst.length;ribbon++)for(let point=0;point<silkFirst[ribbon].points.length;point++){
 const upper=silkFirst[ribbon-1],lower=silkFirst[ribbon];
 assert(lower.points[point].y-upper.points[point].y>upper.width+lower.width,'Silk waves stay visibly separated across the canvas, including both endpoints');
}
silkView.dispose();
const {silkWaves}=require('../web/static/voice_ripple_renderer.js');
for(const [width,height] of [[1920,1080],[360,640],[325,375],[120,64],[24,24]])for(const level of [0,.05,.65,1,2])for(const time of [0,.016,2,11,120,3600,...Array.from({length:120},(_,i)=>i*.35)]){
 const waves=silkWaves(width,height,level,time),later=silkWaves(width,height,level,time+.001);
 for(const [ribbon,points] of waves.entries())for(const [index,p] of points.entries()){
  assert(Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=width&&p.y>0&&p.y<height,'Silk geometry stays finite inside every viewport');
  if(ribbon)assert(p.y-waves[ribbon-1][index].y>Math.min(width,height)*.04,'Distinct silk baselines prevent crossings at every level and time');
  assert(Math.abs(p.y-later[ribbon][index].y)<Math.min(width,height)*.0001,'Silk remains continuous through long-running phase cycles');
 }
}
function silkCrest(points,near){
 const peaks=points.slice(1,-1).flatMap((point,index)=>{
  const previous=points[index],next=points[index+2];
  if(point.y<=previous.y||point.y<=next.y)return [];
  const offset=.5*(previous.y-next.y)/(previous.y-2*point.y+next.y);
  return [point.x+offset*(next.x-point.x)];
 });
 return peaks.sort((a,b)=>Math.abs(a-near)-Math.abs(b-near))[0];
}
const movingSilk=silkCanvas(),movingStart=movingSilk.frame(),crest=silkCrest(movingStart[0].points,440);
let movingEnd;for(let i=0;i<30;i++)movingEnd=movingSilk.frame();
const advancedCrest=silkCrest(movingEnd[0].points,crest);
assert(advancedCrest<crest-6&&advancedCrest>crest-40,'Actual silk crests advance smoothly from right to left');
assert(movingStart.every(path=>path.color==='#ab88ee'&&path.alpha>0),'Silk preserves the selected color and voice visibility');
movingSilk.state.amplitude=0;for(let i=0;i<180;i++)movingSilk.frame();assert.equal(movingSilk.frame().length,0,'Silk fully disappears in silence');movingSilk.dispose();
const waveHeight=points=>Math.max(...points.map(p=>p.y))-Math.min(...points.map(p=>p.y));
for(const reduced of [false,true]){
 const portrait=silkCanvas(325,375,reduced,1,1,.65);
 assert(portrait.frame().every(path=>waveHeight(path.points)>325*.09&&waveHeight(path.points)<325*.19),'Portrait silk retains clearly visible crest-to-trough folds at ordinary voice strength');
 portrait.dispose();
}
const earlyHeight=waveHeight(silkWaves(640,360,1,0)[0]),lateHeight=waveHeight(silkWaves(640,360,1,2)[0]);
assert(Math.abs(lateHeight-earlyHeight)>1,'Silk gently deforms as well as translating');
assert.deepEqual(silkWaves(640,360,1,0,true),silkWaves(640,360,1,200,true),'Reduced-motion silk keeps fixed geometry');
for(const [width,height] of [[1920,1080],[360,640],[120,64],[24,24]])for(const speed of [.25,2])for(const intensity of [.25,2]){
 const view=silkCanvas(width,height,false,speed,intensity),paths=view.frame();
 for(const [ribbon,path] of paths.entries())for(const [index,p] of path.points.entries()){
  assert(p.y-path.width/2>0&&p.y+path.width/2<height,'Actual silk strokes fit small and vertical viewports');
  if(ribbon)assert(p.y-paths[ribbon-1].points[index].y>path.width+paths[ribbon-1].width+path.blur,'Stroke and restrained glow leave visible gaps at control limits');
 }
 view.dispose();
}
const stillSilk=silkCanvas(640,360,true),stillStart=stillSilk.frame();for(let i=0;i<30;i++)stillSilk.frame();
assert.deepEqual(stillSilk.frame(),stillStart,'Actual reduced-motion drawing remains static under steady voice');stillSilk.dispose();
const quietSilk=silkCanvas(640,360,false,1,.25,.1),strongSilk=silkCanvas(640,360,false,1,2,1);
assert(strongSilk.frame()[0].alpha>quietSilk.frame()[0].alpha*4,'Voice and intensity still control silk strength');quietSilk.dispose();strongSilk.dispose();
const slowSilk=silkCanvas(640,360,false,.25),fastSilk=silkCanvas(640,360,false,2);
const motionAmount=view=>{const start=view.frame(),end=view.frame();return start.reduce((sum,path,ribbon)=>sum+path.points.reduce((total,p,index)=>total+Math.abs(p.y-end[ribbon].points[index].y),0),0);};
assert(motionAmount(fastSilk)>motionAmount(slowSilk)*3,'Speed retains control over the smooth silk motion');slowSilk.dispose();fastSilk.dispose();
console.log('Silk separation, leftward travel, gentle deformation, continuity, controls and reduced motion passed');

// Natural flight must bank independently and fold its far wing in perspective.
for(const reduced of [false,true]){
 const field=new ButterflyField(83);for(let i=0;i<120;i++)field.step(1/60,1,1,reduced);
 for(const p of field.butterflies){
  const start=butterflyShape({...p,age:0});assert.equal(start.x,0);assert(Math.abs(start.y)===0);
  let previous=butterflyShape({...p,age:.1}),turns=new Set();
  for(let age=.12;age<p.life;age+=.02){
   const current=butterflyShape({...p,age});
   assert(current.y<previous.y,'Natural flutter keeps ascending');
   assert(Math.abs(current.x-previous.x)<.004,'Flight steers without jitter');
   assert(Math.abs(current.tilt)<.65,'Banking remains restrained');
   assert(current.farWing>0&&current.farWing<=1.2,'Far wing folds independently in perspective');
   turns.add(current.tilt.toFixed(3));previous=current;
  }
  assert(turns.size>10);assert.equal(butterflyShape({...p,age:p.life}).alpha,0);
 }
 assert(new Set(field.butterflies.map(p=>p.drift)).size>3,'Independent seeded currents');
}
