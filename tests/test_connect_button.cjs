const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const liveRefinement = fs.readFileSync(path.join(root, 'web/static/live_refinement.css'), 'utf8');

test('Connect button keeps its theme-aware broadcast interaction contract', () => {
  const buttonRules = liveRefinement.match(/html body \.session-panel #btn-connect[\s\S]*?(?=\/\* Compact connection desk)/)?.[0];
  assert.ok(buttonRules, 'the primary Connect button has an ID-specific rule');
  assert.match(buttonRules, /var\(--skin-accent\)/);
  assert.match(buttonRules, /var\(--skin-accent-ink\)/);
  assert.doesNotMatch(buttonRules, /#[0-9a-f]{3,8}\b/i);
  assert.match(buttonRules, /min-height: 46px; padding: 12px 18px/);
  assert.match(buttonRules, /:is\(:hover, :focus-visible\):not\(:disabled\)[\s\S]*background-position: 88% 50%/);
  assert.match(buttonRules, /:is\(:hover, :focus-visible\):not\(:disabled\)::after\s*\{\s*transform: translateX\(3px\)/);
  assert.match(buttonRules, /:focus-visible\s*\{\s*outline: 3px solid var\(--skin-accent-ink\); outline-offset: 3px/);
  assert.match(buttonRules, /:active:not\(:disabled\)\s*\{\s*transform: translateY\(1px\)/);
  assert.match(buttonRules, /:disabled\s*\{[^}]*opacity: \.58; filter: saturate\(\.45\); cursor: not-allowed/);
  assert.match(buttonRules, /@media \(prefers-reduced-motion: reduce\)[\s\S]*#btn-connect::after,[\s\S]*transition: none/);
});
