const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const EffectQueue = require('../web/static/effect_queue.js');

function setup() {
  const buttons = [], renders = [], listeners = {};
  const parent = {}, origin = 'http://localhost';
  const node = () => ({append(){}, classList:{add(){}}, querySelector(){return null;}});
  const root = node();
  vm.runInNewContext(fs.readFileSync(require.resolve('../web/static/overlay_animation_defaults.js'), 'utf8')+'\n'+fs.readFileSync(require.resolve('../web/static/overlay_animation_widget.js'), 'utf8'), {
    EffectQueue, URLSearchParams, location:{search:'?preview=1', origin}, parent,
    window:{OverlayStudio:{},addEventListener:(name, fn) => {listeners[name] = fn;}},
    document:{body:{...node(),dataset:{effect:'cannon'}},getElementById:()=>root,createElement:tag=>{
      const el = node(); if(tag==='button') buttons.push(el); return el;
    }},
    OverlayAnimationRenderer:{render:(root,key,settings)=>{renders.push(settings);return {done:Promise.resolve()};}},
    setInterval(){},
  });
  return {buttons, renders, message:data=>listeners.message({origin,source:parent,data:{type:'animation-preview',...data}})};
}

test('initial cannon preview uses animated default before parent settings arrive', () => {
  assert.equal(setup().renders[0].motion, 'full');
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
  assert.match(studio, /Puedes usar \{usuario\}, \{regalo\} y \{cantidad\}/);
  assert.match(studio, /alert-text-variable-help/);
});
