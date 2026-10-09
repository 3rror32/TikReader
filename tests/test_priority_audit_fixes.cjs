const fs = require('node:fs');
const test = require('node:test');
const assert = require('node:assert/strict');

const qa = fs.readFileSync('tools/qa_overlay_studio.cjs', 'utf8');
const studio = fs.readFileSync('web/static/studio.js', 'utf8');
const quality = fs.readFileSync('.github/workflows/quality.yml', 'utf8');
const watcher = fs.readFileSync('tools/check_changes.py', 'utf8');
const chatbot = fs.readFileSync('app/chatbot.py', 'utf8');
const gameHotkeys = fs.readFileSync('app/game_hotkeys.py', 'utf8');
const minecraft = fs.readFileSync('app/minecraft_connector.py', 'utf8');

test('quality automation uploads runtime coverage and fails when the report is absent', () => {
  assert.match(quality, /path:\s*runtime\/\.coverage/);
  assert.match(quality, /if-no-files-found:\s*error/);
});

test('watch snapshots include nested frontend TypeScript sources', () => {
  assert.match(watcher, /frontend\/\*\*\/\*\.ts/);
});

test('background service failures retain local tracebacks and safe operator messages', () => {
  assert.match(chatbot, /logger\.exception\(['"]Chatbot background send failed['"]\)/);
  assert.match(chatbot, /self\.note\(['"]Envío sin confirmar\./);
  assert.match(gameHotkeys, /logger\.exception\(['"]Game hotkey/);
  assert.match(gameHotkeys, /self\.note\(['"]Error de ejecución: /);
  assert.match(minecraft, /logger\.exception\(['"]Minecraft RCON execution failed/);
  assert.match(minecraft, /self\.note\(f'Minecraft no confirmó/);
});

test('overlay QA loads the shipped widget template and Vite bundle', () => {
  assert.match(qa, /widgetTemplatePath\s*=\s*path\.join\(root, 'web', 'templates', 'widget\.html'\)/);
  assert.match(qa, /studioBundlePath\s*=\s*path\.join\(root, 'web', 'static', 'build', 'studio\.js'\)/);
  assert.match(qa, /requests\.includes\('\/static\/build\/studio\.js'\)/);
  const compatibility = qa.indexOf('Compatibility-only fixture');
  assert.ok(compatibility >= 0 && compatibility < qa.indexOf('/static/overlay_studio.js'));
  assert.match(qa, /compatibility-effects/);
});

test('studio tabs expose linked selected state and support keyboard navigation', () => {
  const match = studio.match(/function configureStudioNavigation\(root = document,[\s\S]*?\n  \}/);
  assert.ok(match, 'studio navigation initializer should be present');
  const configure = new Function(`${match[0]}; return configureStudioNavigation;`)();
  const buttons = ['gifts', 'ranking', 'tools'].map((tab, index) => makeButton(tab, index === 0));
  const panes = ['gifts', 'ranking', 'tools'].map((tab, index) => makePane(tab, index !== 0));
  const handlers = {};
  const nav = {
    attributes: {},
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(name, fn) { handlers[name] = fn; }
  };
  const root = {
    querySelector(selector) { return selector === '.studio-tabs' ? nav : null; },
    querySelectorAll(selector) { return selector === '[data-tab]' ? buttons : panes; }
  };
  const selected = [];

  configure(root, value => selected.push(value));
  assert.equal(nav.attributes.role, 'tablist');
  assert.equal(buttons[0].attributes['aria-selected'], 'true');
  assert.equal(buttons[0].tabIndex, 0);
  assert.equal(panes[0].attributes.role, 'tabpanel');
  assert.equal(buttons[0].attributes['aria-controls'], panes[0].id);
  assert.equal(panes[0].attributes['aria-labelledby'], buttons[0].id);

  buttons[1].handlers.click();
  assert.equal(buttons[1].attributes['aria-selected'], 'true');
  assert.equal(panes[1].hidden, false);
  buttons[0].handlers.click();
  assert.deepEqual(selected, ['ranking', 'gifts']);
  handlers.keydown({ key: 'ArrowRight', target: buttons[0], preventDefault() {} });
  assert.equal(buttons[1].attributes['aria-selected'], 'true');
  assert.equal(panes[1].hidden, false);
  assert.equal(buttons[1].focused, true);
  handlers.keydown({ key: 'End', target: buttons[1], preventDefault() {} });
  assert.equal(buttons[2].attributes['aria-selected'], 'true');
  handlers.keydown({ key: 'ArrowLeft', target: buttons[2], preventDefault() {} });
  assert.equal(buttons[1].attributes['aria-selected'], 'true');
  handlers.keydown({ key: 'Home', target: buttons[2], preventDefault() {} });
  assert.equal(buttons[0].attributes['aria-selected'], 'true');
});

function makeButton(tab, active) {
  const button = {
    dataset: { tab }, className: active ? 'active' : '', active,
    attributes: {}, handlers: {}, tabIndex: -1, id: '',
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(name, fn) { this.handlers[name] = fn; },
    focus() { this.focused = true; }
  };
  button.classList = {
    contains(name) { return name === 'active' && button.active; },
    toggle(name, value) { if (name === 'active') button.active = value; }
  };
  return button;
}

function makePane(tab, hidden) {
  return {
    dataset: { pane: tab }, hidden, attributes: {}, id: '',
    setAttribute(name, value) { this.attributes[name] = value; }
  };
}
