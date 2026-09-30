process.chdir(require('node:path').resolve(__dirname, '..'));
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('late screens register inside the content area and start hidden',()=>{
  const shell=fs.readFileSync('web/static/shell.js','utf8');
  const center=fs.readFileSync('frontend/entries/control-center.ts','utf8');
  assert.match(shell,/function registerView\(key,node\)/);
  assert.match(shell,/config\.append\(node\)/);
  assert.match(center,/pane\.hidden = true/);
  assert.match(center,/Shell\.registerView\("control-center", pane\)/);
  assert.doesNotMatch(center,/querySelector\(`?"?\.app/);
});
