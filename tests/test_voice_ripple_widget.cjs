const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('web/static/voice_ripple_widget.js','utf8');
const {STYLES}=require('../web/static/voice_ripple_renderer.js');
function widget(search,fetchImpl=async()=>{throw Error('offline');}){
 let read,disposed=0,fetches=0,microphones=0,now=0,nextId=0,hidden=false;
 const timers=new Map(),events={},documentEvents={},frames=new Map();
 const context={URLSearchParams,location:{search},performance:{now:()=>now},
  document:{querySelector:()=>({}),get hidden(){return hidden;},addEventListener:(name,fn)=>documentEvents[name]=fn},
  VoiceRippleRenderer:{STYLES,mount:(_,fn)=>(read=fn,()=>disposed++)},
  AbortController,fetch:(...args)=>{fetches++;return fetchImpl(...args);},
  navigator:{mediaDevices:{getUserMedia:()=>{microphones++;throw Error('unexpected microphone');}}},
  setTimeout:(fn,delay)=>(timers.set(++nextId,{fn,delay}),nextId),clearTimeout:id=>timers.delete(id),
  requestAnimationFrame:fn=>(frames.set(++nextId,fn),nextId),cancelAnimationFrame:id=>frames.delete(id),
  addEventListener:(name,fn)=>events[name]=fn};
 vm.runInNewContext(source,context);
 return {read:()=>read(),step(ms){now=ms;for(const [id,fn] of [...frames]){frames.delete(id);fn(now);}},
  setHidden(value){hidden=value;documentEvents.visibilitychange?.();},events,timers,frames,
  get disposed(){return disposed;},get fetches(){return fetches;},get microphones(){return microphones;}};
}
(async()=>{
 let drawFrame,visibleStrokes=0;
 const drawing={setTransform(){},clearRect(){},beginPath(){},ellipse(){},stroke(){if(this.globalAlpha>0)visibleStrokes++;}};
 const actual={URLSearchParams,location:{search:'?preview=1&catalog=1'},performance:{now:()=>1000},
  document:{querySelector:()=>({clientWidth:640,clientHeight:280,getContext:()=>drawing}),addEventListener(){}},
  requestAnimationFrame:fn=>(drawFrame=fn,1),cancelAnimationFrame(){},addEventListener(){},
  fetch(){throw Error('Catalog must never fetch');}};
 vm.createContext(actual);vm.runInContext(fs.readFileSync('web/static/voice_ripple_renderer.js','utf8'),actual);vm.runInContext(source,actual);
 for(let i=0;i<90;i++)drawFrame(i*16);
 assert(visibleStrokes>0,'Catalog must draw visible water rings with the real renderer');
 const catalog=widget('?preview=1&catalog=1');
 catalog.step(200);const first=catalog.read().amplitude;catalog.step(700);
 assert(first>0,'Catalog must visibly animate even without a microphone');
 assert.notEqual(catalog.read().amplitude,first,'Catalog rhythm must vary over time');
 assert(catalog.read().bands.some(v=>v>0));assert.equal(catalog.read().style,'ripples');
 assert.equal(STYLES.length,11);assert(STYLES.includes('camera-flashes'));
 const shown=[];
 for(let i=0;i<STYLES.length;i++){
  catalog.step(i*3000+1500);const state=catalog.read();shown.push(state.style);
  assert.equal(state.style,STYLES[i],'Catalog must cycle every microphone style in renderer order');
  assert.equal(state.bands.length,16);assert(state.bands.every(v=>Number.isFinite(v)&&v>=0&&v<=1));
  assert(state.amplitude>0);if(state.style==='avatar')assert.equal(state.avatar,'🎙️');
 }
 assert.deepEqual(shown,STYLES);catalog.step(STYLES.length*3000);assert.equal(catalog.read().style,STYLES[0],'Catalog rotation must repeat');
 assert.equal(catalog.fetches,0);assert.equal(catalog.microphones,0);assert.equal(catalog.timers.size,0);
 catalog.events.pagehide();assert.equal(catalog.disposed,1);assert.equal(catalog.frames.size,0);
 for(const search of ['', '?preview=1','?catalog=1','?preview=0&catalog=1']){
  const live=widget(search);for(let i=0;i<6;i++)await Promise.resolve();
  assert.equal(live.fetches,1,'Only explicit catalog previews bypass actual signal polling');
  assert.equal(live.read().amplitude,0,'Failed OBS feed must stay silent');
  assert(live.read().bands.every(v=>v===0));assert.equal(live.microphones,0);
  live.step(15000);assert.equal(live.read().style,undefined,'Ordinary OBS sources must not receive catalog styles');
  live.events.pagehide();assert.equal(live.disposed,1);assert.equal(live.timers.size,0);
 }
 let active=0,maxActive=0;const signals=[];
 const pending=widget('',(_, {signal})=>new Promise((resolve,reject)=>{
  signals.push(signal);active++;maxActive=Math.max(maxActive,active);
  signal.addEventListener('abort',()=>{active--;reject(Object.assign(Error('aborted'),{name:'AbortError'}));},{once:true});
 }));
 assert.equal(pending.fetches,1,'Visible widgets start polling immediately');
 pending.setHidden(true);assert.equal(signals[0].aborted,true,'Hiding the page aborts its in-flight poll');
 for(let i=0;i<4;i++)await Promise.resolve();
 assert.equal(pending.timers.size,0,'Hidden pages do not schedule another poll');
 pending.setHidden(false);assert.equal(pending.fetches,2,'Visibility return refreshes immediately');
 assert.equal(maxActive,1,'Polling never overlaps requests');
 pending.setHidden(true);for(let i=0;i<4;i++)await Promise.resolve();
 assert.equal(pending.timers.size,0);pending.events.pagehide();
 assert.equal(pending.disposed,1);assert.equal(pending.fetches,2,'Repeated visibility changes do not add requests');
 console.log('Widget catalog rhythm, isolated transport, live failure silence and cleanup passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
