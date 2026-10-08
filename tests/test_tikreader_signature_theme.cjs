const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const css = read('web/static/skins.css');
const template = read('web/templates/index.html');
const skins = read('web/static/skins.js');
const visualRefresh = read('web/static/visual_refresh.css');
const sidebar = read('web/static/sidebar.css');
const skinComponents = read('web/static/skin_components.css');
const signature = css.split('/* TikReader principal signature theme */').at(-1);

test('the stable original theme receives the splash-inspired TikReader signature', () => {
  assert.match(template, /skins\.includes\(saved\)\s*\?\s*saved\s*:\s*'original'/);
  assert.match(skins, /let saved\s*=\s*'original'/);
  assert.match(skins, /if\(!allowed\.has\(saved\)\)saved='original'/);
  assert.match(signature, /html:root\[data-skin="original"\]/);
  assert.match(signature, /#03070d/i);
  assert.match(signature, /#061521/i);
  assert.match(signature, /#06e4ff/i);
  assert.match(signature, /#ff1493/i);
  assert.match(signature, /#edf7ff/i);
});

test('the signature uses existing TikReader branding and one restrained dual-energy frame', () => {
  assert.match(signature, /\.sidebar-brand/);
  assert.match(signature, /linear-gradient\([^)]*#06e4ff[^)]*#ff1493/i);
  assert.match(signature, /body::before/);
  assert.doesNotMatch(signature, /content\s*:\s*['"]TikReader/i);
});

test('the original-only signature preserves responsive, focus, and reduced-motion behavior without animation', () => {
  assert.match(signature, /@media\s*\(max-width:\s*\d+px\)/);
  assert.match(signature, /:focus-visible/);
  assert.match(signature, /prefers-reduced-motion:\s*reduce/);
  assert.doesNotMatch(signature, /@keyframes|animation\s*:/i);
  assert.doesNotMatch(signature, /html\[data-skin\]:not\(\[data-skin="original"\]\)/);
});

test('the principal signature outranks the later original-theme and shared-layout cascade', () => {
  assert(template.indexOf('skins.css') < template.indexOf('sidebar.css'));
  assert(template.indexOf('skins.css') < template.indexOf('visual_refresh.css'));
  assert(template.indexOf('skins.css') < template.indexOf('skin_components.css'));
  assert.match(visualRefresh, /html\[data-skin="original"\]\s*\{/);
  assert.match(visualRefresh, /html\[data-skin="original"\] body::before/);
  assert.match(visualRefresh, /mask-image:\s*linear-gradient\(to bottom, #0008, transparent 78%\)/);
  assert.match(sidebar, /:is\(html,html\[data-skin\]\) body \.app-sidebar/);
  assert.match(sidebar, /:is\(html,html\[data-skin\]\) body \.sidebar-brand/);
  assert.match(skinComponents, /html\[data-skin\] body :is\(button, a, input, select, textarea, summary, \[tabindex\]\):focus-visible/);
  assert.match(signature, /html:root\[data-skin="original"\]/);
  assert.match(signature, /html:root\[data-skin="original"\] body \.app-sidebar/);
  assert.match(signature, /html:root\[data-skin="original"\] body \.sidebar-brand/);
  assert.match(signature, /html:root\[data-skin="original"\] body::before\s*\{[^}]*mask-image:\s*none\s*;/s);
  assert.match(signature, /outline:\s*2px solid #06e4ff\s*!important/);
  assert.match(signature, /outline-offset:\s*3px\s*!important/);
});
