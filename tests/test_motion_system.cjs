const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const read = path => fs.readFileSync(path, 'utf8');
const template = read('web/templates/index.html');
const css = read('web/static/motion_system.css');
const js = read('web/static/motion_system.js');

test('the motion layer is loaded after authored themes', () => {
  assert.match(template, /motion_system\.css\?v=1/);
  assert.match(template, /motion_system\.js\?v=1/);
  assert(template.indexOf('theme_signature_collection.css') < template.indexOf('motion_system.css'));
});

test('motion reacts to meaningful interface changes', () => {
  assert.match(js, /tikreader:navigation-change/);
  assert.match(js, /motion-comment-arrival/);
  assert.match(js, /motion-metric-update/);
  assert.match(js, /motion-stage-update/);
  assert.match(js, /HTMLDetailsElement/);
});

test('motion supports reduced mode and theme signatures', () => {
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /data-motion-level="reduced"/);
  for (const skin of ['studio-rundown', 'broadcast-console', 'creator-pop', 'terminal-crt', 'cyber-neumorph', 'swiss-brutalist', 'tactile-scrapbook']) {
    assert.match(css, new RegExp(`data-skin="${skin}"`));
  }
});
