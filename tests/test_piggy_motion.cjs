const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

class FakeElement {
  constructor(width = 0, height = 0) {
    this.style = { setProperty(name, value) { this[name] = value; }, removeProperty(name) { delete this[name]; } };
    this.dataset = {};
    this.attributes = {};
    this.children = [];
    this.classes = new Set();
    this.classList = {
      add: name => this.classes.add(name),
      remove: name => this.classes.delete(name),
      contains: name => this.classes.has(name),
      toggle: (name, force) => force ? this.classes.add(name) : this.classes.delete(name),
    };
    this.clientWidth = width;
    this.clientHeight = height;
    this.naturalWidth = 0;
    this.naturalHeight = 0;
    this.src = '';
    this.isConnected = true;
  }
  setAttribute(name, value) { this.attributes[name] = value; }
  querySelector(selector) { return this.children.find(child => child.selector === selector) || null; }
  append(...children) { this.children.push(...children); }
  getBoundingClientRect() { return this.rect || { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight }; }
  getAnimations() { return []; }
  animate(frames, options) {
    this.motion = { frames, options, finished: Promise.resolve(), cancel() {} };
    return this.motion;
  }
}

function loadPiggyBank(reduced = false) {
  const fill = new FakeElement(200, 100); fill.selector = '.piggy-fill';
  const glass = new FakeElement(); glass.selector = '.piggy-glass';
  const customImage = new FakeElement(); customImage.selector = '.piggy-custom-image';
  const slot = new FakeElement(); slot.selector = '.piggy-slot';
  const pig = new FakeElement(200, 100); pig.children = [customImage, fill, glass, slot];
  const context = {
    window: { BankShapes: require('../web/static/bank_shapes.js'), PiggyPhysics: {} },
    document: { createElement: () => new FakeElement() },
    requestAnimationFrame: () => 1,
    matchMedia: () => ({ matches: reduced }),
    performance: { now: () => 0 },
    localStorage: { setItem() {}, getItem() { return null; } },
    fetch: async () => ({ ok: true, json: async () => ({ gifts: [] }) }),
    Image: class {},
    Map, WeakMap, Set, Math, Date, Promise, Number, String, Object, JSON,
  };
  vm.runInNewContext(fs.readFileSync('web/static/piggy_bank.js', 'utf8'), context);
  return { PiggyBank: context.window.PiggyBank, pig, fill, glass, customImage, slot };
}

test('custom bank uses its safe asset id, natural ratio, and one transformed coordinate space', () => {
  const { PiggyBank, pig, fill, glass, customImage, slot } = loadPiggyBank();
  PiggyBank.prepare(pig, 'custom', {
    custom_bank_asset: `${'a'.repeat(32)}.png`,
    bank_position: { x: 24, y: 76 },
    bank_scale: 125,
    entry_point: { x: 43, y: 18 },
  });

  assert.equal(customImage.src, `/broadcast/bank-assets/${'a'.repeat(32)}.png`);
  assert.equal(customImage.style.display, 'block');
  assert.equal(glass.style.display, 'none');
  assert.equal(pig.style.left, '24%');
  assert.equal(pig.style.top, '76%');
  assert.equal(pig.style.transform, 'translate(-50%, -50%) scale(1.25)');
  assert.equal(slot.style.left, '43%');
  assert.equal(slot.style.top, '18%');
  assert.equal(fill.style.left, '0%');
  assert.equal(fill.style.height, '100%');
  assert.ok(pig.classList.contains('is-custom-bank'));
  customImage.naturalWidth = 900;
  customImage.naturalHeight = 600;
  customImage.onload();
  assert.equal(pig.style['aspect-ratio'], '900 / 600');
  const widgetSource = fs.readFileSync('web/static/widgets.js', 'utf8');
  assert.match(widgetSource, /PiggyBank\.prepare\(stage\.querySelector\('\.overlay-piggy-bank'\),d\.bank\|\|'cochito',d\)/);
  assert.match(widgetSource, /d\.custom_bank_asset,d\.bank_position,d\.bank_scale,d\.entry_point/);
});

test('custom bank rejects arbitrary asset URLs and keeps built-ins intact', () => {
  const { PiggyBank, pig, customImage, glass } = loadPiggyBank();
  PiggyBank.prepare(pig, 'custom', { custom_bank_asset: 'https://invalid.example/bank.png' });
  assert.equal(pig.dataset.bank, 'cochito');
  assert.equal(customImage.src, '');
  assert.equal(customImage.style.display, 'none');
  assert.notEqual(glass.style.display, 'none');
});

test('built-in banks apply persisted scale without changing model cavity geometry', () => {
  const { PiggyBank, pig, fill, slot } = loadPiggyBank();
  PiggyBank.prepare(pig, 'pato', { bank_scale: 150 });
  assert.equal(pig.dataset.bankScale, '150');
  assert.equal(pig.style.transform, 'translateX(-50%) scale(1.5)');
  assert.equal(fill.style.left, undefined);
  assert.equal(fill.style.height, undefined);
  assert.equal(slot.style.left, undefined);
  assert.equal(pig.style['--bank-left'], `${PiggyBank.models.pato.area[0]}%`);
});

test('custom bank keeps its natural aspect ratio when position and scale change', () => {
  const { PiggyBank, pig, customImage } = loadPiggyBank();
  const id = `${'b'.repeat(32)}.png`;
  PiggyBank.prepare(pig, 'custom', { custom_bank_asset: id });
  customImage.naturalWidth = 900;
  customImage.naturalHeight = 600;
  customImage.onload();
  PiggyBank.prepare(pig, 'custom', { custom_bank_asset: id, bank_scale: 150, bank_position: { x: 70, y: 40 } });
  assert.equal(pig.style['aspect-ratio'], '900 / 600');
});

test('built-in to the same custom asset reapplies its cached natural ratio', () => {
  const { PiggyBank, pig, customImage } = loadPiggyBank();
  const id = `${'c'.repeat(32)}.jpg`;
  PiggyBank.prepare(pig, 'custom', { custom_bank_asset: id });
  customImage.naturalWidth = 900;
  customImage.naturalHeight = 600;
  customImage.onload();
  PiggyBank.prepare(pig, 'cochito');
  PiggyBank.prepare(pig, 'custom', { custom_bank_asset: id, bank_scale: 125 });
  assert.equal(pig.style['aspect-ratio'], '900 / 600');
});

test('late custom image completion cannot mutate a built-in bank', () => {
  const { PiggyBank, pig, customImage } = loadPiggyBank();
  PiggyBank.prepare(pig, 'custom', { custom_bank_asset: `${'d'.repeat(32)}.webp` });
  const lateLoad = customImage.onload;
  PiggyBank.prepare(pig, 'pato');
  customImage.naturalWidth = 900;
  customImage.naturalHeight = 600;
  lateLoad();
  assert.equal(pig.dataset.bank, 'pato');
  assert.equal(pig.style['aspect-ratio'], undefined);
});

test('custom-bank screen coordinates map back into the unscaled cavity', () => {
  const { PiggyBank, pig, fill, slot } = loadPiggyBank();
  PiggyBank.setShapes({ custom: { points: [], slot: [50, 16] } });
  pig.dataset.bank = 'custom';
  pig.dataset.bankScale = '200';
  fill.rect = { left: 100, top: 40, width: 400, height: 200 };
  slot.rect = { left: 300, top: 80, width: 40, height: 8 };
  const token = new FakeElement(48, 48);
  token.style.width = '48px';
  PiggyBank.settle(token, { id: 'scale-check' }, pig);
  assert.match(token.style.transform, /^translate\(106\.25px,\s*19\.475px\)/);
});

test('built-in scale maps screen entry coordinates back into its cavity', () => {
  const { PiggyBank, pig, fill, slot } = loadPiggyBank();
  PiggyBank.setShapes({ pato: { points: [], slot: [50, 16] } });
  pig.dataset.bank = 'pato';
  pig.dataset.bankScale = '200';
  fill.rect = { left: 100, top: 40, width: 400, height: 200 };
  slot.rect = { left: 300, top: 80, width: 40, height: 8 };
  const token = new FakeElement(48, 48);
  token.style.width = '48px';
  PiggyBank.settle(token, { id: 'builtin-scale-check' }, pig);
  assert.match(token.style.transform, /^translate\(106\.25px,\s*19\.475px\)/);
});

function drop(reduced, gift) {
  const { PiggyBank } = loadPiggyBank(reduced);
  const token = new FakeElement(48, 48);
  token.rect = { left: 0, top: 0, width: 48, height: 48 };
  const stage = new FakeElement(); stage.rect = { left: 0, top: 0, width: 600, height: 400 };
  const pig = new FakeElement(); pig.children = [new FakeElement(200, 100)];
  pig.children[0].selector = '.piggy-fill';
  const slot = new FakeElement(); slot.rect = { left: 280, top: 80, width: 40, height: 8 };
  let deposits = 0;
  PiggyBank.drop({ token, stage, pig, slot, event: { gift }, duration: 4200, onDeposit: () => deposits++ });
  return { token, deposit: () => token.motion.onfinish(), deposits: () => deposits };
}

test('rose uses a distinct arc and petal flourish without changing deposit ownership', () => {
  const motion = drop(false, 'Rosa'), token = motion.token, ordinary = drop(false, 'Dona').token;
  assert.ok(token.classList.contains('rose-drop'));
  assert.ok(token.motion.options.duration >= 1500);
  const middle = Math.floor(token.motion.frames.length / 2);
  assert.notEqual(token.motion.frames[middle].transform, ordinary.motion.frames[middle].transform);
  motion.deposit();
  assert.equal(motion.deposits(), 1);
  const css = fs.readFileSync('web/static/donation_jar.css', 'utf8');
  assert.match(css, /\.overlay-drop-token\.rose-drop::before/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});

test('reduced-motion roses take a short, non-flourished route to the same deposit callback', () => {
  const motion = drop(true, 'Rosa'), token = motion.token;
  assert.ok(token.motion.options.duration <= 500);
  assert.ok(!token.classList.contains('rose-drop'));
  motion.deposit();
  assert.equal(motion.deposits(), 1);
});

test('stored gift sizes remain proportional across the whole slider range',()=>{
 const context={window:{}};vm.runInNewContext(fs.readFileSync('web/static/piggy_bank.js','utf8'),context);
 const diameter=context.window.PiggyBank.giftDiameter;
 assert.equal(diameter(120,230,200)/diameter(36,230,200),120/36);
 assert.equal(diameter(64,230,200),20);
});

test('flight and settled gift diameters stay continuous at every bank scale', () => {
  for (const bank of ['pato', 'custom']) {
    for (const bankScale of [25, 100, 200]) {
      const { PiggyBank, pig, fill, slot } = loadPiggyBank();
      PiggyBank.setShapes({ [bank]: { points: [], slot: [50, 16] } });
      const options = { bank_scale: bankScale, custom_bank_asset: `${'e'.repeat(32)}.png` };
      PiggyBank.prepare(pig, bank, options);
      pig.dataset.giftSize = '64';
      fill.rect = { left: 100, top: 80, width: 800 * bankScale / 100, height: 600 * bankScale / 100 };
      slot.rect = { left: 400, top: 200, width: 40 * bankScale / 100, height: 8 * bankScale / 100 };
      const token = new FakeElement(64, 64);
      token.rect = { left: 0, top: 0, width: 64, height: 64 };
      token.style.width = '64px';
      let flightDiameter;
      PiggyBank.drop({
        token, stage: new FakeElement(), pig, slot, event: { id: `${bank}-${bankScale}` },
        onDeposit: () => {
          flightDiameter = Number(token.motion.frames.at(-1).transform.match(/scale\(([^)]+)\)/)[1]) * 64;
          PiggyBank.settle(token, { id: `${bank}-${bankScale}` }, pig);
        },
      });
      token.motion.onfinish();
      const settledDiameter = parseFloat(token.style.width) * bankScale / 100;
      assert.ok(Math.abs(flightDiameter - settledDiameter) < 0.01,
        `${bank} at ${bankScale}%: flight ${flightDiameter}px, settled ${settledDiameter}px`);
    }
  }
});
function dropAt(duration,reduced=false){
 const context={window:{},matchMedia:()=>({matches:reduced})};
 vm.runInNewContext(fs.readFileSync('web/static/piggy_bank.js','utf8'),context);
 let animation;
 const rect=(left,top,width,height)=>({left,top,width,height,bottom:top+height});
 const token={style:{},dataset:{},classList:{toggle(){}},isConnected:true,getBoundingClientRect:()=>rect(0,0,64,64),animate:(frames,options)=>{
  animation={frames,options,finished:Promise.resolve()};return animation;
 }};
 let deposits=0;
 context.window.PiggyBank.drop({token,duration,stage:{getBoundingClientRect:()=>rect(0,0,500,600)},slot:{getBoundingClientRect:()=>rect(200,300,40,8)},pig:{dataset:{bankScale:'100'},querySelector:()=>({clientWidth:230,clientHeight:200,getBoundingClientRect:()=>rect(130,320,230,200)})},onDeposit:()=>deposits++});
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
