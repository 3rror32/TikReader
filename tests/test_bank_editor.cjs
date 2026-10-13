process.chdir(require('node:path').resolve(__dirname, '..'));
const fs = require('node:fs'), assert = require('node:assert/strict'), test = require('node:test'), vm = require('node:vm');

const editor = fs.readFileSync('web/static/bank_editor.js', 'utf8');
const games = fs.readFileSync('web/static/live_games.js', 'utf8');

test('custom bank upload is explicit, same-origin, and retains the returned asset ID', () => {
  assert.match(games, /bankFile\.accept='image\/png,image\/jpeg,image\/webp'/);
  assert.match(games, /\/interactivity\/bank-assets/);
  assert.match(games, /FormData/);
  assert.match(games, /custom_bank_asset/);
  assert.match(games, /Object\.entries\(window\.PiggyBank\.models\)/);
});

test('bank editor exposes bounded keyboard controls and persists transform fields', () => {
  for (const field of ['bank_position', 'bank_scale', 'entry_point']) assert.ok(editor.includes(field), field);
  assert.match(editor, /type\s*=\s*['"]range['"]/);
  assert.match(editor, /pointercancel/);
  assert.match(editor, /pointerEvents='auto'/);
  assert.match(editor, /aria-label/);
  assert.match(editor, /action:\s*['"]configure['"]/);
});

test('built-in bank scale stays available and saves through the existing configure flow', async () => {
  const ui = await makeEditor('pato', { bank_scales: { pato: 135, custom: 85 } });
  const placement = ui.box.children.find(node => node.className === 'bank-editor-placement');
  const scaleInput = placement.children.at(-1).children[1];
  assert.equal(placement.hidden, false);
  scaleInput.value = 135;
  scaleInput.oninput();
  assert.equal(ui.pig.style.getPropertyValue('transform'), 'translateX(-50%) scale(1.35)');
  await findButton(ui.box, 'Guardar cambios').onclick();
  assert.equal(ui.requests.at(-1).bank, 'pato');
  assert.equal(ui.requests.at(-1).bank_scale, 135);
});

test('switching bank hydration restores that model scale without enabling built-in placement', async () => {
  const ui = await makeEditor('cochito', {}, false, {
    bank: 'pato', bankScale: 142, bankScales: { cochito: 92, pato: 142, custom: 85 },
    bankPosition: { x: 50, y: 50 }, entryPoint: { x: 50, y: 16 }
  });
  const placement = ui.box.children.find(node => node.className === 'bank-editor-placement');
  assert.equal(Number(placement.children.at(-1).children[1].value), 142);
  assert.equal(placement.children[0].hidden, true);
  ui.window.dispatchEvent({ type: 'point-drop-bank-hydrated', detail: {
    bank: 'cochito', bankScale: 92, bankScales: { cochito: 92, pato: 142, custom: 85 },
    bankPosition: { x: 50, y: 50 }, entryPoint: { x: 50, y: 16 }
  } });
  assert.equal(Number(placement.children.at(-1).children[1].value), 92);
});

test('bank editor cleans up drag state when closed and on preview reload', () => {
  assert.match(editor, /function close\(\)/);
  assert.match(editor, /onpointercancel/);
  assert.match(editor, /addEventListener\(['"]load['"],\s*close\)/);
  assert.match(editor, /change['"],\s*close\)/);
});

class Style {
  constructor(initial = {}) { this.values = { ...initial }; }
  setProperty(key, value) { this.values[key] = String(value); }
  removeProperty(key) { delete this.values[key]; }
  getPropertyValue(key) { return this.values[key] || ''; }
}
class Node {
  constructor(tag = 'div') { this.tagName = tag; this.children = []; this.dataset = {}; this.style = new Style(); this.attributes = {}; this.listeners = {}; this.parentElement = null; this.ownerDocument = null; this.value = ''; this.hidden = false; }
  append(...nodes) { for (const node of nodes) { node.parentElement = this; node.ownerDocument = this.ownerDocument; this.children.push(node); } }
  replaceChildren(...nodes) { for (const child of this.children) if (child.ownerDocument?.activeElement === child) child.ownerDocument.activeElement = null; this.children = []; this.append(...nodes); }
  remove() { if (this.ownerDocument?.activeElement === this) this.ownerDocument.activeElement = null; if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(node => node !== this); }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  addEventListener(key, callback) { this.listeners[key] = callback; }
  querySelector(selector) { if (selector === '.piggy-slot') return this.slot || null; if (selector === '.piggy-custom-image') return this.image || null; return null; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 100 }; }
  setPointerCapture(id) { this.captured = id; }
  hasPointerCapture(id) { return this.captured === id; }
  releasePointerCapture() { this.captured = null; }
  focus() { this.focused = true; if (this.ownerDocument) this.ownerDocument.activeElement = this; this.onfocus?.(); }
}
const shape = { points: [[10,10],[30,10],[70,10],[90,30],[90,70],[10,70]], slot: [46,40] };
function functionSource(source, name) {
  const asyncStart = source.indexOf(`async function ${name}(`), start = asyncStart >= 0 ? asyncStart : source.indexOf(`function ${name}(`); assert.ok(start >= 0, `${name} exists`);
  let open = source.indexOf('{', start), depth = 0, quote = '', escaped = false;
  for (let i = open; i < source.length; i++) {
    const char = source[i];
    if (quote) { if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === quote) quote = ''; continue; }
    if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
    if (char === '{') depth++;
    if (char === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`Unclosed function ${name}`);
}
function findButton(node, text) { for (const child of node.children) { if (child.tagName === 'button' && child.textContent === text) return child; const nested = findButton(child, text); if (nested) return nested; } return null; }
async function makeEditor(bank, initialDrop = {}, openEditor = true, initialHydration = null) {
  const panel = new Node(), pig = new Node('div'), slot = new Node('span'), image = new Node('img'), stage = new Node();
  pig.dataset.bank = bank; pig.parentElement = stage; pig.slot = slot; pig.image = image;
  pig.style = new Style({ left: '22%', top: '18%', bottom: '22px', transform: 'translateX(-50%)' });
  slot.style = new Style({ left: '46%', top: '40%' });
  const listeners = {}, frame = new Node('iframe');
  frame.contentDocument = { activeElement: null, querySelector: () => pig };
  pig.ownerDocument = frame.contentDocument;
  frame.contentWindow = { PiggyBank: { shapeFor: key => structuredClone(initialDrop.shapes?.[key] || shape), prepare(_piggy, key, data) { pig.dataset.bank = key; if(data?.custom_bank_asset)pig.image.src=data.custom_bank_asset; } }, postMessage() {} };
  const selector = new Node('select'); selector.addEventListener = (key, fn) => { selector.listeners[key] = fn; };
  const document = { querySelector: () => panel, createElement: tag => new Node(tag), createElementNS: (_ns, tag) => new Node(tag), getElementById: id => id === 'overlay-preview' ? frame : selector };
  let stored = { bank, custom_bank_asset: `${'a'.repeat(32)}.png`, bank_position: { x: 50, y: 50 }, bank_scale: 100, entry_point: { x: 46, y: 40 }, ...initialDrop };
  const requests = [];
  const fetch = async (url, options = {}) => {
    if (!options.method) return { ok: true, json: async () => ({ drop: { ...stored } }) };
    const body = JSON.parse(options.body); requests.push(body);
    if (body.action === 'configure' || (body.action === 'shape' && body.custom_bank_asset)) stored = { ...stored, ...body };
    return { ok: true, json: async () => ({ drop: { ...stored } }) };
  };
  const prepared = [];
  const models = Object.fromEntries(['cochito','cochita','pato','oso','perro','gato','custom'].map(key => [key, { label: key }]));
  const window = { PiggyBank: { models, prepare(...args) { prepared.push(args); pig.dataset.bank = args[1]; } }, addEventListener: (name, fn) => { listeners[name] = fn; }, dispatchEvent: event => listeners[event.type]?.(event) };
  if (initialHydration) window.__pointDropBankHydration = initialHydration;
  const context = vm.createContext({ document, window, fetch, location: { origin: 'http://localhost' }, structuredClone, CustomEvent: class { constructor(type, init) { this.type = type; Object.assign(this, init); } }, console });
  vm.runInContext(editor, context);
  const box = panel.children[0], open = findButton(box, 'Editar alcancía');
  if (openEditor) await open.onclick();
  return { box, pig, slot, image, requests, context, window, fetch, stored: () => stored, prepared, open, listeners };
}

test('bank editor actions are grouped, concise, and retain working handlers', async () => {
  const ui = await makeEditor('cochita');
  const actions = ui.box.children.find(node => node.className === 'bank-editor-actions');
  assert.ok(actions, 'editor actions have a dedicated container');
  assert.equal(actions.attributes.role, 'group');
  assert.equal(actions.attributes['aria-label'], 'Acciones del editor de alcancía');
  assert.deepEqual(actions.children.map(button => button.textContent), [
    'Editar alcancía', 'Añadir punto', 'Quitar punto', 'Guardar cavidad', 'Guardar cambios', 'Restaurar contorno', 'Cancelar',
  ]);
  assert.ok(actions.children.every(button => typeof button.onclick === 'function'));
  const svg = ui.pig.children.at(-1), pointsBefore = svg.children.length;
  await findButton(actions, 'Añadir punto').onclick();
  assert.equal(svg.children.length, pointsBefore + 1, 'the concise Add point button still runs its editor action');
});

test('initial server hydration updates editor controls before Edit is pressed', async () => {
  const ui = await makeEditor('pato', {}, false),context=ui.context;
  const response = { timer: {}, wheel: {}, drop: { bank: 'custom', custom_bank_asset: `${'1a2e'.repeat(8)}.png`, bank_position: { x: 36, y: 63 }, bank_scale: 86, entry_point: { x: 51, y: 16.5 }, shapes: { custom: { slot: [51, 16.5] } } } };
  Object.assign(context, { bankState: { custom_bank_asset: null, bank_position: { x: 50, y: 50 }, bank_scale: 100, entry_point: { x: 50, y: 16 } }, bankStateRevision: 0, bankSelect: { value: 'pato' }, piggy: ui.pig, window: ui.window });
  for (const name of ['hydrateBankState', 'publishBankHydration', 'applyInitialBankState']) vm.runInContext(functionSource(games, name), context);
  context.applyInitialBankState(response);
  const placement = ui.box.children.find(node => node.className === 'bank-editor-placement');
  assert.equal(placement.hidden, false);
  assert.deepEqual(placement.children.map(node => Number(node.children[1].value)), [36, 63, 86]);
  assert.equal(ui.pig.dataset.bank, 'custom');
});

test('server hydration never overwrites an active unsaved editor draft', async () => {
  const ui = await makeEditor('custom');
  const placement = ui.box.children.find(node => node.className === 'bank-editor-placement');
  const bankX = placement.children[0].children[1];
  assert.equal(typeof ui.listeners['point-drop-bank-hydrated'], 'function');
  bankX.value = 24; bankX.oninput();
  ui.window.dispatchEvent({ type: 'point-drop-bank-hydrated', detail: { bank: 'custom', customBankAsset: `${'b'.repeat(32)}.png`, bankPosition: { x: 35, y: 62 }, bankScale: 85, entryPoint: { x: 51, y: 16.5 } } });
  assert.equal(Number(bankX.value), 24);
  assert.equal(ui.pig.style.getPropertyValue('left'), '24%');
});

test('editor adopts the latest parent hydration when its script loads afterward', async () => {
  const ui = await makeEditor('pato', {}, false, { bank: 'custom', customBankAsset: `${'1a2e'.repeat(8)}.png`, bankPosition: { x: 36, y: 63 }, bankScale: 86, entryPoint: { x: 51, y: 16.5 } });
  const placement = ui.box.children.find(node => node.className === 'bank-editor-placement');
  assert.equal(placement.hidden, false);
  assert.deepEqual(placement.children.map(node => Number(node.children[1].value)), [36, 63, 86]);
});

test('real editor hydrates controls from the nested server response after reload', async () => {
  const ui = await makeEditor('pato', { bank: 'custom', custom_bank_asset: `${'1a2e'.repeat(8)}.png`, bank_position: { x: 36, y: 63 }, bank_scale: 86, entry_point: { x: 51, y: 16.5 }, shapes: { custom: { slot: [51, 16.5] } } });
  const placement = ui.box.children.find(node => node.className === 'bank-editor-placement');
  assert.deepEqual(placement.children.map(node => Number(node.children[1].value)), [36, 63, 86]);
  assert.equal(ui.pig.dataset.bank, 'custom');
  assert.equal(ui.pig.style.getPropertyValue('left'), '36%');
  assert.equal(ui.pig.style.getPropertyValue('top'), '63%');
  assert.equal(ui.pig.style.getPropertyValue('transform'), 'translate(-50%, -50%) scale(0.86)');
  assert.equal(ui.slot.style.getPropertyValue('left'), '51%');
  assert.equal(ui.slot.style.getPropertyValue('top'), '16.5%');
  assert.equal(ui.image.src, `${'1a2e'.repeat(8)}.png`);
});

test('initial load normalizes the actual nested server response into shared editor state', () => {
  assert.match(games, /function hydrateBankState\(data\)/);
  assert.equal((games.match(/bankState=hydrateBankState\(data\)/g)||[]).length, 2, 'initial load and periodic sync use the normalizer');
  const source = fs.readFileSync('web/static/live_games.js', 'utf8');
  const context = vm.createContext({
    bankState: { custom_bank_asset: null, bank_position: { x: 50, y: 50 }, bank_scale: 100, entry_point: { x: 50, y: 16 } },
    bankStateRevision: 0, bankSelect: { value: 'pato' }, piggy: {},
     window: { PiggyBank: { models: Object.fromEntries(['cochito','cochita','pato','oso','perro','gato','custom'].map(key => [key, {}])), prepare(piggy, bank, data) { this.last = { piggy, bank, data }; } }, dispatchEvent() {} },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } }
  });
  vm.runInContext(functionSource(source, 'hydrateBankState'), context);
  vm.runInContext(functionSource(source, 'publishBankHydration'), context);
  vm.runInContext(functionSource(source, 'applyInitialBankState'), context);
  const response = { timer: {}, wheel: {}, drop: { bank: 'custom', custom_bank_asset: `${'1a2e'.repeat(8)}.png`, bank_position: { x: 36, y: 63 }, bank_scale: 86, entry_point: { x: 51, y: 16.5 }, shapes: { custom: { slot: [51, 16.5] } } } };
  context.applyInitialBankState(response);
  assert.deepEqual(JSON.parse(JSON.stringify(context.bankState)), { custom_bank_asset: `${'1a2e'.repeat(8)}.png`, bank_position: { x: 36, y: 63 }, bank_scale: 86, bank_scales: { cochito: 100, cochita: 100, pato: 100, oso: 100, perro: 100, gato: 100, custom: 86 }, entry_point: { x: 51, y: 16.5 } });
  assert.equal(context.bankSelect.value, 'custom');
  assert.equal(context.window.PiggyBank.last.data.custom_bank_asset, `${'1a2e'.repeat(8)}.png`);
});

test('real periodic sync hydrates placement, entry point, and asset from nested GET data', async () => {
  const bankSelect = { value: 'pato' }, piggy = new Node(), score = { textContent: '' }, configNote = { textContent: '' };
  const response = { timer: {}, wheel: { serial: 0 }, drop: { bank: 'custom', custom_bank_asset: `${'1a2e'.repeat(8)}.png`, bank_position: { x: 36, y: 63 }, bank_scale: 86, entry_point: { x: 51, y: 16.5 }, shapes: { custom: { slot: [51, 16.5] } }, score: 12, size: 64, events: [] } };
  const context = vm.createContext({
    document: { hidden: false, activeElement: null }, wheel: { hidden: false }, drop: { hidden: false }, gamesBusy: false,
    overlayCall: async () => response,
    window: { PiggyBank: { models: Object.fromEntries(['cochito','cochita','pato','oso','perro','gato','custom'].map(key => [key, {}])), setShapes() {}, prepare(_pig, bank, data) { this.last = { bank, data }; }, setSize() {} }, dispatchEvent(event) { this.lastHydration = event; } },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } },
    spinning: false, wheelSerial: 0, bankSelect, piggy, dropActionBusy: false, bankStateRevision: 0,
    bankState: { custom_bank_asset: null, bank_position: { x: 50, y: 50 }, bank_scale: 100, entry_point: { x: 50, y: 16 } },
    total: 0, score, sizePending: false, sizeSending: false, dropSize: { value: 64 }, arena: { querySelectorAll() { return []; } },
    settledCoins: 0, showDeposit() {}, configNote, wheelResult: { textContent: '' }, wheelDisc: { style: {} }, wheelHistory: { prepend() {}, children: [], lastChild: null },
    hydrateBankState: functionSource(games, 'hydrateBankState')
  });
  vm.runInContext(context.hydrateBankState, context);
  vm.runInContext(functionSource(games, 'publishBankHydration'), context);
  await vm.runInContext(`${functionSource(games, 'syncGames')}; syncGames()`, context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.bankState)), { custom_bank_asset: `${'1a2e'.repeat(8)}.png`, bank_position: { x: 36, y: 63 }, bank_scale: 86, bank_scales: { cochito: 100, cochita: 100, pato: 100, oso: 100, perro: 100, gato: 100, custom: 86 }, entry_point: { x: 51, y: 16.5 } });
  assert.equal(bankSelect.value, 'custom');
  assert.deepEqual(JSON.parse(JSON.stringify(context.window.PiggyBank.last.data.bank_position)), { x: 36, y: 63 });
  assert.deepEqual(JSON.parse(JSON.stringify(context.window.lastHydration.detail)), { bank: 'custom', customBankAsset: `${'1a2e'.repeat(8)}.png`, bankPosition: { x: 36, y: 63 }, bankScale: 86, bankScales: { cochito: 100, cochita: 100, pato: 100, oso: 100, perro: 100, gato: 100, custom: 86 }, entryPoint: { x: 51, y: 16.5 } });
  assert.equal(context.total, 12);
});

test('real editor keeps built-in transform intact through open and cancel', async () => {
  const ui = await makeEditor('pato', {}, false);
  const before = [ui.pig.style.getPropertyValue('left'), ui.pig.style.getPropertyValue('top'), ui.pig.style.getPropertyValue('transform'), ui.slot.style.getPropertyValue('left'), ui.slot.style.getPropertyValue('top')];
  await findButton(ui.box, 'Editar alcancía').onclick();
  const controls = ui.box.children.find(node => node.className === 'bank-editor-placement');
  assert.equal(controls.hidden, false);
  assert.equal(controls.children[0].hidden, true);
  assert.equal(controls.children.at(-1).hidden, false);
  await findButton(ui.box, 'Cancelar').onclick();
  assert.deepEqual([ui.pig.style.getPropertyValue('left'), ui.pig.style.getPropertyValue('top'), ui.pig.style.getPropertyValue('transform'), ui.slot.style.getPropertyValue('left'), ui.slot.style.getPropertyValue('top')], before);
});

test('integrated bank entry point updates immediately and focused handles expose selection', async () => {
  const ui = await makeEditor('pato', { entry_point: { x: 46, y: 40 } });
  const svg = ui.pig.children.find(node => node.tagName === 'svg');
  const entry = svg.children.at(-1);
  entry.onpointerdown({ pointerId: 4 });
  entry.onpointermove({ pointerId: 4, clientX: 62, clientY: 32 });
  assert.equal(ui.slot.style.getPropertyValue('left'), '62%');
  assert.equal(ui.slot.style.getPropertyValue('top'), '32%');
  const outlineHandle = svg.children[1];
  outlineHandle.focus();
  assert.equal(outlineHandle.attributes['aria-pressed'], 'true');
  assert.equal(outlineHandle.attributes['stroke-width'], '2');
  assert.equal(outlineHandle.attributes.filter, 'drop-shadow(0 0 4px #fff)');
  assert.equal(entry.attributes['aria-pressed'], 'false');
  await findButton(ui.box, 'Cancelar').onclick();
  assert.equal(ui.slot.style.getPropertyValue('left'), '46%');
  assert.equal(ui.slot.style.getPropertyValue('top'), '40%');
});

test('integrated bank reopens its persisted shape slot instead of stale custom entry settings', async () => {
  const ui = await makeEditor('pato', {
    entry_point: { x: 50, y: 16 },
    shapes: { pato: { points: structuredClone(shape.points), slot: [62, 32] } }
  });
  const entry = ui.pig.children.find(node => node.tagName === 'svg').children.at(-1);
  assert.equal(entry.attributes.cx, '62');
  assert.equal(entry.attributes.cy, '32');
  assert.equal(ui.slot.style.getPropertyValue('left'), '62%');
  assert.equal(ui.slot.style.getPropertyValue('top'), '32%');
});

test('pointer selection restores handle focus so keyboard editing continues after redraw', async () => {
  const ui = await makeEditor('pato');
  let svg = ui.pig.children.find(node => node.tagName === 'svg');
  const point = svg.children[1];
  point.onpointerdown({ pointerId: 5 });
  point.focus();
  point.onpointerup();
  svg = ui.pig.children.find(node => node.tagName === 'svg');
  let focused = svg.ownerDocument.activeElement;
  assert.equal(focused, svg.children[1]);
  focused.onkeydown({ key: 'ArrowRight', shiftKey: false, preventDefault() {} });
  svg = ui.pig.children.find(node => node.tagName === 'svg');
  focused = svg.ownerDocument.activeElement;
  assert.equal(focused, svg.children[1]);
  assert.equal(focused.attributes.cx, '10.25');
});

test('real editor cancel restores custom preview, and save synchronizes immediate configure state', async () => {
  const ui = await makeEditor('custom');
  const placement = ui.box.children.find(node => node.className === 'bank-editor-placement');
  for (const [index, value] of [[0,24],[1,76],[2,125]]) { const input = placement.children[index].children[1]; input.value = value; input.oninput(); }
  assert.equal(ui.pig.style.getPropertyValue('left'), '24%');
  ui.image.onpointerdown({ pointerId: 7, preventDefault() {} });
  await findButton(ui.box, 'Cancelar').onclick();
  assert.equal(ui.pig.style.getPropertyValue('left'), '22%');
  assert.equal(ui.slot.style.getPropertyValue('left'), '46%');
  assert.equal(ui.image.captured, null);

  await findButton(ui.box, 'Editar alcancía').onclick();
  for (const [index, value] of [[0,24],[1,76],[2,125]]) { const input = placement.children[index].children[1]; input.value = value; input.oninput(); }
  const bankSelect = { value: 'custom' };
  Object.assign(ui.context, { bankState: { custom_bank_asset: null, bank_position: { x: 50, y: 50 }, bank_scale: 100, entry_point: { x: 50, y: 16 } }, bankStateRevision: 0, bankSelect, piggy: new Node() });
  const stateHandler = functionSource(fs.readFileSync('web/static/live_games.js', 'utf8'), 'acceptBankEditorState');
  vm.runInContext(stateHandler, ui.context);
  ui.window.addEventListener('point-drop-bank-state', event => ui.context.acceptBankEditorState(event.detail));
  await findButton(ui.box, 'Guardar cambios').onclick();
  const dropTitle = { value: 'Test' }, dropSpeed = { value: 4 }, dropSize = { value: 64 }, dropDensity = { value: 8 }, dropShow = { checked: true };
  let configurePayload;
  ui.context.overlayCall = async payload => { configurePayload = payload; return { drop: { ...payload, density: payload.density } }; };
  Object.assign(ui.context, { dropTitle, dropSpeed, dropSize, dropDensity, dropShow });
  const liveGames = fs.readFileSync('web/static/live_games.js', 'utf8');
  vm.runInContext(functionSource(liveGames, 'hydrateBankState'), ui.context);
  vm.runInContext(functionSource(liveGames, 'publishBankHydration'), ui.context);
  vm.runInContext(functionSource(liveGames, 'saveDrop'), ui.context);
  await ui.context.saveDrop();
  assert.deepEqual(configurePayload.bank_position, { x: 24, y: 76 });
  assert.equal(configurePayload.bank_scale, 125);
});

test('real syncGames ignores stale bank settings after a local editor save but keeps score updates', async () => {
  let release;
  const staleResponse = new Promise(resolve => { release = resolve; });
  const bankSelect = { value: 'custom' }, piggy = new Node(), score = { textContent: '' }, configNote = { textContent: '' };
  const context = vm.createContext({
    document: { hidden: false, activeElement: null }, wheel: { hidden: false }, drop: { hidden: false }, gamesBusy: false,
    overlayCall: () => staleResponse,
    window: { PiggyBank: { setShapes() {}, prepare(_pig, _bank, d) { this.last = d; }, setSize() {} } },
    spinning: false, wheelSerial: 0, bankSelect, piggy, dropActionBusy: false, bankStateRevision: 0,
    bankState: { custom_bank_asset: `${'a'.repeat(32)}.png`, bank_position: { x: 50, y: 50 }, bank_scale: 100, entry_point: { x: 50, y: 16 } },
    total: 0, score, sizePending: false, sizeSending: false, dropSize: { value: 64 }, arena: { querySelectorAll() { return []; } },
    settledCoins: 0, showDeposit() {}, configNote, wheelResult: { textContent: '' }, wheelDisc: { style: {} }, wheelHistory: { prepend() {}, children: [], lastChild: null },
    animateWheel: async () => {}, el: () => new Node(), spin: { disabled: false }
  });
  vm.runInContext(functionSource(fs.readFileSync('web/static/live_games.js', 'utf8'), 'acceptBankEditorState'), context);
  vm.runInContext(functionSource(fs.readFileSync('web/static/live_games.js', 'utf8'), 'syncGames'), context);
  const running = context.syncGames();
  context.acceptBankEditorState({ custom_bank_asset: `${'b'.repeat(32)}.png`, bank_position: { x: 24, y: 76 }, bank_scale: 125, entry_point: { x: 43, y: 18 } });
  release({ wheel: { serial: 0 }, drop: { shapes: [], bank: 'custom', custom_bank_asset: `${'a'.repeat(32)}.png`, bank_position: { x: 50, y: 50 }, bank_scale: 100, entry_point: { x: 50, y: 16 }, score: 9, size: 64, events: [] } });
  await running;
  assert.deepEqual(JSON.parse(JSON.stringify(context.bankState.bank_position)), { x: 24, y: 76 });
  assert.equal(context.bankState.custom_bank_asset, `${'b'.repeat(32)}.png`);
  assert.equal(context.bankState.bank_scale, 125);
  assert.equal(context.total, 9);
  assert.equal(score.textContent, 9);
});

test('real cavity save carries the persisted custom asset and transform for composable writes', async () => {
  const ui = await makeEditor('custom');
  const placement = ui.box.children.find(node => node.className === 'bank-editor-placement');
  for (const [index, value] of [[0,35],[1,62],[2,85]]) { const input = placement.children[index].children[1]; input.value = value; input.oninput(); }
  await findButton(ui.box, 'Guardar cambios').onclick();
  await findButton(ui.box, 'Guardar cavidad').onclick();
  const cavityRequest = ui.requests.at(-1);
  assert.equal(cavityRequest.action, 'shape', JSON.stringify(ui.requests));
  assert.equal(cavityRequest.custom_bank_asset, `${'a'.repeat(32)}.png`);
  assert.deepEqual(cavityRequest.bank_position, { x: 35, y: 62 });
  assert.equal(cavityRequest.bank_scale, 85);
  assert.deepEqual(cavityRequest.entry_point, { x: 46, y: 40 });
});

test('real cavity save synchronizes state before the immediate live configure request', async () => {
  const ui = await makeEditor('custom');
  const placement = ui.box.children.find(node => node.className === 'bank-editor-placement');
  for (const [index, value] of [[0,35],[1,62],[2,85]]) { const input = placement.children[index].children[1]; input.value = value; input.oninput(); }
  const bankSelect = { value: 'custom' }, piggy = new Node();
  Object.assign(ui.context, { bankState: { custom_bank_asset: null, bank_position: { x: 50, y: 50 }, bank_scale: 100, entry_point: { x: 50, y: 16 } }, bankStateRevision: 0, bankSelect, piggy });
  vm.runInContext(functionSource(fs.readFileSync('web/static/live_games.js', 'utf8'), 'acceptBankEditorState'), ui.context);
  ui.window.addEventListener('point-drop-bank-state', event => ui.context.acceptBankEditorState(event.detail));
  await findButton(ui.box, 'Guardar cavidad').onclick();
  let configurePayload;
  Object.assign(ui.context, {
    dropTitle: { value: 'Test' }, dropSpeed: { value: 4 }, dropSize: { value: 64 }, dropDensity: { value: 8 }, dropShow: { checked: true },
    overlayCall: async payload => { configurePayload = payload; return { drop: { ...ui.stored(), density: payload.density } }; }
  });
  vm.runInContext(functionSource(fs.readFileSync('web/static/live_games.js', 'utf8'), 'hydrateBankState'), ui.context);
  vm.runInContext(functionSource(fs.readFileSync('web/static/live_games.js', 'utf8'), 'publishBankHydration'), ui.context);
  vm.runInContext(functionSource(fs.readFileSync('web/static/live_games.js', 'utf8'), 'saveDrop'), ui.context);
  await ui.context.saveDrop();
  assert.equal(configurePayload.custom_bank_asset, `${'a'.repeat(32)}.png`);
  assert.deepEqual(JSON.parse(JSON.stringify(configurePayload.bank_position)), { x: 35, y: 62 });
  assert.equal(configurePayload.bank_scale, 85);
  assert.deepEqual(JSON.parse(JSON.stringify(configurePayload.entry_point)), { x: 46, y: 40 });
});

function makeDropSaveContext(overlayCall, onHydration = () => {}) {
  const published = [];
  const models = Object.fromEntries(['cochito','cochita','pato','oso','perro','gato','custom'].map(key => [key, {}]));
  const context = vm.createContext({
    bankSelect: { value: 'cochita' }, bankStateRevision: 0,
    bankState: { custom_bank_asset: null, bank_position: { x: 50, y: 50 }, bank_scale: 200,
      bank_scales: { cochito: 100, cochita: 200, pato: 100, oso: 100, perro: 100, gato: 100, custom: 100 }, entry_point: { x: 50, y: 16 } },
    dropTitle: { value: 'Test' }, dropSpeed: { value: 4 }, dropSize: { value: 64 }, dropDensity: { value: 8 }, dropShow: { checked: true },
    window: { PiggyBank: { models }, dispatchEvent(event) { published.push(event.detail); onHydration(event.detail); } },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } },
    overlayCall,
  });
  for (const name of ['hydrateBankState', 'publishBankHydration', 'saveDrop']) {
    vm.runInContext(functionSource(games, name), context);
  }
  return { context, published };
}

test('accepted bank saves publish each per-model scale immediately to editor hydration', async () => {
  const ui = await makeEditor('cochita', {}, false);
  const { context, published } = makeDropSaveContext(
    async payload => ({ drop: { ...payload, density: payload.density } }),
    detail => ui.window.dispatchEvent({ type: 'point-drop-bank-hydrated', detail })
  );
  const placement = ui.box.children.find(node => node.className === 'bank-editor-placement');
  for (const [bank, scale] of [['cochita', 200], ['pato', 100], ['cochita', 200]]) {
    context.bankSelect.value = bank;
    context.bankState.bank_scale = context.bankState.bank_scales[bank] = scale;
    await context.saveDrop();
    assert.equal(published.at(-1).bank, bank);
    assert.equal(published.at(-1).bankScale, scale);
    assert.equal(Number(placement.children[2].children[1].value), scale);
  }
  assert.deepEqual(published.map(state => [state.bank, state.bankScale]), [['cochita',200],['pato',100],['cochita',200]]);
  assert.equal(context.bankStateRevision, 3, 'publishing hydration does not add an extra revision');
});

test('stale bank-save responses do not publish hydration to the editor', async () => {
  let resolveSave;
  const { context, published } = makeDropSaveContext(() => new Promise(resolve => { resolveSave = resolve; }));
  context.bankSelect.value = 'pato';
  const pending = context.saveDrop();
  context.bankStateRevision++;
  resolveSave({ drop: { bank: 'pato', bank_scale: 100, bank_scales: { pato: 100 }, bank_position: { x: 50, y: 50 }, entry_point: { x: 50, y: 16 }, density: 8 } });
  await pending;
  assert.deepEqual(published, []);
});
