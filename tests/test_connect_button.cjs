const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const template = fs.readFileSync(path.join(root, 'web/templates/index.html'), 'utf8');
const liveRefinement = fs.readFileSync(path.join(root, 'web/static/live_refinement.css'), 'utf8');
const skinComponents = fs.readFileSync(path.join(root, 'web/static/skin_components.css'), 'utf8');
const themeSignatureCollection = fs.readFileSync(path.join(root, 'web/static/theme_signature_collection.css'), 'utf8');

const rule = selector => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const declarations = liveRefinement.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1];
  assert.ok(declarations, `expected a Connect-specific rule for ${selector}`);
  return declarations;
};

const hasImportant = (declarations, property) => {
  const value = declarations.split(';').map(part => part.trim()).find(part => part.startsWith(`${property}:`));
  return value?.endsWith('!important') ?? false;
};

test('Connect button wins the later shared and theme control cascade', () => {
  const refinementLink = template.indexOf('/static/live_refinement.css');
  const sharedLink = template.indexOf('/static/skin_components.css');
  const themeLink = template.indexOf('/static/theme_signature_collection.css');
  assert(refinementLink >= 0 && refinementLink < sharedLink && sharedLink < themeLink);
  assert.match(skinComponents, /background:var\(--control-bg\)!important/);
  assert.match(skinComponents, /background:color-mix\(in srgb,var\(--control-bg\) 88%,var\(--control-ink\)\)!important/);
  assert.match(skinComponents, /opacity:\.5!important; cursor:not-allowed!important; filter:none!important/);
  assert.match(skinComponents, /outline:2px solid var\(--skin-accent\)!important/);
  assert.match(themeSignatureCollection, /html\[data-skin="swiss-brutalist"\] body \.btn-primary\s*\{[^}]*background:\s*[^;]+!important/s);

  const base = rule('html body .session-panel #btn-connect.btn-primary');
  assert.match(base, /var\(--skin-accent\)/);
  assert.match(base, /var\(--skin-accent-ink\)/);
  assert.doesNotMatch(base, /#[0-9a-f]{3,8}\b/i);
  assert.match(base, /min-height: 46px; padding: 12px 18px/);
  for (const property of ['background', 'background-size', 'background-position', 'color', 'border-color', 'box-shadow']) {
    assert.equal(hasImportant(base, property), true, `${property} beats the later shared rule`);
  }

  const hover = rule('html body .session-panel #btn-connect.btn-primary:is(:hover, :focus-visible):not(:disabled):not([aria-disabled="true"])');
  assert.match(hover, /background-position: 88% 50%/);
  assert.match(rule('html body .session-panel #btn-connect.btn-primary:is(:hover, :focus-visible):not(:disabled):not([aria-disabled="true"])::after'), /transform: translateX\(3px\)/);
  for (const property of ['background', 'background-size', 'background-position', 'border-color', 'box-shadow']) {
    assert.equal(hasImportant(hover, property), true, `${property} preserves the Connect hover/focus signature`);
  }

  const focus = rule('html body .session-panel #btn-connect.btn-primary:focus-visible');
  assert.match(focus, /outline: 3px solid var\(--skin-accent-ink\) !important/);

  const active = rule('html body .session-panel #btn-connect.btn-primary:active:not(:disabled):not([aria-disabled="true"])');
  assert.match(active, /transform: translateY\(1px\) !important/);
  for (const property of ['background', 'background-size', 'background-position', 'transform', 'box-shadow']) {
    assert.equal(hasImportant(active, property), true, `${property} preserves the Connect active state`);
  }

  const disabled = rule('html body .session-panel #btn-connect.btn-primary:disabled');
  assert.match(disabled, /cursor: not-allowed/);
  for (const property of ['opacity', 'filter', 'background-position', 'box-shadow']) {
    assert.equal(hasImportant(disabled, property), true, `${property} preserves the restrained disabled state`);
  }
  assert.match(liveRefinement, /#btn-connect\.btn-primary:active:not\(:disabled\)\s*\{\s*transform: none !important/);
  assert.match(liveRefinement, /prefers-reduced-motion: reduce[\s\S]*#btn-connect\.btn-primary::after[\s\S]*transition: none/);
});
