const fs = require('node:fs');
const test = require('node:test');
const assert = require('node:assert/strict');

test('hidden game tools do not poll the local service every second', () => {
  const source = fs.readFileSync('web/static/live_games.js', 'utf8');
  assert.match(source, /document\.hidden\|\|timer\.hidden/);
  assert.match(source, /wheel\.hidden&&drop\.hidden/);
});

test('inactive hidden simulation pauses its network and progress polling', () => {
  const source = fs.readFileSync('web/static/simulation.js', 'utf8');
  assert.match(source, /!state\.active&&!state\.batch&&simulationPane\?\.hidden&&dock\.hidden/);
  assert.match(source, /if\(state\.batch&&!document\.hidden\)progress\(\)/);
});

test('interactivity uses a slower idle polling cadence', () => {
  const source = fs.readFileSync('web/static/interactivity.js', 'utf8');
  assert.match(source, /pollActive\|\|rules\.some\(rule=>rule\.enabled\)/);
  assert.match(source, /idlePollTick%4===0/);
});
