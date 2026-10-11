const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('initial markup exposes useful structure and keeps the application inert', () => {
  const html = read('web/templates/index.html');
  assert.match(html, /id="operator-boot-status"[^>]*aria-live="polite"/);
  assert.match(html, /<div class="app" inert\s/);
  assert.match(html, /<noscript>[\s\S]*JavaScript[\s\S]*<\/noscript>/i);
  assert.doesNotMatch(html, /data-ui-loading|opacity:\s*0\s*!important|setTimeout\(reveal,\s*8000\)/);
});

test('boot controller keeps structure, shell, backend, and TikTok live distinct', () => {
  const boot = read('web/static/operator_boot.js');
  for (const stage of ['document-structure-ready', 'shell-ready', 'backend-ready', 'tiktok-live']) {
    assert.ok(boot.includes(stage), `missing distinct boot stage: ${stage}`);
  }
  assert.match(boot, /performance\.mark/);
  assert.match(boot, /location\.reload\(\)/);
  assert.match(boot, /retrying/);
});

test('shell and socket signals describe readiness without implying TikTok is live', () => {
  const shell = read('web/static/shell.js');
  const core = read('web/static/core_ui.js');
  assert.match(shell, /OperatorBoot\?\.shellReady\(\)/);
  assert.match(core, /OperatorBoot\?\.backendReady\(\)/);
  assert.match(core, /OperatorBoot\?\.tiktokLive\(\)/);
  assert.match(core, /OperatorBoot\?\.backendLost\(\)/);
});

test('independent fallback watches for a missing boot controller and gates retry', () => {
  const html = read('web/templates/index.html');
  const fallback = html.indexOf('data-boot-fallback');
  const controller = html.indexOf('src="/static/operator_boot.js');
  assert.ok(fallback >= 0 && fallback < controller, 'fallback must execute before the boot controller request');
  const fallbackSource = html.slice(fallback, controller);
  const boot = read('web/static/operator_boot.js');
  assert.match(fallbackSource, /__operatorBootRecoveryFailed/);
  assert.match(fallbackSource, /setTimeout/);
  assert.match(fallbackSource, /location\.reload\(\)/);
  assert.match(fallbackSource, /aria-busy/);
  assert.match(fallbackSource, /observer\?\.disconnect\(\)/);
  assert.match(boot, /if \(window\.__operatorBootRecoveryFailed\) return/);
});
