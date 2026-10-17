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
