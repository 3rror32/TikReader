const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('sidebar search keeps icon clearance against the later important form padding', () => {
  const sidebar = fs.readFileSync('web/static/sidebar.css', 'utf8');
  const shared = fs.readFileSync('web/static/form_controls.css', 'utf8');
  const inputRule = sidebar.match(/html body \.app-sidebar #sidebar-search-input\s*\{([^}]*)\}/);
  const sharedRule = shared.match(/html body :is\(([\s\S]*?)\)\s*\{([^}]*)\}/);

  assert.ok(inputRule, 'the sidebar input needs its targeted layout selector');
  assert.ok(sharedRule, 'the shared form-control contract must remain present');
  assert.match(sharedRule[1], /input\[type="search"\]/);
  assert.match(sharedRule[2], /(?:^|;)\s*padding:\s*8px\s+11px\s*!important\s*;/);

  // Both rules contain one ID; the sidebar class wins specificity only when
  // its icon clearance is important too. Shared appearance remains untouched.
  assert.match(
    inputRule[1],
    /(?:^|;)\s*padding:\s*8px\s+11px\s+8px\s+34px\s*!important\s*;/,
    'sidebar search must reserve 34px for its icon despite the shared important shorthand',
  );
});
