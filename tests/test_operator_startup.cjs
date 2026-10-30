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

test('optional game tools are deferred until navigation', () => {
 const html = read('web/templates/index.html');
 assert.doesNotMatch(html, /<script src="\/static\/(minecraft|game_hotkeys)\.js"/);
 assert.match(html, /src="\/static\/optional_tools\.js/);
});

test('production socket consumers load after core socket initialization', () => {
 const html = read('web/templates/index.html');
 assert.ok(html.indexOf('src="/static/core_ui.js') < html.indexOf('src="/static/production.js'));
});

test('startup presentation preserves geometry until the shell and document are assembled', () => {
  const html = read('web/templates/index.html');
  const css = read('web/static/operator_boot.css');
  const boot = read('web/static/operator_boot.js');
  assert.match(html, /dataset\.operatorLayout = 'pending'/);
  assert.match(css, /html\[data-operator-layout="pending"\][\s\S]*visibility:\s*hidden/);
  assert.match(css, /\.operator-boot-status\s*\{[^}]*position:\s*fixed/);
  assert.match(boot, /requestAnimationFrame/);
  assert.match(boot, /delete document\.documentElement\.dataset\.operatorLayout/);
});


test('presentation waits for DOM assembly and a frame, without waiting for the backend', () => {
  const vm = require('node:vm');
  const handlers = {};
  const frames = [];
  const root = {dataset: {operatorLayout: 'pending'}};
  const context = {
    window: {addEventListener() {}},
    document: {readyState: 'loading', documentElement: root,
      querySelector: () => null, getElementById: () => null,
      addEventListener: (name, handler) => { handlers[name] = handler; }},
    performance: {getEntriesByType: () => [], now: () => 0, mark() {}},
    MutationObserver: class { observe() {} disconnect() {} },
    requestAnimationFrame: callback => { frames.push(callback); return frames.length; },
    setTimeout: () => 1, clearTimeout() {},
  };
  vm.runInNewContext(read('web/static/operator_boot.js'), context);
  context.window.OperatorBoot.shellReady();
  assert.equal(root.dataset.operatorLayout, 'pending');
  assert.equal(frames.length, 0);
  handlers.DOMContentLoaded();
  assert.equal(root.dataset.operatorLayout, 'pending');
  assert.equal(frames.length, 1);
  frames.shift()();
  assert.equal(root.dataset.operatorLayout, undefined);
  assert.equal(context.window.OperatorBoot.snapshot().backendReady, false);
  root.dataset.operatorLayout = 'pending';
  context.window.OperatorBoot.fail();
  assert.equal(root.dataset.operatorLayout, undefined);
});


test('normal startup panel stays hidden while errors retain their recovery surface', () => {
  const html = read('web/templates/index.html');
  assert.match(html, /<section id="operator-boot-status"[^>]*\bhidden\b/);
  assert.match(read('web/static/operator_boot.js'), /panel\.hidden = !failed;/);
});


test('no-JavaScript notice remains outside the hidden startup panel', () => {
  const html = read('web/templates/index.html');
  const panelStart = html.indexOf('<section id="operator-boot-status"');
  const panelEnd = html.indexOf('</section>', panelStart);
  const notice = html.indexOf('<noscript>');
  assert.ok(notice > panelEnd, 'no-JavaScript notice must not inherit the hidden panel');
  assert.match(html.slice(notice), /<noscript><[^>]*class="operator-boot-status"[^>]*>[\s\S]*JavaScript/);
});


test('native presentation readiness is explicitly exposed after rendered frames', () => {
  assert.match(read('web/static/operator_boot.js'), /presentationReady,/);
  assert.match(read('web/static/operator_boot.js'), /requestAnimationFrame\(\(\) => requestAnimationFrame/);
});


test('presentation readiness waits for backend, released layout and painted frames', () => {
  const vm = require('node:vm');
  const frames = [];
  const handlers = {};
  const app = {inert: true, setAttribute() {}};
  const root = {dataset: {operatorLayout: 'pending'}};
  const context = {
    window: {addEventListener() {}},
    document: {readyState: 'loading', documentElement: root,
      querySelector: selector => selector === '.app' ? app : null, getElementById: () => null,
      addEventListener: (name, handler) => {handlers[name] = handler;}},
    performance: {getEntriesByType: () => [], now: () => 0, mark() {}},
    MutationObserver: class {observe() {} disconnect() {}},
    requestAnimationFrame: callback => {frames.push(callback); return frames.length;},
    setTimeout: () => 1, clearTimeout() {},
  };
  vm.runInNewContext(read('web/static/operator_boot.js'), context);
  const boot = context.window.OperatorBoot;
  boot.shellReady();
  assert.equal(boot.snapshot().presentationReady, false);
  handlers.DOMContentLoaded();
  frames.shift()();
  assert.equal(boot.snapshot().presentationReady, false);
  boot.backendReady();
  assert.equal(app.inert, false);
  assert.equal(boot.snapshot().presentationReady, false);
  frames.shift()();
  assert.equal(boot.snapshot().presentationReady, false);
  frames.shift()();
  assert.equal(boot.snapshot().presentationReady, true);
  assert.equal(boot.snapshot().milestones.tikTokLiveMs, null);
  boot.fail();
  assert.equal(boot.snapshot().presentationReady, false);
});


test('backend readiness arriving before shell initialization is retained', () => {
  const vm = require('node:vm');
  const frames = [];
  const app = {inert: true, setAttribute() {}};
  const root = {dataset: {operatorLayout: 'pending'}};
  const context = {
    window: {addEventListener() {}},
    document: {readyState: 'complete', documentElement: root,
      querySelector: selector => selector === '.app' ? app : null,
      getElementById: () => null, addEventListener() {}},
    performance: {getEntriesByType: () => [], now: () => 0, mark() {}},
    MutationObserver: class {observe() {} disconnect() {}},
    requestAnimationFrame: callback => {frames.push(callback); return frames.length;},
    setTimeout: () => 1, clearTimeout() {},
  };
  vm.runInNewContext(read('web/static/operator_boot.js'), context);
  const boot = context.window.OperatorBoot;
  assert.equal(boot.backendReady(), true);
  assert.equal(boot.snapshot().backendReady, true);
  assert.equal(app.inert, true);
  boot.shellReady();
  while (frames.length) frames.shift()();
  assert.equal(boot.snapshot().presentationReady, true);
  assert.equal(app.inert, false);
  assert.equal(root.dataset.operatorBootState, 'backend-ready');
});
