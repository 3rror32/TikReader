const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const read = path => fs.readFileSync(path, 'utf8');

test('every interactive application page loads the shared form contract last', () => {
  const pages = [
    ['web/templates/index.html', '/static/basic_mode.css'],
    ['web/templates/creator.html', '/static/creator.css'],
    ['web/templates/moderator.html', '/static/ui_typography.css'],
  ];

  for (const [path, precedingStylesheet] of pages) {
    const html = read(path);
    const shared = html.indexOf('/static/form_controls.css');
    assert.notEqual(shared, -1, `${path} must load the shared form-control contract`);
    assert.ok(
      shared > html.indexOf(precedingStylesheet),
      `${path} must load the contract after page and feature styles`,
    );
  }
});

test('the shared contract covers every native form family and interaction state', () => {
  const css = read('web/static/form_controls.css');

  for (const selector of [
    'input[type="text"]',
    'input[type="password"]',
    'input[type="number"]',
    'select',
    'textarea',
    'input[type="checkbox"]',
    'input[type="radio"]',
    'input[type="range"]',
    'input[type="color"]',
    'input[type="file"]',
  ]) {
    assert.ok(css.includes(selector), `missing shared treatment for ${selector}`);
  }

  for (const state of [
    ':hover',
    ':focus-visible',
    ':disabled',
    ':user-invalid',
    ':read-only',
    ':checked',
    ':indeterminate',
    ':-webkit-autofill',
  ]) {
    assert.ok(css.includes(state), `missing shared ${state} state`);
  }

  assert.match(css, /--control-field-bg:\s*var\(--skin-bg,/);
  assert.match(css, /--control-field-accent:\s*var\(--skin-accent,/);
  assert.match(css, /@media \(pointer: coarse\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test('the prefixed connection field and hidden accessible checks remain compatible', () => {
  const css = read('web/static/form_controls.css');
  const template = read('web/templates/index.html');
  assert.match(css, /\.session-panel \.controls #username-input/);
  assert.match(css, /\.connection-field-label/);
  assert.match(template, /<label class="connection-field-label" for="username-input">/);
  assert.match(css, /\.mic-caption-processing-toggle\) input\[type="checkbox"\]/);
});

test('the live connection field and action share height and bottom alignment', () => {
  const css = read('web/static/form_controls.css');

  assert.match(
    css,
    /\.session-panel \.controls\s*\{[^}]*align-items:\s*flex-end;/s,
  );
  assert.match(
    css,
    /\.session-panel \.controls #username-input\s*\{[^}]*height:\s*var\(--control-field-height\);/s,
  );
  assert.match(
    css,
    /\.session-panel #btn-connect\s*\{[^}]*height:\s*var\(--control-field-height\);[^}]*min-height:\s*var\(--control-field-height\)\s*!important;/s,
  );
});
