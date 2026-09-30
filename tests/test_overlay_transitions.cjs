const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup(key='hearts',preview=false){
 const timers=new Map();let serial=0,scene;
 const node=()=>({style:{setProperty(){}},dataset:{},classList:{values:new Set(),add(v){this.values.add(v)}},append(){},querySelector(){return null},remove(){this.removed=true},setAttribute(){}});
 const window={GiftCannon:{start(){const stop=()=>{};stop.done=new Promise(()=>{});return stop;}}};vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../web/static/overlay_animation_renderer.js'),'utf8'),{window,document:{createElement:node,createElementNS:node},setTimeout:(fn,ms)=>{timers.set(++serial,{fn,ms});return serial;},clearTimeout:id=>timers.delete(id),Math});
 const root={replaceChildren(n){scene=n;}};
 const task=window.OverlayAnimationRenderer.render(root,key,{size:48,duration:2,sound:'none'},{},preview);
 return {task,timers,get scene(){return scene},advance(ms){for(const[id,t]of [...timers])if(t.ms===ms){timers.delete(id);t.fn();}}};
}
test('natural finish retains scene and queue ownership until the exit completes',async()=>{
 const s=setup();let completed=false;s.task.done.then(()=>completed=true);
 s.advance(2000);await Promise.resolve();assert.equal(completed,false);assert.ok(!s.scene.removed);assert.ok(s.scene.classList.values.has('effect-leaving'));
 s.advance(500);await Promise.resolve();assert.equal(completed,true);assert.equal(s.scene.removed,true);
});
test('repeated preview replacement requests start one exit; emergency still clears immediately',async()=>{
 const s=setup();s.task.finish();s.task.finish();assert.equal([...s.timers.values()].filter(t=>t.ms===500).length,1);
 s.task.cancel();await s.task.done;assert.equal(s.scene.removed,true);assert.equal(s.timers.size,0);
});

test('cannon and its deposited roses persist after preview and live events',async()=>{
 const preview=setup('cannon',true);preview.task.finish();preview.advance(500);await preview.task.done;
 assert.ok(!preview.scene.removed);assert.ok(preview.scene.classList.values.has('cannon-preview-rest'));
 const live=setup('cannon',false);live.task.finish();live.advance(500);await live.task.done;assert.ok(!live.scene.removed);
});

test('new likes extend the existing scene with one timer and no rebuild',()=>{
 const s=setup('hearts'),scene=s.scene;
 for(let i=0;i<20;i++)assert.equal(s.task.extend(),true);
 assert.equal(s.scene,scene);
 assert.equal([...s.timers.values()].filter(t=>t.ms===2000).length,1);
 s.advance(2000);
 assert.equal(s.task.extend(),false);
 s.advance(500);
 assert.equal(scene.removed,true);
});
