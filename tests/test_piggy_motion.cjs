const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
test('stored gift sizes remain proportional across the whole slider range',()=>{
 const context={window:{}};vm.runInNewContext(fs.readFileSync('web/static/piggy_bank.js','utf8'),context);
 const diameter=context.window.PiggyBank.giftDiameter;
 assert.equal(diameter(120,230,200)/diameter(36,230,200),120/36);
 assert.equal(diameter(64,230,200),20);
});
function dropAt(duration,reduced=false){
 const context={window:{},matchMedia:()=>({matches:reduced})};
 vm.runInNewContext(fs.readFileSync('web/static/piggy_bank.js','utf8'),context);
 let animation;
 const rect=(left,top,width,height)=>({left,top,width,height,bottom:top+height});
 const token={style:{},dataset:{},isConnected:true,getBoundingClientRect:()=>rect(0,0,64,64),animate:(frames,options)=>{
  animation={frames,options,finished:Promise.resolve()};return animation;
 }};
 let deposits=0;
 context.window.PiggyBank.drop({token,duration,stage:{getBoundingClientRect:()=>rect(0,0,500,600)},slot:{getBoundingClientRect:()=>rect(200,300,40,8)},pig:{querySelector:()=>({getBoundingClientRect:()=>rect(130,320,230,200)})},onDeposit:()=>deposits++});
 return {token,animation,deposits:()=>deposits};
}
test('fall uses the full selected seconds at fast, default, and slow settings',()=>{
 for(const milliseconds of [1500,4200,8000,12000]){
  const {token,animation}=dropAt(milliseconds);
  assert.equal(animation.options.duration,milliseconds);
  assert.equal(Number(token.dataset.fallSeconds),milliseconds/1000);
  assert.equal(animation.options.easing,'linear');
  assert.ok(animation.frames.every(frame=>!frame.transform.includes('NaN')));
 }
});
test('settling starts only after the entrance finishes, and ignores removed gifts',()=>{
 const run=dropAt(8000);assert.equal(run.deposits(),0);
 run.animation.onfinish();assert.equal(run.deposits(),1);
 run.token.isConnected=false;run.animation.onfinish();assert.equal(run.deposits(),1);
});
test('reduced motion respects the selected duration without spinning',()=>{
 const {animation}=dropAt(12000,true);
 assert.equal(animation.options.duration,12000);
 for(const frame of animation.frames)assert.match(frame.transform,/rotate\(0deg\)/);
});

test('ease-in and ease-out occupy exactly 500 ms at every duration',()=>{
 for(const duration of [1500,4200,9900,12000]){
  const {animation}=dropAt(duration);
  const frames=animation.frames;
  const at=t=>frames.find(f=>Math.abs(f.offset*duration-t)<.00001);
  assert.ok(at(500));assert.ok(at(duration-500));
  const y=f=>Number(f.transform.match(/,([^,]+)px\)/)[1]);
  // The first path segment spans -64 to 32.16 px over 20% progress.
  const progress=f=>y(f)<=32.16?(y(f)+64)/(32.16+64)*.2:.2+(y(f)-32.16)/(268-32.16)*.6;
  assert.ok(Math.abs(progress(at(500))-250/(duration-500))<1e-9);
  assert.ok(Math.abs(progress(at(250))/progress(at(500))-.25)<1e-9);
  assert.equal(frames.at(-1).offset,1);
 }
});

test('roses render immediately and load bundled artwork without the gift catalog',async()=>{
 const requests=[];
 const context={window:{},document:{createElement:tag=>{
  const node={tag,setAttribute(){}};
  if(tag==='img')Object.defineProperty(node,'src',{set(src){requests.push(src);queueMicrotask(()=>node.onload());}});
  return node;
 }},fetch:()=>{throw Error('Rose must not require internet');}};
 vm.runInNewContext(fs.readFileSync('web/static/piggy_bank.js','utf8'),context);
 const token={classList:{add(){}},setAttribute(){},append(node){this.child=node;},replaceChildren(node){this.child=node;}};
 context.window.PiggyBank.paintGift(token,{gift:'Rosa'});
 assert.equal(token.child.textContent,'🌹');
 await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(requests,['/static/rose.png']);
 assert.equal(token.child.tag,'img');
 assert.ok(fs.statSync('web/static/rose.png').size>0);
});

async function renderGift(event,gifts=[]){
 const requests=[];
 const context={window:{},document:{createElement:tag=>{
  const node={tag,setAttribute(){}};
  if(tag==='img')Object.defineProperty(node,'src',{set(src){requests.push(src);queueMicrotask(()=>src.includes('broken')?node.onerror():node.onload());}});
  return node;
 }},fetch:async()=>({ok:true,json:async()=>({gifts})})};
 vm.runInNewContext(fs.readFileSync('web/static/piggy_bank.js','utf8'),context);
 const token={classList:{add(){}},setAttribute(){},append(node){this.child=node;},replaceChildren(node){this.child=node;}};
 context.window.PiggyBank.paintGift(token,event);
 await new Promise(resolve=>setImmediate(resolve));
 return {requests,token};
}
test('TikTok and Heart Me use their received artwork, even without a name',async()=>{
 for(const [id,name] of [['5269','TikTok'],['7934','Heart Me']]){
  for(const gift of [name,undefined]){
   const url=`https://example.test/${id}.webp`;
   const {requests,token}=await renderGift({gift_id:id,gift,image_url:url});
   assert.deepEqual(requests,[url]);assert.equal(token.child.tag,'img');
  }
 }
});
test('catalog fallback selects the gift ID, not a conflicting or similar name',async()=>{
 const gifts=[{id:'5655',name:'Rose',image_url:'https://example.test/rose.webp'},
  {id:'5269',name:'TikTok',image_url:'https://example.test/tiktok.webp'},
  {id:'8239',name:'White Rose',image_url:'https://example.test/white.webp'}];
 for(const [id,url] of [['5269','tiktok'],['8239','white']]){
  const {requests}=await renderGift({gift_id:id,gift:'Rose',image_url:'https://example.test/broken'},gifts);
  assert.deepEqual(requests,['https://example.test/broken',`https://example.test/${url}.webp`]);
 }
 const {requests}=await renderGift({gift_id:'99999',gift:'Rose'},gifts);
 assert.deepEqual(requests,[]);
});
