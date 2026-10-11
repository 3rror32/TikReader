process.chdir(require('node:path').resolve(__dirname, '..'));
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const script = fs.readFileSync(`${__dirname}/../web/static/workspace.js`, 'utf8');

function setup(storage = new Map()) {
  const nodes = new Map(), timers = [], notices = [];
  let build = 'first', reloads = 0, changes = 0, alertChanges = 0;
  class Node {}
  Object.defineProperty(Node.prototype,'textContent',{configurable:true,get(){return this._textContent||'';},set(value){this._textContent=String(value??'');}});
  function element() {
    const listeners = {}, attributes = {}, classes = new Set();
    const node=Object.assign(Object.create(Node.prototype),{
      checked:false, value:'', textContent:'', style:{setProperty(){}},
      dataset:{}, parentElement:{after(){}}, append(){}, after(){}, replaceChildren(){},
      setAttribute(key, value){attributes[key] = value;},
      getAttribute(key){return attributes[key];},
      classList:{toggle(key, on){if(on)classes.add(key);else classes.delete(key);}, contains:key=>classes.has(key)},
      addEventListener(type, fn){(listeners[type] ||= []).push(fn);},
      dispatchEvent(event){this[`on${event.type}`]?.(event);for(const fn of listeners[event.type] || [])fn(event);},
    });
    return node;
  }
  const get = id => {if(!nodes.has(id))nodes.set(id, element());return nodes.get(id);};
  get('tts-enabled').onchange = () => {changes++;get('tts-state').textContent = get('tts-enabled').checked?'Voz activa':'Voz apagada';};
  get('alerts-enabled').onchange = () => {alertChanges++;};
  const window = {Notifications:{show:(text, options)=>notices.push({text, ...options})},dispatchEvent(){},addEventListener(){}};
  window.location={origin:'http://localhost'};
  vm.runInNewContext(fs.readFileSync(`${__dirname}/../web/static/overlay_url.js`, 'utf8')+'\n'+script, {
    URL,Node,
    window, Studio:{audioDiagnostics:()=>({paused:false}),preferences:()=>({}),applyPreferences(){}}, Event,
    document:{getElementById:get, createElement:element, body:element(), documentElement:element(),addEventListener(){}},
    localStorage:{getItem:key=>storage.get(key)??null, setItem:(key,value)=>storage.set(key,value)},
    MutationObserver:class {observe(){}},
    location:{origin:'http://localhost',reload(){reloads++;}},
    fetch:async()=>({json:async()=>({build})}),
    confirm:()=>true,
    setTimeout(fn){timers.push(fn);},
  });
  return {get, notices, timers, setBuild:value=>{build=value;}, reloads:()=>reloads, changes:()=>changes, alertChanges:()=>alertChanges};
}

test('automatic comment voice retains enabled and disabled choices across reloads', () => {
  const storage = new Map();
  const first = setup(storage);
  assert.equal(first.get('voice-toggle').getAttribute('aria-pressed'), 'false');
  assert.equal(first.get('voice-toggle').textContent, 'Leer comentarios');
  first.get('voice-toggle').onclick();
  assert.equal(storage.get('tikreader.voiceWanted'), 'true');
  assert.equal(first.get('voice-toggle').textContent, 'Leer comentarios');
  assert.equal(first.changes(), 2, 'one initialization and one change per click');
  const reloaded = setup(storage);
  assert.equal(reloaded.get('tts-enabled').checked, true);
  assert.equal(reloaded.get('voice-toggle').getAttribute('aria-pressed'), 'true');
  assert.equal(reloaded.get('voice-toggle').classList.contains('enabled'), true);
  assert.match(reloaded.get('voice-visible').textContent, /Voz activa/);
  reloaded.get('voice-toggle').onclick();
  assert.equal(storage.get('tikreader.voiceWanted'), 'false');
  assert.equal(setup(storage).get('tts-enabled').checked, false);
});

test('update notice and its reload action preserve automatic comment voice', async () => {
  const storage = new Map([['tikreader.voiceWanted', 'true']]);
  const page = setup(storage);
  await new Promise(resolve=>setImmediate(resolve));
  page.setBuild('updated');
  await page.timers.shift()();
  assert.equal(page.notices.length, 1);
  assert.equal(page.get('tts-enabled').checked, true);
  page.notices[0].action();
  assert.equal(page.reloads(), 1);
  assert.equal(setup(storage).get('tts-enabled').checked, true);
});

test('invalid or unavailable stored preference defaults to voice off', () => {
  for(const value of ['invalid', 'null', '"false"']) {
    assert.equal(setup(new Map([['tikreader.voiceWanted', value]])).get('tts-enabled').checked, false);
  }
  assert.equal(setup({get(){throw Error('Unavailable');}}).get('tts-enabled').checked, false);
});

test('loading an enabled profile persists voice off before reload without rewriting the profile', async () => {
  const profile = {voice:true, alerts:true, settings:{}, layout:{split:58,presenter:false}};
  const storage = new Map([['tikreader.profiles', JSON.stringify({Enabled:profile})]]);
  const page = setup(storage);
  page.get('profile-select').value = 'Enabled';
  page.get('profile-select').onchange();
  await page.get('profile-load').onclick();
  assert.equal(page.reloads(), 1);
  assert.equal(page.changes(), 2, 'profile pause dispatches one change after initialization');
  assert.equal(page.alertChanges(), 1, 'profile pause dispatches one local-alert change');
  assert.equal(storage.get('tikreader.voiceWanted'), 'false');
  assert.equal(page.get('tts-enabled').checked, false);
  assert.deepEqual(JSON.parse(storage.get('tikreader.profiles')).Enabled, profile);
  const reloaded = setup(storage);
  assert.equal(reloaded.get('tts-enabled').checked, false, 'voice remains paused until a later user change');
  reloaded.get('voice-toggle').onclick();
  assert.equal(storage.get('tikreader.voiceWanted'), 'true', 'separate user activation remains available');
});
