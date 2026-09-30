process.chdir(require('node:path').resolve(__dirname, '..'));
const fs=require('node:fs'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
function setup(motion='full',seed=1,giftCount=10){
 const math=Object.create(Math);math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 const nodes=[],pending=new Map();let serial=0;
 const node=()=>{const n={style:{},dataset:{},children:[],classList:{add(){},remove(){}},append(...xs){this.children.push(...xs)},remove(){this.removed=true},getBoundingClientRect:()=>({left:280,top:300,width:40,height:20}),querySelector(){return node()}};nodes.push(n);return n;};
 const scene=node();scene.clientWidth=640;scene.clientHeight=360;scene.dataset.motion=motion;scene.getBoundingClientRect=()=>({left:0,top:0});
 const window={};vm.runInNewContext(fs.readFileSync('web/static/gift_cannon.js','utf8'),{window,Image:class {},fetch:()=>Promise.resolve({json:()=>Promise.resolve({gifts:[]})}),document:{createElement:node},matchMedia:()=>({matches:false}),requestAnimationFrame:fn=>{pending.set(++serial,fn);return serial},cancelAnimationFrame:id=>pending.delete(id),Math:math});
 const stop=window.GiftCannon.start(scene,{size:48},{gift:'Rosa',count:giftCount,user:'Luna'});
 return {nodes,pending,stop,startNext(){return window.GiftCannon.start(scene,{size:48},{gift:'Rosa',count:giftCount,user:'Otro'});},step(t){const callbacks=[...pending.values()];pending.clear();callbacks.forEach(fn=>fn(t));}};
}
test('gift cannon bounds its burst, bounces inside the viewport and cancels its frame',()=>{
 const s=setup();for(let i=0;i<6000;i++)s.step(16*i);
 const balls=s.nodes.filter(n=>n.className==='cannon-ball');assert.equal(balls.length,10);
 for(const ball of balls){const [,x,y]=ball.style.transform.match(/translate(?:3d)?\(([-.\d]+)px,([-.\d]+)px/);assert.ok(+x>=0&&+x<=592);assert.ok(+y>=0&&+y<=306);}
 assert.ok(balls.every(b=>!b.removed));s.stop();assert.equal(s.pending.size,0);assert.ok(balls.every(b=>b.removed));
});
test('reduced motion retains visible gifts without flying',()=>{
 const s=setup('reduced');for(let i=0;i<600;i++)s.step(i*16);const balls=s.nodes.filter(n=>n.className==='cannon-ball');assert.equal(balls.length,10);const before=balls.map(b=>b.style.transform);s.step(10000);assert.deepEqual(balls.map(b=>b.style.transform),before);s.stop();
});
test('gifts follow the aiming needle after loading',()=>{
 const s=setup(),seen=new Set(),births=[],angles=new Set();
 for(let i=0;i<6000;i++){
  s.step(i*16);
  angles.add(s.nodes.find(n=>n.className==='arcade-needle').style.transform);
  for(const b of s.nodes.filter(n=>n.className==='cannon-ball'&&!seen.has(n))){seen.add(b);births.push({x:Number(b.style.transform.match(/translate(?:3d)?\(([-.\d]+)px/)[1]),angle:parseFloat(s.nodes.find(n=>n.className==='arcade-needle').style.transform.slice(7))});}
 }
 assert.ok(angles.size>20);assert.equal(births.length,10);assert.equal(Math.sign(births[0].x-276),Math.sign(births[0].angle));s.stop();
});

test('rose transfers and loads before launch and completes without a fixed timeout',async()=>{
 const s=setup();let finished=false;s.stop.done.then(()=>finished=true);
 for(let i=0;i<32;i++)s.step(i*16);
 assert.equal(s.nodes.filter(n=>n.className==='cannon-ball').length,0);
 assert.equal(s.nodes.find(n=>n.className==='gift-cannon arcade-launcher').dataset.phase,'transfer');
 for(let i=32;i<49;i++)s.step(i*16);
 assert.equal(s.nodes.find(n=>n.className==='gift-cannon arcade-launcher').dataset.phase,'loaded');
 for(let i=49;i<6000;i++)s.step(i*16);
 await Promise.resolve();assert.equal(finished,true);assert.equal(s.pending.size,0);s.stop();
});

test('ten roses remain after completion and a second donation adds another ten',async()=>{
 const s=setup();for(let i=0;i<6000;i++)s.step(i*16);assert.equal(s.pending.size,0);await s.stop.done;
 const first=s.nodes.filter(n=>n.className==='cannon-ball');assert.equal(first.length,10);assert.ok(first.every(n=>!n.removed));
 const next=s.startNext();for(let i=6000;i<14000;i++)s.step(i*16);assert.equal(s.pending.size,0);await next.done;
 assert.equal(s.nodes.filter(n=>n.className==='cannon-ball'&&!n.removed).length,20);assert.ok(first.every(n=>!n.removed));next();
});

test('successive donations finish across reproducible trajectories and slow frames',()=>{
 for(const step of [16,40])for(let seed=1;seed<=60;seed++){
  const s=setup('full',seed);let now=0;
  try{
   for(let donation=0;donation<2;donation++){
    if(donation)s.startNext();
    for(let i=0;i<10000&&s.pending.size;i++){now+=step;s.step(now);}
    assert.equal(s.pending.size,0,`seed=${seed}, frame=${step}, donation=${donation}`);
    assert.equal(s.nodes.filter(n=>n.className==='cannon-ball'&&!n.removed).length,10*(donation+1));
   }
  }finally{s.stop();}
 }
});

test('stopping removes retained gifts before starting a fresh donation',()=>{
 const s=setup();for(let i=0;i<6000;i++)s.step(i*16);
 s.stop();assert.equal(s.nodes.filter(n=>n.className==='cannon-ball'&&!n.removed).length,0);
 const next=s.startNext();for(let i=0;i<6000;i++)s.step(i*16);
 assert.equal(s.pending.size,0);
 assert.equal(s.nodes.filter(n=>n.className==='cannon-ball'&&!n.removed).length,10);
 next();
});
test('very large streaks use a bounded visual burst while preserving the real caption count',()=>{
 const s=setup('full',1,500);for(let i=0;i<12000&&s.pending.size;i++)s.step(i*16);
 assert.equal(s.nodes.filter(n=>n.className==='cannon-ball'&&!n.removed).length,36);
 assert.match(s.nodes.find(n=>n.className==='cannon-caption').textContent,/× 500$/);s.stop();
});
