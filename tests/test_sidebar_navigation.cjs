process.chdir(require('node:path').resolve(__dirname, '..'));
const fs = require('node:fs');
const assert = require('node:assert/strict');
const test = require('node:test');

const sidebar = fs.readFileSync('web/static/sidebar.js', 'utf8');
const styles = fs.readFileSync('web/static/sidebar.css', 'utf8');
const refinements = fs.readFileSync('web/static/live_refinement.css', 'utf8');

test('primary and advanced menu disclosures share one visual contract', () => {
  assert.match(styles,/:is\(\.nav-group>details,\.nav-advanced-section\)>summary\{/);
  assert.match(styles,/:is\(\.nav-submenu,\.sidebar-disclosure-content\)\{/);
  assert.doesNotMatch(refinements,/data-section-group="overlay-gallery"[^{}]*> \.nav-submenu/);
  assert.doesNotMatch(sidebar,/setAttribute\('name',\s*'advanced-navigation'\)/);
});

test('all sidebar disclosures use the smooth curtain animation', () => {
  assert.match(sidebar,/function enhanceDisclosure\(details, content, beforeOpen\)/);
  assert.match(sidebar,/clipPath: 'inset\(0 0 100% 0\)'/);
  assert.match(sidebar,/Math\.max\(content\.getBoundingClientRect\(\)\.height, content\.scrollHeight\)/);
  assert.match(sidebar,/cubic-bezier\(\.22,\.72,\.24,1\)/);
  assert.match(sidebar,/if \(!motionAllowed\(\) \|\| typeof content\.animate !== 'function'\) return/);
  assert.match(sidebar,/querySelectorAll\('\.nav-group > details'\).*enhanceDisclosure/);
  assert.match(sidebar,/advancedSections\).*enhanceDisclosure/);
});

test('main categories behave as one animated accordion without affecting overlays', () => {
  assert.match(sidebar,/function closeOtherAdvancedSections\(current\)/);
  assert.match(sidebar,/section\.dataset\.targetOpen !== 'true'/);
  assert.match(sidebar,/enhanceDisclosure\(section,[^\n]+closeOtherAdvancedSections\)/);
  assert.match(sidebar,/querySelectorAll\('\.nav-group > details'\)\) enhanceDisclosure\(details,[^\n]+\)/);
});

test('opened categories reveal themselves and preserve visible location context', () => {
  assert.match(sidebar,/function revealAdvancedSection\(section\)/);
  assert.match(sidebar,/navigation\.scrollBy\(\{top:offset,behavior:motionAllowed\(\)\?'smooth':'auto'\}\)/);
  assert.match(sidebar,/current\.textContent = activeLabel/);
  assert.match(styles,/\.nav-current-label\{/);
  assert.match(styles,/\.nav-advanced-section\[open\] \.nav-current-label/);
});

test('final destinations stay outside the last advanced category', () => {
  assert.match(sidebar, /!next\.classList\.contains\('nav-tail-item'\)/);
  assert.match(sidebar, /for \(let next = label\.nextElementSibling;[^{]+nav-tail-item[^}]+content\.append\(next\)/s);
});

test('complete mode offers a keyboard-friendly tool search above navigation', () => {
  assert.match(sidebar,/searchInput\.placeholder = 'Buscar herramienta…'/);
  assert.match(sidebar,/searchBox\.append\(searchToggle, searchInput, searchResults, searchEmpty\); navigation\.before\(searchBox\)/);
  assert.match(sidebar,/event\.key === 'ArrowDown'/);
  assert.match(sidebar,/event\.key === 'Escape'/);
  assert.match(styles,/\.sidebar-collapsed \.sidebar-search\.is-popover/);
  assert.match(styles,/\.app-sidebar\.is-searching:not\(\.search-popover\)/);
});

test('collapsed search popover stays outside the rail and within the viewport', () => {
  assert.match(styles,/\.sidebar-collapsed \.sidebar-search\.is-popover\{[^}]*position:fixed/);
  assert.match(styles,/\.sidebar-collapsed \.sidebar-search\.is-popover\{[^}]*left:clamp\(/);
  assert.match(styles,/\.sidebar-collapsed \.sidebar-search\.is-popover\{[^}]*width:min\(310px,calc\(100vw - 104px\)\)/);
  assert.match(styles,/\.sidebar-collapsed \.sidebar-search\.is-popover\{[^}]*box-sizing:border-box/);
});

test('collapsed search result labels and categories stay horizontal and truncate', () => {
  assert.match(styles,/\.sidebar-search-result-copy :is\(strong,small\)\{[^}]*white-space:nowrap/);
  assert.match(styles,/\.sidebar-search-result-copy :is\(strong,small\)\{[^}]*overflow:hidden/);
  assert.match(styles,/\.sidebar-search-result-copy :is\(strong,small\)\{[^}]*text-overflow:ellipsis/);
  assert.match(styles,/\.sidebar-search-result-copy :is\(strong,small\)\{[^}]*overflow-wrap:normal/);
});
