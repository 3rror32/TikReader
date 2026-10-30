const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const EffectQueue = require('../web/static/effect_queue.js');

function setup() {
  const buttons = [], renders = [], records = [], listeners = {};
  const parent = {}, origin = 'http://localhost';
  const node = () => ({append(){}, classList:{add(){}}, querySelector(){return null;}});
  const root = node();
  vm.runInNewContext(fs.readFileSync(require.resolve('../web/static/overlay_animation_defaults.js'), 'utf8')+'\n'+fs.readFileSync(require.resolve('../web/static/overlay_animation_widget.js'), 'utf8'), {
    EffectQueue, URL, URLSearchParams, location:{search:'?preview=1', origin}, parent,
    window:{OverlayStudio:{},addEventListener:(name, fn) => {listeners[name] = fn;}},
    document:{body:{...node(),dataset:{effect:'cannon'}},getElementById:()=>root,createElement:tag=>{
      const el = node(); if(tag==='button') buttons.push(el); return el;
    }},
    OverlayAnimationRenderer:{render:(root,key,settings,record)=>{renders.push(settings);records.push(record);return {done:Promise.resolve()};}},
    setInterval(){},
  });
  return {buttons, renders, records, message:data=>listeners.message({origin,source:parent,data:{type:'animation-preview',...data}})};
}

test('both cannon test buttons deliver a bundled profile photo through the normal portrait renderer', async () => {
  const s=setup();
  await new Promise(setImmediate);
  s.buttons.find(b=>b.textContent==='Probar animación').onclick();
  await new Promise(setImmediate);
  s.message({command:'enqueue',settings:{motion:'full'}});
  await new Promise(setImmediate);
  assert.equal(s.records.length,3);
  for(const record of s.records){
    assert.equal(record.avatar_url,'http://localhost/static/arcade-launcher/demo-avatar.png');
    assert.equal(record.gift,'Regalo de prueba');
  }
  const photo=fs.readFileSync(require.resolve('../web/static/arcade-launcher/demo-avatar.png'));
  assert.equal(photo.subarray(1,4).toString(),'PNG');
});

test('initial cannon preview uses animated default before parent settings arrive', () => {
  assert.equal(setup().renders[0].motion, 'full');
});

test('cannon hides obsolete selectors and normalizes stale settings without affecting other effects', async () => {
  const nodes=[],posts=[];
  const node=tag=>{
    const n={tag,children:[],style:{},classList:{add(){}},append(...items){for(const item of items){item.parentElement=this;this.children.push(item);}},after(){},setAttribute(){},addEventListener(){},querySelector(tag){return this.children.find(n=>n.tag===tag);}};
    Object.defineProperties(n,{options:{get(){return this.children;}},selectedOptions:{get(){return this.children.filter(n=>n.selected);}}});
    nodes.push(n);return n;
  };
  const ids=new Map();
  const document={createElement:node,getElementById(id){if(!ids.has(id))ids.set(id,{...node('div'),contentWindow:{postMessage(){}}});return ids.get(id);}};
  const window={};
  vm.runInNewContext(fs.readFileSync(require.resolve('../web/static/overlay_animation_defaults.js'),'utf8'),{window});
  vm.runInNewContext(fs.readFileSync(require.resolve('../web/static/overlay_animation_controls.js'),'utf8'),{
    window,document,OverlayAnimationDefaults:window.OverlayAnimationDefaults,OverlayCanvas:{options:[['horizontal','PC']],apply(){}},location:{origin:'http://localhost'},
    fetch:async(url,options)=>{if(options)posts.push(JSON.parse(options.body));return {ok:true,status:200,json:async()=>({settings:{trigger:'like',scenes:['talk']}})};},
  });
  const field=label=>nodes.find(n=>n.tag==='label'&&n.children[0].textContent===label);
  await window.AnimationControls.select('cannon');
  assert.equal(field('Mostrar en estas escenas').hidden,true);
  assert.equal(field('Al recibir').hidden,true);
  await nodes.find(n=>n.tag==='form').onsubmit({preventDefault(){}});
  assert.equal(posts[0].trigger,'gift');
  assert.deepEqual(posts[0].scenes,['talk','start','pause','end']);
  await window.AnimationControls.select('hearts');
  assert.equal(field('Mostrar en estas escenas').hidden,false);
  assert.equal(field('Al recibir').hidden,false);
});

test('preview button and parent button replay with selected motion after completion', async () => {
  const s = setup();
  await new Promise(setImmediate);
  s.message({settings:{motion:'reduced'}});
  s.buttons.find(b=>b.textContent==='Probar animación').onclick();
  await new Promise(setImmediate);
  assert.equal(s.renders.length, 2);
  assert.equal(s.renders[1].motion, 'reduced');
  s.message({command:'enqueue',settings:{motion:'full'}});
  await new Promise(setImmediate);
  assert.equal(s.renders.length, 3);
  assert.equal(s.renders[2].motion, 'full');
});

test('welcome message defaults to TikReader and supports the usuario variable', () => {
  const window = {};
  vm.runInNewContext(fs.readFileSync(require.resolve('../web/static/overlay_animation_defaults.js'), 'utf8'), {window});
  vm.runInNewContext(fs.readFileSync(require.resolve('../web/static/overlay_animation_renderer.js'), 'utf8'), {window});
  assert.equal(window.OverlayAnimationDefaults('welcome').message, 'Bienvenido TikReader');
  assert.equal(window.OverlayAnimationRenderer.formatMessage('Bienvenido {usuario}', '@Carlos'), 'Bienvenido Carlos');
  assert.equal(window.OverlayAnimationRenderer.formatMessage('', 'Carlos'), 'Bienvenido TikReader');
});

test('every configurable animation message explains and applies the usuario variable', () => {
  const controls = fs.readFileSync(require.resolve('../web/static/overlay_animation_controls.js'), 'utf8');
  const vip = fs.readFileSync(require.resolve('../web/static/vip_celebration.js'), 'utf8');
  const studio = fs.readFileSync(require.resolve('../web/static/animation_studio.js'), 'utf8');
  assert.match(controls, /Puedes usar \{usuario\}/);
  assert.match(controls, /aria-describedby/);
  assert.match(vip, /OverlayAnimationRenderer\?\.formatMessage\(s\.message,record\.user/);
  assert.match(studio, /Variables disponibles: \{usuario\}, \{evento\}, \{regalo\}, \{cantidad\} y \{diamantes\}/);
  assert.match(studio, /alert-text-variable-help/);
});

test('alert studio exposes readiness, source testing, new events and audio', () => {
  const studio = fs.readFileSync(require.resolve('../web/static/animation_studio.js'), 'utf8');
  const widget = fs.readFileSync(require.resolve('../web/static/alert_widget.js'), 'utf8');
  const css = fs.readFileSync(require.resolve('../web/static/alerts.css'), 'utf8');
  assert.match(studio, /Preparación de la transmisión/);
  assert.match(studio, /animation-studio\/test/);
  assert.match(studio, /\['subscribe','Alguien se suscribe'\]/);
  assert.match(studio, /sound_asset/);
  assert.match(widget, /broadcast\/alerts\/heartbeat/);
  assert.match(css, /alert-stage\[data-motion=reduced\].*animation:none!important/);
});

test('readiness polling pauses while hidden, refreshes immediately when visible, and avoids overlapping requests', async () => {
  const source = fs.readFileSync(require.resolve('../web/static/animation_studio.js'), 'utf8');
  const start = source.indexOf('function createReadinessPoller(');
  assert.notEqual(start, -1, 'animation studio defines its readiness poller');
  const end = source.indexOf('\n  const readinessPoller', start);
  assert.notEqual(end, -1, 'animation studio wires the readiness poller');
  const timers = new Map();
  let nextTimer = 0;
  const context = {
    document: {hidden: false},
    setTimeout(callback, delay) { const id = ++nextTimer; timers.set(id, {callback, delay}); return id; },
    clearTimeout(id) { timers.delete(id); },
  };
  vm.runInNewContext(`${source.slice(start, end)};globalThis.createReadinessPoller=createReadinessPoller;`, context);

  let resolveRequest;
  let requests = 0;
  const pane = {hidden: true};
  const poller = context.createReadinessPoller(pane, () => {
    requests++;
    return new Promise(resolve => { resolveRequest = resolve; });
  }, () => {});
  poller.refresh();
  assert.equal(requests, 0, 'hidden pane does not request status');

  pane.hidden = false;
  poller.refresh();
  await new Promise(setImmediate);
  assert.equal(requests, 1, 'opening the pane requests status immediately');
  poller.refresh();
  assert.equal(requests, 1, 'a second refresh does not overlap the active request');
  resolveRequest({});
  await new Promise(setImmediate);
  assert.equal([...timers.values()][0]?.delay, 4000, 'visible pane resumes one four-second timer');

  context.document.hidden = true;
  poller.refresh();
  assert.equal(timers.size, 0, 'hidden document clears the timer');
  const beforeResume = requests;
  context.document.hidden = false;
  poller.refresh();
  await new Promise(setImmediate);
  assert.equal(requests, beforeResume + 1, 'returning to the document refreshes immediately');
});

test('alert text supports event and diamond variables', () => {
  const window = {};
  vm.runInNewContext(fs.readFileSync(require.resolve('../web/static/alert_renderer.js'), 'utf8'), {window});
  const template = {text:'{evento}: {usuario} · {diamantes}',trigger:'gift',diamonds:75};
  assert.equal(window.AlertRenderer.sample(template,'Ana','Rosa',2),'Regalo: Ana · 75');
});
