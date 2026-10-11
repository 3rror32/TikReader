const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const index = read('web/templates/index.html');
const creator = read('web/templates/creator.html');
const css = read('web/static/theme_accessibility.css');
const layoutSafety = read('web/static/theme_layout_safety.css');
const signatures = read('web/static/theme_signature_collection.css');

test('the final theme accessibility layer loads after form controls', () => {
  for (const template of [index, creator]) {
    assert.match(template, /theme_accessibility\.css\?v=4/);
    assert(template.indexOf('form_controls.css') < template.indexOf('theme_accessibility.css'));
  }
});

test('every themed surface loads the final geometry contract last', () => {
  for (const template of [index, creator]) {
    assert.match(template, /theme_layout_safety\.css\?v=1/);
    assert(template.indexOf('theme_accessibility.css') < template.indexOf('theme_layout_safety.css'));
  }
});

test('skins cannot consume sidebar or component bounds with private margins', () => {
  assert.match(layoutSafety, /width: var\(--sidebar-width\) !important/);
  assert.match(layoutSafety, /margin-inline: var\(--sidebar-width\) 0 !important/);
  assert.match(layoutSafety, /settings-stack > \.setting-card[\s\S]*margin-inline: 0 !important/);
  assert.match(layoutSafety, /data-skin="swiss-brutalist"[\s\S]*left: 0 !important/);
  assert.doesNotMatch(read('web/static/skins.css'), /margin-left:230px|margin-left:205px/);
});

test('creator loads every signature theme definition before its safeguards', () => {
  assert.match(creator, /theme_personalities\.css\?v=2/);
  assert.match(creator, /theme_signature_collection\.css\?v=menu-copy-2/);
  assert(creator.indexOf('theme_signature_collection.css') < creator.indexOf('theme_accessibility.css'));
});

test('shared safeguards cover labels, status surfaces, destructive actions and checks', () => {
  assert.match(css, /\.sidebar-brand span \{ color: inherit !important; \}/);
  assert.match(css, /\.sidebar-brand \{ color: var\(--nav-ink, var\(--skin-text\)\) !important; \}/);
  assert.match(css, /data-skin="tactile-scrapbook"[^}]+\.sidebar-brand/s);
  assert.match(css, /\.beta-badge/);
  assert.match(css, /session-persistent-label/);
  assert.match(css, /#profile-delete/);
  assert.match(css, /#update-available/);
  assert.match(css, /body\.creator-app :is\(label, small, \.hint\)/);
  assert.match(css, /body\.creator-app input\[type="file"\]/);
  assert.match(css, /#ui-control-contract.*input\[type="checkbox"\].*input\[type="radio"\]/s);
  assert.match(css, /border-color: color-mix\(in srgb, var\(--skin-text\) 70%, var\(--skin-surface\)\) !important/);
});

test('light signature themes use readable warning and navigation colors', () => {
  assert.match(signatures, /data-skin="swiss-brutalist"[\s\S]*--skin-warning: #8a6500/);
  assert.match(signatures, /data-skin="tactile-scrapbook"[\s\S]*--skin-accent: #3b706c/);
  assert.match(signatures, /data-skin="tactile-scrapbook"[\s\S]*--skin-warning: #8a5c00/);
  assert.match(signatures, /data-skin="tactile-scrapbook"[\s\S]*--nav-muted: #fff8e9/);
  assert.match(signatures, /#8a5e3b !important/);
});

test('operator focus uses visible ink and error recovery beats secondary actions', () => {
  assert.match(css, /:focus-visible\s*\{[^}]*outline: 2px solid var\(--skin-text\) !important/s);
  assert.match(css, /#error-recovery\s*\{[^}]*background: var\(--skin-accent\) !important/s);
  assert.match(css, /#error-panel \.err-btn-close\s*\{[^}]*background: transparent !important/s);
  assert.match(css, /#error-panel\s*\{[^}]*border-inline-start: 3px solid var\(--skin-danger\)/s);
  assert.match(css, /#username-input:focus-visible\s*\{[^}]*outline: 2px solid var\(--skin-text\) !important/s);
});

test('operator content can wrap in narrow and short windows', () => {
  assert.match(css, /\.session-identity[^}]*overflow-wrap: anywhere/s);
  assert.match(css, /@media \(max-width: 430px\)[\s\S]*#error-panel\.visible[^}]*flex-wrap: wrap/s);
  assert.match(css, /@media \(max-height: 700px\)[\s\S]*html\[data-skin\] body[^}]*overflow: auto !important/s);
  assert.match(css, /scroll-padding-block: 12px 90px/);
});
