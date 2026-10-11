const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const liveRefinement = fs.readFileSync(path.join(root, 'web/static/live_refinement.css'), 'utf8');
const skinComponents = fs.readFileSync(path.join(root, 'web/static/skin_components.css'), 'utf8');

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

test('Connect declarations beat the shared important control cascade', () => {
  assert.match(skinComponents, /background:var\(--control-bg\)!important/);
  assert.match(skinComponents, /background:color-mix\(in srgb,var\(--control-bg\) 88%,var\(--control-ink\)\)!important/);
  assert.match(skinComponents, /opacity:\.5!important; cursor:not-allowed!important; filter:none!important/);
  assert.match(skinComponents, /outline:2px solid var\(--skin-accent\)!important/);

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
  assert.match(hover, /transform: none !important/);
  for (const property of ['background', 'background-size', 'background-position', 'border-color', 'box-shadow']) {
    assert.equal(hasImportant(hover, property), true, `${property} preserves the Connect hover/focus signature`);
  }

  const focus = rule('html body .session-panel #btn-connect.btn-primary:focus-visible:not(:disabled):not([aria-disabled="true"])');
  assert.match(focus, /outline: 2px solid transparent !important/);
  assert.match(focus, /box-shadow: 0 0 0 2px var\(--skin-surface\), 0 0 0 4px var\(--skin-text\) !important/);
  assert.equal(hasImportant(focus, 'box-shadow'), true);

  const active = rule('html body .session-panel #btn-connect.btn-primary:active:not(:disabled):not([aria-disabled="true"])');
  assert.match(active, /transform: none !important/);
  for (const property of ['background', 'background-size', 'background-position', 'transform', 'box-shadow']) {
    assert.equal(hasImportant(active, property), true, `${property} preserves the Connect active state`);
  }

  const disabled = rule('html body .session-panel #btn-connect.btn-primary:disabled');
  assert.match(disabled, /cursor: not-allowed/);
  for (const property of ['opacity', 'filter', 'background-position', 'box-shadow']) {
    assert.equal(hasImportant(disabled, property), true, `${property} preserves the restrained disabled state`);
  }
  assert.match(liveRefinement, /#btn-connect\.btn-primary:active:not\(:disabled\):not\(\[aria-disabled="true"\]\)\s*\{\s*transform: none !important/);
  assert.match(liveRefinement, /prefers-reduced-motion: reduce[\s\S]*#btn-connect\.btn-primary::before[\s\S]*transition: none/);
});

test('Connect uses an accessible inline connection icon and synchronous pending state', () => {
  const template = fs.readFileSync(path.join(root, 'web/templates/index.html'), 'utf8');
  const coreUi = fs.readFileSync(path.join(root, 'web/static/core_ui.js'), 'utf8');
  const button = template.match(/<button class="btn btn-primary" id="btn-connect"[\s\S]*?<\/button>/)?.[0];

  assert.ok(button, 'expected the TikTok Connect button');
  assert.match(button, /<svg[^>]*aria-hidden="true"/);
  assert.match(button, /M9 3v5m6-5v5M7 8h10v4a5 5 0 0 1-10 0V8z/);
  assert.match(button, /M12 17v1a4 4 0 0 0 4 4h2/);
  assert.doesNotMatch(button, /M8\.8 5\.4|M6 3\.2|L12 8l3\.2 13/);
  assert.doesNotMatch(button, /↗|\bmask:/);
  assert.match(button, /Conectar/);
  assert.match(button, /Conectando…/);
  assert.match(button, /role="status"/);
  assert.match(coreUi, /setConnectPending\(true\)/);
  assert.match(coreUi, /setConnectPending\(false\)/);
  assert.match(coreUi, /function setConnectPending\(/);
});

test('Connect reserves motion for its pending orbit rather than idle shimmer', () => {
  const base = rule('html body .session-panel #btn-connect.btn-primary');
  const hover = rule('html body .session-panel #btn-connect.btn-primary:is(:hover, :focus-visible):not(:disabled):not([aria-disabled="true"])');
  const active = rule('html body .session-panel #btn-connect.btn-primary:active:not(:disabled):not([aria-disabled="true"])');

  assert.match(rule('.session-panel #btn-connect::before'), /display: none/);
  assert.doesNotMatch(base, /transform 100ms ease/);
  assert.match(hover, /transform: none/);
  assert.match(hover, /#25f4ee/i);
  assert.match(hover, /#fe2c55/i);
  assert.match(active, /transform: none/);
  assert.match(rule('.session-panel #btn-connect .connect-button__spinner'), /animation: connect-spin 1\.1s linear infinite/);
  assert.match(liveRefinement, /prefers-reduced-motion: reduce[\s\S]*#btn-connect\.btn-primary::before[\s\S]*animation: none !important/);
});

test('Pending connection keeps Stop available and reduced motion resets hover scale', () => {
  const coreUi = fs.readFileSync(path.join(root, 'web/static/core_ui.js'), 'utf8');
  const pending = coreUi.match(/function setConnectPending\(pending\) \{([\s\S]*?)\n\}/)?.[1];
  const start = coreUi.match(/function startLive\(\) \{([\s\S]*?)\n\}/)?.[1];
  const connecting = coreUi.match(/socket\.on\('connecting',[\s\S]*?\n\}\);/)?.[0];
  const restored = coreUi.match(/socket\.on\('status',[\s\S]*?\n\}\);/)?.[0];

  assert.match(pending, /btn-stop/);
  assert.match(start, /setConnectPending\(true\)/);
  assert.match(connecting, /setConnectPending\(true\)/);
  assert.match(restored, /else setConnectPending\(true\)/);
  assert.match(restored, /setButtons\(false\)/);
  assert.match(
    liveRefinement,
    /prefers-reduced-motion: reduce[\s\S]*#btn-connect\.btn-primary:is\(:hover, :focus-visible\)[\s\S]*transform: none !important/,
  );
});
