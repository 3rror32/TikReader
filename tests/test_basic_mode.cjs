const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

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
    'overlay-goals', 'overlay-favorites', 'overlay-my-animations',
    'about',
  ]);
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

test('menu keeps live controls fixed and safety only in the top bar', () => {
  const sidebar = read('web/static/sidebar.js');
  const shell = read('web/static/shell.js');
  assert.match(sidebar, /critical\.className = 'sidebar-critical'/);
  assert.match(sidebar, /\['live', 'voice'\]/);
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

test('session empty-data context is plain text without a colored container', () => {
  const styles = read('web/static/live_refinement.css');
  const context = styles.match(/\.session-panel #session-data-context\s*\{([^}]*)\}/);
  assert.ok(context, 'session data context style must exist');
  assert.doesNotMatch(context[1], /background|border-radius|padding/);
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

test('the donation button remains visible in basic mode', () => {
  const styles = read('web/static/basic_mode.css');
  const presence = read('web/static/live_presence.js');
  assert.match(presence, /donate\.id = 'donation-button'/);
  assert.doesNotMatch(styles, /body\.basic-mode\s+#donation-button/);
});

test('menu motion is optional and honors the operating system preference', () => {
  const template = read('web/templates/index.html');
  const sidebar = read('web/static/sidebar.js');
  const styles = read('web/static/sidebar.css');
  assert.match(template, /id="menu-motion-toggle"/);
  assert.match(sidebar, /prefers-reduced-motion: reduce/);
  assert.match(sidebar, /tikreader\.menuMotion/);
  assert.match(styles, /body\.menu-motion-reduced/);
  assert.match(styles, /@media\(prefers-reduced-motion:reduce\)/);
});

test('changing sections never dims the whole application view', () => {
  const shell = read('web/static/shell.js');
  assert.doesNotMatch(shell, /revealView/);
  assert.doesNotMatch(shell, /node\.animate\(\[\{opacity/);
  assert.doesNotMatch(shell, /getAnimations\(\)\.forEach/);
});
