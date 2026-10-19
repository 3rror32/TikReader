const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('web/static/core_ui.js', 'utf8');
const stop = source.match(/function stopLive\(\) \{[\s\S]*?\n\}/)[0];

for (const state of ['connecting', 'connected']) {
  test(`${state} stop reaches the backend exactly once despite repeated activation`, () => {
    const sent = [];
    const context = vm.createContext({
      stopIntent:null,
      socket:{connected:true, emit:event => sent.push(event)},
      document:{getElementById:() => ({dataset:{connectionState:state}})},
      window:{LivePresence:{requestStop(){}}},
      setConnectionState(){}, setStatus(){},
    });
    vm.runInContext(stop + '; stopLive(); stopLive();', context);
    assert.deepEqual(sent, ['stop_live']);
    assert.equal(context.stopIntent, state === 'connecting' ? 'cancelled' : 'offline');
  });
}
const start = source.match(/function startLive\(\) \{[\s\S]*?\n\}/)[0];
test('the same pending control cancels instead of starting again', () => {
  let cancelled = 0;
  const context = vm.createContext({document:{body:{classList:{contains:() => false}},getElementById:() => ({dataset:{connectionState:'connecting'}})}, stopLive(){cancelled++;}});
  vm.runInContext(start + '; startLive();', context);
  assert.equal(cancelled, 1);
});
test('plug states have separate visible shapes', () => {
  const markup = fs.readFileSync('web/templates/index.html', 'utf8');
  assert.match(markup, /class="connect-button__unplugged"/);
  assert.match(markup, /class="connect-button__plugged"/);
  const styles = fs.readFileSync('web/static/live_refinement.css', 'utf8');
  assert.match(styles, /data-state="connected"\]\s+\.connect-button__unplugged\s*\{\s*display: none/);
});
