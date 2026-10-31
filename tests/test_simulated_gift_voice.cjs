const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

function setupStudio() {
  const elements = new Map(), spoken = [];
  const element = id => {
    if (!elements.has(id)) elements.set(id, {
      value: '', checked: false, options: [], textContent: '', type: 'text',
      events: {}, classList: {add() {}, remove() {}, toggle() {}}, style: {},
      addEventListener(name, fn) { this.events[name] = fn; },
      replaceChildren() { this.options = []; }, append() {}, querySelectorAll() { return []; },
      setAttribute() {}, removeAttribute() {}, focus() {},
    });
    return elements.get(id);
  };
  element('tts-rate').value = '1';
  element('tts-volume').value = '0.7';
  element('tts-read-name').checked = true;
  const speechSynthesis = {
    cancel() {}, pause() {}, resume() {},
    getVoices: () => [{voiceURI: 'local-es', name: 'Local español', lang: 'es-MX', localService: true}],
    addEventListener() {}, dispatchEvent() {}, speak: utterance => spoken.push(utterance),
  };
  const window = {speechSynthesis};
  const documentListeners = {};
  const document = {
    getElementById: element, createElement: () => element('created'), querySelectorAll: () => [],
    addEventListener(name, fn) { documentListeners[name] = fn; },
    dispatchEvent(event) { documentListeners[event.type]?.(event); },
  };
  vm.runInNewContext(fs.readFileSync('web/static/studio.js', 'utf8'), {
    window, speechSynthesis, SpeechSynthesisUtterance: function(text) { this.text = text; },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
    document, localStorage: {getItem: () => null, setItem() {}}, location: {origin: 'http://localhost'},
    setTimeout() {}, clearTimeout() {},
  });
  return {studio: window.Studio, element, spoken};
}

test('ordinary initial gift history stays silent while first simulated gift is read once', () => {
  const {studio, element, spoken} = setupStudio();
  element('tts-gifts-enabled').checked = true;
  element('tts-priority').value = 'gifts';
  element('alert-gift').value = '';
  element('alert-min').value = '1';

  const oldGift = {id: 'old', user: '@sender', gift: 'Rose', count: 1, simulated: false};
  studio.gifts({session: 'live-session', gifts: [oldGift]});
  assert.equal(spoken.length, 0);

  const newGift = {id: 'new', user: '@sender', gift: 'GG', count: 1, simulated: true, ongoing: false};
  studio.gifts({session: 'simulation-session', gifts: [newGift]});
  studio.gifts({session: 'simulation-session', gifts: [newGift]});
  const reads = studio.voiceSnapshot().log.filter(item => item.text === 'sender regaló una GG');
  assert.equal(reads.length, 1);
});
