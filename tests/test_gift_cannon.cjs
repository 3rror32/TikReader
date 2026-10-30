process.chdir(require('node:path').resolve(__dirname, '..'));
const fs=require('node:fs'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
test('launcher loads complete transparent raster sprites',()=>{
 const source=fs.readFileSync('web/static/gift_cannon.js','utf8');
 assert.ok(!source.includes('launcher.svg#'));
 for(const name of ['cannon','sack']){
  assert.ok(source.includes("artwork("+(name==='sack'?'sack':'gear')+",'"+name+"')"));
  const png=fs.readFileSync('web/static/arcade-launcher/'+name+(name==='cannon'?'-v3.png':'-v2.png'));
  assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png[25],6);
 }
});
test('launcher renders exactly one decorated aiming arrow over the arrow-free body',()=>{
 const s=setup(),body=s.nodes.find(n=>n.className==='arcade-gear'),arrow=s.nodes.find(n=>n.className==='arcade-needle');
 assert.equal(body.children[0].src,'/static/arcade-launcher/cannon-v3.png');
 assert.equal(s.nodes.filter(n=>n.className==='arcade-needle').length,1);
 assert.equal(arrow.children.length,1);
 assert.equal(arrow.children[0].src,'/static/arcade-launcher/aim-arrow-v3.svg');
 const css=fs.readFileSync('web/static/overlay_animations.css','utf8');
 assert.ok(!css.includes('.arcade-needle:before'));
 assert.match(css,/\.arcade-needle\{[^}]*left:205px;top:0;[^}]*transform-origin:50% 100%/);
 s.stop();
});
function setup(motion='full',seed=1,giftCount=10,avatar='https://example.com/luna.jpg'){
 const math=Object.create(Math);math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 const nodes=[],pending=new Map();let serial=0;
 const node=()=>{const n={style:{},dataset:{},children:[],classList:{add(){},remove(){}},append(...xs){this.children.push(...xs)},remove(){this.removed=true},getBoundingClientRect:()=>({left:280,top:300,width:40,height:20}),querySelector(){return node()}};nodes.push(n);return n;};
 const scene=node();scene.clientWidth=640;scene.clientHeight=360;scene.dataset.motion=motion;scene.getBoundingClientRect=()=>({left:0,top:0});
 const window={};vm.runInNewContext(fs.readFileSync('web/static/gift_cannon.js','utf8'),{window,URL,Image:class {},fetch:()=>Promise.resolve({json:()=>Promise.resolve({gifts:[]})}),document:{createElement:node},matchMedia:()=>({matches:false}),requestAnimationFrame:fn=>{pending.set(++serial,fn);return serial},cancelAnimationFrame:id=>pending.delete(id),Math:math});
 const stop=window.GiftCannon.start(scene,{size:48},{gift:'Rosa',count:giftCount,user:'Luna',avatar_url:avatar});
 return {nodes,pending,stop,startNext(){return window.GiftCannon.start(scene,{size:48},{gift:'Rosa',count:giftCount,user:'Otro'});},step(t){const callbacks=[...pending.values()];pending.clear();callbacks.forEach(fn=>fn(t));}};
}
test('gift cannon bounds its burst, bounces inside the viewport and cancels its frame',()=>{
 const s=setup();for(let i=0;i<6000;i++)s.step(16*i);
 const balls=s.nodes.filter(n=>n.className==='cannon-ball');assert.equal(balls.length,10);
 for(const ball of balls){const [,x,y]=ball.style.transform.match(/translate(?:3d)?\(([-.\d]+)px,([-.\d]+)px/);assert.ok(+x>=0&&+x<=592);assert.ok(+y>=0&&+y<=306);}
 assert.ok(balls.every(b=>b.removed));s.stop();assert.equal(s.pending.size,0);assert.ok(balls.every(b=>b.removed));
});
test('reduced motion portraits expire without flying',()=>{
 const s=setup('reduced');for(let i=0;i<600;i++)s.step(i*16);const balls=s.nodes.filter(n=>n.className==='cannon-ball');assert.equal(balls.length,10);const before=balls.map(b=>b.style.transform);s.step(10000);assert.deepEqual(balls.map(b=>b.style.transform),before);assert.ok(balls.every(b=>b.removed));assert.equal(s.pending.size,0);s.stop();
});
test('aiming moves only the arrow while the cannon and sack remain fixed',()=>{
 const s=setup(),angles=new Set();
 const needle=s.nodes.find(n=>n.className==='arcade-needle');
 const body=s.nodes.find(n=>n.className==='arcade-gear');
 const sack=s.nodes.find(n=>n.className==='arcade-sack');
 for(let i=0;i<180;i++){
  s.step(i*16);angles.add(needle.style.transform);
  assert.equal(body.style.transform,undefined);
  assert.equal(sack.style.transform,undefined);
 }
 assert.ok(angles.size>20);s.stop();
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

test('portrait transfers and loads before launch and completes without a fixed timeout',async()=>{
 const s=setup();let finished=false;s.stop.done.then(()=>finished=true);
 for(let i=0;i<32;i++)s.step(i*16);
 assert.equal(s.nodes.filter(n=>n.className==='cannon-ball').length,0);
 assert.equal(s.nodes.find(n=>n.className==='gift-cannon arcade-launcher').dataset.phase,'transfer');
 for(let i=32;i<49;i++)s.step(i*16);
 assert.equal(s.nodes.find(n=>n.className==='gift-cannon arcade-launcher').dataset.phase,'loaded');
 for(let i=49;i<6000;i++)s.step(i*16);
 await Promise.resolve();assert.equal(finished,true);assert.equal(s.pending.size,0);s.stop();
});

test('portraits expire after completion and successive donations do not accumulate',async()=>{
 const s=setup();for(let i=0;i<6000;i++)s.step(i*16);assert.equal(s.pending.size,0);await s.stop.done;
 const first=s.nodes.filter(n=>n.className==='cannon-ball');assert.equal(first.length,10);assert.ok(first.every(n=>n.removed));
 const next=s.startNext();for(let i=6000;i<14000;i++)s.step(i*16);assert.equal(s.pending.size,0);await next.done;
 assert.equal(s.nodes.filter(n=>n.className==='cannon-ball'&&!n.removed).length,0);assert.ok(first.every(n=>n.removed));next();
});

test('successive donations finish across reproducible trajectories and slow frames',()=>{
 for(const step of [16,40])for(let seed=1;seed<=60;seed++){
  const s=setup('full',seed);let now=0;
  try{
   for(let donation=0;donation<2;donation++){
    if(donation)s.startNext();
    for(let i=0;i<10000&&s.pending.size;i++){now+=step;s.step(now);}
    assert.equal(s.pending.size,0,`seed=${seed}, frame=${step}, donation=${donation}`);
    assert.equal(s.nodes.filter(n=>n.className==='cannon-ball'&&!n.removed).length,0);
   }
  }finally{s.stop();}
 }
});

test('stopping removes all portraits before starting a fresh donation',()=>{
 const s=setup();for(let i=0;i<6000;i++)s.step(i*16);
 s.stop();assert.equal(s.nodes.filter(n=>n.className==='cannon-ball'&&!n.removed).length,0);
 const next=s.startNext();for(let i=0;i<6000;i++)s.step(i*16);
 assert.equal(s.pending.size,0);
 assert.equal(s.nodes.filter(n=>n.className==='cannon-ball'&&!n.removed).length,0);
 next();
});
test('very large streaks use a bounded visual burst while preserving the real caption count',()=>{
 const s=setup('full',1,500);for(let i=0;i<12000&&s.pending.size;i++)s.step(i*16);
 assert.equal(s.nodes.filter(n=>n.className==='cannon-ball'&&!n.removed).length,0);
 assert.match(s.nodes.find(n=>n.className==='cannon-caption').textContent,/× 500$/);s.stop();
});

 test('sender portrait uses only safe avatar URLs with an initial fallback',()=>{
 for(const avatar of ['https://example.com/luna.jpg','http://example.com/avatar',null,'javascript:alert(1)','data:image/png;base64,AA','https://']){
  const s=setup('full',1,1,avatar),loaded=s.nodes.find(n=>n.className==='arcade-loaded');
  assert.equal(loaded.children[0].textContent,'L');
  const image=loaded.children.find(n=>n.src===avatar);
  if(typeof avatar==='string'&&/^https?:\/\/example.com/.test(avatar)){
   assert.ok(image);assert.equal(image.referrerPolicy,'no-referrer');image.onerror();assert.equal(image.removed,true);
   assert.equal(loaded.children[0].removed,undefined);
  }else assert.equal(loaded.children.length,1);
  s.stop();
 }
 });
 test('portraits hold for three seconds and fade before removal in both motion modes',async()=>{
 for(const motion of ['full','reduced']){
  const s=setup(motion,1,1);let now=0,ball;
  for(;now<2000&&!ball;now+=16){s.step(now);ball=s.nodes.find(n=>n.className==='cannon-ball');}
  assert.ok(ball);assert.equal(ball.style.opacity,'1');
  for(let i=0;i<160;i++){now+=16;s.step(now);}
  assert.equal(ball.removed,undefined);assert.equal(ball.style.opacity,'1');
  for(let i=0;i<40;i++){now+=16;s.step(now);}
  assert.ok(Number(ball.style.opacity)<1);assert.equal(ball.removed,undefined);
  for(let i=0;i<50;i++){now+=16;s.step(now);}
  assert.equal(ball.removed,true);assert.equal(s.pending.size,0);await s.stop.done;s.stop();
 }
 });
