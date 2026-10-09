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
const brandRule = signature.match(/html:root\[data-skin="original"\] body \.sidebar-brand\s*\{([^}]*)\}/s)?.[1] || '';
const perimeterRule = signature.match(/html:root\[data-skin="original"\]::after\s*\{([^}]*)\}/s)?.[1] || '';
const perimeterLine = perimeterRule.match(/linear-gradient\(to bottom right,[^;]+\)/)?.[0] || '';
const smallFrameRule = signature.match(/@media\s*\(max-width:\s*\d+px\)\s*\{[\s\S]*?html:root\[data-skin="original"\]::after\s*\{([^}]*)\}/s)?.[1] || '';
const primaryControlSelector = signature.match(/(html:root\[data-skin="original"\] body :is\(\.btn-primary,[^{]*)\{[^}]*\}/s)?.[1] || '';
const primaryControlRule = signature.match(/html:root\[data-skin="original"\] body :is\(\.btn-primary,[^{]*\{([^}]*)\}/s)?.[1] || '';
const activeControlRule = signature.match(/html:root\[data-skin="original"\] body :is\(button, #skin-apply\):is\([^}]*\{([^}]*)\}/s)?.[1] || '';
const interactiveHoverRule = signature.match(/html:root\[data-skin="original"\] body :is\([^)]*\):hover[^{}]*\{[^}]*\}/s)?.[0] || '';

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

test('the principal theme is visibly selectable as TikReader', () => {
  assert.match(template, /<option value="original">TikReader<\/option>/);
  assert.match(skins, /original:'TikReader'/);
});

test('the signature uses clean TikReader branding with restrained opposing ambient glows', () => {
  assert.match(signature, /\.sidebar-brand/);
  assert.match(signature, /radial-gradient\(ellipse at 5% 0%, #06e4ff/i);
  assert.match(signature, /radial-gradient\(ellipse at 100% 100%, #ff1493/i);
  assert.match(signature, /body::before/);
  assert.doesNotMatch(signature, /content\s*:\s*['"]TikReader/i);
  assert.match(brandRule, /background:\s*transparent/);
  assert.match(brandRule, /border:\s*0/);
  assert.match(brandRule, /text-shadow:\s*none/);
  assert.match(brandRule, /font-family:\s*var\(--font-data\)/);
  assert.doesNotMatch(brandRule, /linear-gradient|#06e4ff|#ff1493/);
});

test('original controls carry restrained cyan and magenta hierarchy without changing danger or disabled states', () => {
  assert.match(signature, /html:root\[data-skin="original"\] body :is\([^)]*\.btn-primary[^)]*\)/);
  assert.match(primaryControlSelector, /:not\(:disabled\):not\(\[aria-disabled="true"\]\)/);
  assert.match(primaryControlSelector, /:not\(\.panic-button\):not\(\.btn-stop\):not\(\.danger-lite\)/);
  assert.match(primaryControlSelector, /:not\(#emergency-button\):not\(#voice-model-delete\):not\(#profile-delete\):not\(\.recording\)/);
  assert.match(primaryControlRule, /background:\s*var\(--skin-raised\)\s*!important/);
  assert.match(primaryControlRule, /color:\s*var\(--skin-text\)\s*!important/);
  assert.match(primaryControlRule, /border-left-color:\s*var\(--skin-accent\)\s*!important/);
  assert.match(primaryControlRule, /border-bottom-color:\s*var\(--skin-accent-2\)\s*!important/);
  assert.doesNotMatch(primaryControlRule, /background:\s*var\(--skin-accent\)|background:\s*#06e4ff/i);
  assert.match(signature, /:is\(\.active, \.selected, \.enabled, \[data-selected="true"\], \[aria-pressed="true"\], \[aria-selected="true"\]\)/);
  assert.match(activeControlRule, /background:\s*var\(--skin-raised\)\s*!important/);
  assert.match(activeControlRule, /border-left-color:\s*var\(--skin-accent\)\s*!important/);
  assert.match(activeControlRule, /border-bottom-color:\s*var\(--skin-accent-2\)\s*!important/);
  assert.match(signature, /:not\(:disabled\):not\(\[aria-disabled="true"\]\)/);
  assert.match(signature, /:not\(\.panic-button\):not\(\.btn-stop\):not\(\.danger-lite\)/);
  assert.match(signature, /:not\(\.platform-remove\):not\(#emergency-button\)/);
  assert.match(interactiveHoverRule, /:not\(\.recording\)/);
  assert.match(skinComponents, /\.btn-stop, \.panic-button, \.danger-lite/);
  assert.match(skinComponents, /:is\(:disabled, \[aria-disabled="true"\]\)/);
});

test('the original cabin perimeter echoes the splash as a masked, responsive, non-interactive frame', () => {
  assert.match(signature, /html:root\[data-skin="original"\]::after/);
  assert.match(perimeterRule, /position:\s*fixed/);
  assert.match(perimeterRule, /inset:\s*4px/);
  assert.doesNotMatch(perimeterRule, /inset:\s*[^;]*(?:vw|vh|clamp\()/i);
  assert.match(perimeterRule, /pointer-events:\s*none/);
  assert.match(perimeterRule, /padding:\s*1px/);
  assert.match(perimeterRule, /mask:\s*linear-gradient/);
  assert.match(perimeterRule, /mask-composite:\s*exclude/);
  assert.match(perimeterRule, /-webkit-mask-composite:\s*xor/);
  assert.match(perimeterRule, /radial-gradient\(ellipse at 0% 0%,\s*#06e4ff/i);
  assert.match(perimeterRule, /radial-gradient\(ellipse at 100% 100%,\s*#ff1493/i);
  assert.match(perimeterRule, /linear-gradient\(to bottom right,\s*#06e4ff[\s\S]*#ff1493/i);
  assert.match(perimeterLine, /#26313e[\s\S]*#3e2b3a/i);
  assert.doesNotMatch(perimeterLine, /transparent/i);
  assert.doesNotMatch(smallFrameRule, /inset\s*:/i, 'narrow layouts must inherit the same safe-edge inset');
  assert.match(smallFrameRule, /border-radius:\s*12px/);
  assert.doesNotMatch(perimeterRule, /animation|@keyframes/i);
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
