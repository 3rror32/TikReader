const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const template = read('web/templates/index.html');
const css = read('web/static/visual_refresh.css');
const personalities = read('web/static/theme_personalities.css');
const signatureCollection = read('web/static/theme_signature_collection.css');
const js = read('web/static/visual_refresh.js');
const presence = read('web/static/live_presence.js');
const liveButtonIcons = read('web/static/live_button_icons.js');
const liveColumns = read('web/static/live_columns.css');

test('the studio loads the visual refresh while keeping the shared form contract authoritative', () => {
  assert.match(template, /visual_refresh\.css\?v=20261005-responsive-settings/);
  assert.match(template, /theme_personalities\.css\?v=2/);
  assert.match(template, /theme_signature_collection\.css\?v=menu-copy-2/);
  assert.match(template, /visual_refresh\.js\?v=usability-1/);
  assert(template.indexOf('visual_refresh.css') < template.indexOf('form_controls.css'));
  assert(template.indexOf('theme_personalities.css') < template.indexOf('form_controls.css'));
  assert(template.indexOf('theme_signature_collection.css') < template.indexOf('form_controls.css'));
});

test('automatic voice controls switch to a muted speaker icon when disabled', () => {
  assert.match(liveColumns, /auto-reading-toggle\[aria-pressed=['"]false['"]\]/);
  assert.match(liveColumns, /M16(?:%20|\s)9l5(?:%20|\s)5/);
});

test('the disconnected desk has no colored metric pipes', () => {
  assert.match(css, /body:not\(\[data-live-state="live"\]\)[\s\S]*\.stat-card::before\s*{\s*display: none/);
  assert.match(presence, /const state = mode !== 'live' \? 'inactive' : pending \? 'pending'/);
});

test('the refresh omits the four-stage signal strip while retaining live empty-state updates', () => {
  assert.doesNotMatch(js, /signal-route|signal-stage|stageDefinitions|stageNodes|syncSignalRoute|signalObserver|voiceIsOn/);
  assert.doesNotMatch(css, /\.signal-route|\.signal-stage|tr-signal-flow/);
  assert.doesNotMatch(template, /signal-route|signal-stage/);
  assert.match(js, /data-live-state/);
  assert.match(js, /function connectionState\(\)/);
  assert.match(js, /new MutationObserver\(enhanceEmptyState\)\.observe\(body/);
});

test('themes are curated without removing saved legacy choices', () => {
  assert.match(template, /optgroup label="Temas con personalidad"/);
  assert.match(template, /optgroup label="Cabinas recomendadas"/);
  assert.match(template, /optgroup label="Más temas"/);
  for (const value of ['broadcast-console', 'creator-pop', 'studio-rundown', 'terminal-crt', 'cyber-neumorph', 'swiss-brutalist', 'tactile-scrapbook', 'original', 'light', 'cute', 'dracula', 'glass', 'chromapulse']) {
    assert.match(template, new RegExp(`option value="${value}"`));
  }
});

test('each signature theme changes geometry, type and component composition', () => {
  for (const theme of ['broadcast-console', 'creator-pop', 'studio-rundown']) {
    assert.match(personalities, new RegExp(`data-skin="${theme}"`));
  }
  assert.match(personalities, /--control-field-radius: 2px/);
  assert.match(personalities, /--control-field-radius: 15px/);
  assert.match(personalities, /--control-field-radius: 0px/);
  assert.match(personalities, /\.comment-card:nth-child\(even\)/);
  assert.match(personalities, /content: "RUN OF SHOW"/);
  assert.match(personalities, /text-transform: uppercase/);
});

test('studio rundown sidebar keeps readable text across hover and keyboard focus', () => {
  assert.match(personalities, /--nav-ink: #fffdf7/);
  assert.match(personalities, /studio-rundown[\s\S]*data-section-nav\]:is\(:hover, :focus-visible\)/);
  assert.match(personalities, /summary:is\(:hover, :focus-visible\)[\s\S]*color: #fffdf7 !important/);
  assert.match(personalities, /sidebar-icon[\s\S]*color: currentColor !important/);
});

test('the second signature collection gives each theme its own material and layout language', () => {
  for (const theme of ['terminal-crt', 'cyber-neumorph', 'swiss-brutalist', 'tactile-scrapbook']) {
    assert.match(signatureCollection, new RegExp(`data-skin="${theme}"`));
  }
  assert.match(signatureCollection, /repeating-linear-gradient\(0deg/);
  assert.match(signatureCollection, /@keyframes tr-crt-cursor/);
  assert.match(signatureCollection, /inset 3px 3px 7px/);
  assert.match(signatureCollection, /grid-template-columns: 1\.7fr \.85fr 1\.1fr 1\.45fr/);
  assert.match(signatureCollection, /transform: rotate\(-\.7deg\)/);
  assert.match(signatureCollection, /prefers-reduced-motion: reduce/);
});

test('terminal CRT keeps sidebar copy in sentence case without a baud label', () => {
  assert.match(signatureCollection, /terminal-crt[^}]+\.app-sidebar \[data-section-nav\][\s\S]*?text-transform: none/);
  assert.match(signatureCollection, /terminal-crt[^}]+\.app-sidebar :is\(\.nav-section-label[\s\S]*?text-transform: none/);
  assert.doesNotMatch(signatureCollection, /TTY-01|9600 BAUD/);
});

test('mobile navigation, actionable empty states and reduced motion are present', () => {
  assert.match(js, /mobile-command-dock/);
  assert.match(js, /empty-state-action/);
  assert.match(js, /target: 'gifts', label: 'Regalos'/);
  assert.match(js, /menuOpen \? 'Cerrar' : 'Más'/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.doesNotMatch(css, /\.app > header #donation-button\s*\{\s*display:\s*none/);
  assert.match(liveButtonIcons, /control\.matches\('\.empty-state-action'\)/);
});

test('recommended themes are visible before the full legacy catalog', () => {
  assert.match(template, /class="skin-recommendations"/);
  assert.match(template, /data-skin-choice="original"/);
  assert.match(template, /class="skin-more settings-disclosure"/);
  assert.match(css, /\.skin-recommendations/);
});

test('settings groups keep a responsive gutter inside every theme treatment', () => {
  assert.match(css, /settings-stack > \.setting-card[\s\S]*padding: 24px clamp\(16px, 2vw, 24px\)/);
});

test('settings respond to their usable panel width without collapsing headings', () => {
  assert.match(css, /container-name: settings-stack/);
  assert.match(css, /\.skin-settings\s*\{\s*grid-template-columns: minmax\(280px, \.7fr\) minmax\(0, 1\.3fr\)/);
  assert.match(css, /@container settings-stack \(max-width: 860px\)[\s\S]*\.skin-settings\s*\{[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(css, /\.settings-group-title :is\(h3, p\)[^}]*word-break: normal/);
});
