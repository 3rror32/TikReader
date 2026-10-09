process.chdir(require('node:path').resolve(__dirname, '..'));
const fs = require('node:fs');
const test = require('node:test');
const assert = require('node:assert/strict');

const markup = fs.readFileSync(`${__dirname}/../web/static/simulation.js`, 'utf8');
const styles = fs.readFileSync(`${__dirname}/../web/static/simulation.css`, 'utf8');

test('floating chat actions and tabs use decorative inline SVG icons', () => {
  for (const id of ['simulation-float-full', 'simulation-float-close', 'simulation-float-stop']) {
    const button = markup.match(new RegExp(`<button[^>]*id="${id}"[^>]*>([\\s\\S]*?)</button>`));
    assert.ok(button, `${id} button exists`);
    assert.match(button[1], /<svg[^>]*aria-hidden="true"/i, `${id} has an aria-hidden SVG`);
    assert.match(button[0], /aria-label=/, `${id} retains an accessible name`);
  }

  for (const tab of ['chat', 'activity']) {
    const button = markup.match(new RegExp(`<button[^>]*data-simulation-float-tab="${tab}"[^>]*>([\\s\\S]*?)</button>`));
    assert.ok(button, `${tab} tab exists`);
    assert.match(button[1], /<svg[^>]*aria-hidden="true"/i, `${tab} tab has an aria-hidden SVG`);
  }
});

test('floating chat footer and tabs have comfortable targets, spacing, and focus', () => {
  assert.match(styles, /\.simulation-float-tabs\{[^}]*gap:\s*[6-9]px[^}]*padding:\s*\d+px\s+\d+px/i);
  assert.match(styles, /\.simulation-float-tabs button[^}]*min-height:\s*(3[6-9]|[4-9]\d)px/i);
  assert.match(styles, /#simulation-float footer[^}]*padding:\s*\d+px\s+\d+px/i);
  assert.match(styles, /#simulation-float footer\s*>\s*span\s*\{/i, 'footer status styling is limited to its direct child');
  assert.doesNotMatch(styles, /#simulation-float footer\s+span\s*\{/i, 'footer status styling must not leak onto nested button labels');
  assert.match(styles, /#simulation-float-stop[^}]*min-height:\s*(3[6-9]|[4-9]\d)px/i);
  assert.match(styles, /#simulation-float :focus-visible[^}]*outline:/i);
  assert.match(styles, /@media\s*\(max-width:\s*680px\)[\s\S]*#simulation-float/);
});
