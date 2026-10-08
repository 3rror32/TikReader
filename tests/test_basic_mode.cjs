const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('basic mode exposes one short daily workflow', () => {
  const sidebar = read('web/static/sidebar.js');
  const match = sidebar.match(/const basicDestinations = new Set\(\[([^\]]+)\]\)/);
  assert.ok(match, 'basic destinations must be explicit');
  const destinations = [...match[1].matchAll(/'([^']+)'/g)].map(item => item[1]);
  assert.deepEqual(destinations, [
    'live', 'voice', 'microphone-captions',
    'overlay-gallery', 'overlay-animations', 'overlay-effects', 'overlay-tools',
    'overlay-goals', 'overlay-favorites', 'overlay-custom', 'overlay-my-animations',
    'alerts', 'about', 'workspace',
  ]);
});

test('sessions is advanced, about is always last, and configuration is the only fixed action', () => {
  const shell = read('web/static/shell.js');
  const sidebar = read('web/static/sidebar.js');
  assert.match(shell, /const trailingItems=\[\["Sesiones","history"\],\["Acerca de","about"\]\]/);
  assert.match(shell, /const utilityItems=\[\["Configuración","workspace"\]\]/);
  assert.doesNotMatch(sidebar.match(/const basicDestinations = new Set\(\[([^\]]+)\]\)/)[1], /'history'/);
  assert.match(sidebar, /'about'/);
});

test('basic mode stays focused and advanced voice controls remain optional', () => {
  const template = read('web/templates/index.html');
  const voice = read('web/static/voice_layout.js');
  assert.doesNotMatch(template, /basic-launchpad|>Preparación</);
  assert.doesNotMatch(template, /static\/basic_mode\.js/);
  assert.match(voice, /optional\.dataset\.basicAdvanced/);
  assert.match(voice, /audio\.dataset\.basicAdvanced/);
});

test('operator interface has no remote font dependency', () => {
  const template = read('web/templates/index.html');
  assert.doesNotMatch(template, /fonts\.(?:googleapis|gstatic)\.com/);
  assert.match(read('web/static/basic_mode.css'), /Segoe UI Variable/);
  assert.match(read('web/static/basic_mode.css'), /Cascadia Mono/);
});

test('menu uses one direct section and keeps safety only in the top bar', () => {
  const sidebar = read('web/static/sidebar.js');
  const shell = read('web/static/shell.js');
  assert.doesNotMatch(sidebar, /critical\.className = 'sidebar-critical'|AL AIRE/);
  assert.match(shell, /"Directo"/);
  assert.doesNotMatch(sidebar, /sidebarEmergency|sidebar-emergency/);
  assert.match(shell, /panic\.id='emergency-button'/);
  assert.match(shell, /scrollIntoView\(\{block:'nearest'/);
  assert.match(shell, /tikreader:navigation-change/);
});

test('menu avoids shortcut cards and keeps useful collapsed tooltips', () => {
  const sidebar = read('web/static/sidebar.js');
  const styles = read('web/static/sidebar.css');
  assert.doesNotMatch(sidebar, /tikreader\.navigationRecent|sidebar-shortcuts|sidebar-shortcut/);
  assert.match(sidebar, /sidebar-tooltip/);
  assert.doesNotMatch(styles, /\.sidebar-shortcuts|\.sidebar-shortcut/);
  assert.match(styles, /\.sidebar-tooltip/);
});

test('session omits the empty-data context while preserving connection and metric status', () => {
  const styles = read('web/static/live_refinement.css');
  const presence = read('web/static/live_presence.js');
  assert.doesNotMatch(styles, /session-data-context/);
  assert.doesNotMatch(presence, /session-data-context|Sin datos todavía|dataContext|syncDataContext/);
  assert.doesNotMatch(read('web/templates/index.html'), /session-data-context/);
  assert.match(presence, /document\.body\.dataset\.liveState = mode/);
  assert.match(presence, /syncLiveLight\(mode === 'live'\)/);
  assert.match(presence, /card\.dataset\.valueState = state/);
});

test('chat voice exposes Homero as a direct local AI selection', () => {
  const template = read('web/templates/index.html');
  const voice = read('web/static/custom_voice.js');
  assert.match(template, /id="voice-ai-quick-select"/);
  assert.match(template, /Homero usa el modelo local y la GPU/);
  assert.match(voice, /homeroModel='homero_simpson_la'/);
  assert.match(voice, /Homero · lectura por IA/);
  assert.match(voice, /tikreader\.rvcResourceConsent','true'/);
});

test('project support stays available in both the Live header and About', () => {
  const styles = read('web/static/basic_mode.css');
  const presence = read('web/static/live_presence.js');
  assert.match(presence, /donate\.id = 'donation-button'/);
  assert.match(presence, /headerActions\.append\(donate\)/);
  assert.match(presence, /document\.querySelector\('\.creator-actions'\)\?\.append\(aboutDonate\)/);
  assert.doesNotMatch(styles, /body\.basic-mode\s+#donation-button/);
});

test('the primary Live connection action emits a normalized start request', () => {
  const source = read('web/static/core_ui.js');
  const start = source.indexOf('function startLive() {');
  const end = source.indexOf('\n}', start) + 2;
  assert.ok(start >= 0 && end > start, 'the Live connection action must be available');
  const emitted = [];
  const context = {
    document: { getElementById: id => id === 'btn-connect' ? { disabled: false } : { value: ' @Creator ' } },
    socket: { connected: true, emit: (...args) => emitted.push(args) },
    hideError() {}, setStatus() {}, setConnectPending() {}, setButtons() {},
  };
  vm.runInNewContext(source.slice(start, end), context);
  context.startLive();
  assert.equal(JSON.stringify(emitted), JSON.stringify([['start_live', { username: 'Creator' }]]));
});

test('interface motion has three levels and honors the operating system preference', () => {
  const template = read('web/templates/index.html');
  const sidebar = read('web/static/sidebar.js');
  const styles = read('web/static/sidebar.css');
  assert.match(template, /id="motion-level-select"/);
  assert.match(template, /value="reduced"/);
  assert.match(template, /value="subtle" selected/);
  assert.match(template, /value="expressive"/);
  assert.match(sidebar, /prefers-reduced-motion: reduce/);
  assert.match(sidebar, /tikreader\.menuMotion/);
  assert.match(sidebar, /dataset\.motionLevel/);
  assert.match(styles, /body\.menu-motion-reduced/);
  assert.match(styles, /@media\(prefers-reduced-motion:reduce\)/);
});

test('changing sections never dims the whole application view', () => {
  const shell = read('web/static/shell.js');
  assert.doesNotMatch(shell, /revealView/);
  assert.doesNotMatch(shell, /node\.animate\(\[\{opacity/);
  assert.doesNotMatch(shell, /getAnimations\(\)\.forEach/);
});
