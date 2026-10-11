const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const read = path => fs.readFileSync(path, 'utf8');
const template = read('web/templates/index.html');
const css = read('web/static/motion_system.css');
const js = read('web/static/motion_system.js');

test('the motion layer is loaded after authored themes', () => {
  assert.match(template, /motion_system\.css\?v=1/);
  assert.match(template, /motion_system\.js\?v=1/);
  assert(template.indexOf('theme_signature_collection.css') < template.indexOf('motion_system.css'));
});

test('motion supports reduced mode without animating busy telemetry', () => {
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /data-motion-level="reduced"/);
  assert.doesNotMatch(css, /animation: tr-(?:app|view|comment|metric|live|tally)/);
});

function motionHarness({ reduce = false } = {}) {
  class Node {
    constructor() {
      this.classes = new Set();
      this.dataset = {};
      this.classList = {
        contains: value => this.classes.has(value),
        add: value => this.classes.add(value),
        remove: value => this.classes.delete(value),
      };
      this.animations = [];
    }
    getAnimations() { return this.animations; }
    addEventListener() {}
    closest() { return this; }
    querySelectorAll() { return []; }
    matches(value) { return value === '.comment-card'; }
  }
  class Details extends Node { constructor() { super(); this.open = true; } }
  const body = new Node(), root = new Node(), feed = new Node(), metric = new Node();
  const view = new Node(), dot = new Node(), details = new Details();
  const observers = [], frames = [], events = {}, mediaEvents = {}, externalAnimations = [];
  const media = { matches: reduce, addEventListener: (name, fn) => { mediaEvents[name] = fn; } };
  const document = {
    body, documentElement: root,
    getElementById: id => id === 'comment-feed' ? feed : null,
    querySelector: selector => selector === '.live-columns' ? view : null,
    querySelectorAll: selector => selector === '.stat-value' ? [metric]
      : selector.includes('session-live-dot') ? [dot] : [details],
    getAnimations: () => [...dot.animations, ...details.animations, ...externalAnimations],
    addEventListener: (name, fn) => { events[name] = fn; },
  };
  const window = { addEventListener: (name, fn) => { events[name] = fn; } };
  vm.runInNewContext(js, {
    document, window, matchMedia: () => media, Element: Node, HTMLDetailsElement: Details,
    requestAnimationFrame: fn => { frames.push(fn); },
    MutationObserver: class {
      constructor(fn) { this.fn = fn; }
      observe(target, options) { observers.push({ target, options, fn: this.fn }); }
    },
  });
  const flush = () => { while (frames.length) frames.shift()(); };
  const mutate = target => observers.filter(o => o.target === target).forEach(o => o.fn([{target, addedNodes:[new Node()]}]));
  return { body, root, feed, metric, view, dot, details, observers, events, flush, mutate, externalAnimations,
    preference(value) { media.matches = value; mediaEvents.change?.({matches:value}); },
    animation(node) {
      const animation = { effect: {target:node}, cancelled:false, cancel() { this.cancelled = true; } };
      node.animations.push(animation);
      return animation;
    },
  };
}

test('busy chat, metrics and navigation do not replay surface animations', () => {
  const h = motionHarness();
  h.flush();
  for (let i = 0; i < 50; i++) {
    h.mutate(h.feed);
    h.metric.textContent = String(i);
    h.mutate(h.metric);
    h.events['tikreader:navigation-change']?.();
  }
  h.flush();
  assert.equal(h.observers.some(o => o.target === h.feed || o.target === h.metric), false);
  assert.equal(h.view.classes.size, 0);
  assert.equal(h.metric.classes.size, 0);
});

test('reduced preference changes invalidate queued disclosure effects and cancel active motion', () => {
  const h = motionHarness();
  h.flush();
  h.events.toggle({target:h.details});
  const animation = h.animation(h.details);
  h.preference(true);
  h.preference(false);
  h.flush();
  assert.equal(h.details.classes.has('motion-details-open'), false, 'stale frames do not restart motion');
  assert.equal(animation.cancelled, true);
  h.events.toggle({target:h.details});
  h.flush();
  assert.equal(h.details.classes.has('motion-details-open'), true, 'fresh deliberate disclosure works again');
});

test('OS, saved reduced mode and menu preference stop disclosure motion', () => {
  const h = motionHarness({reduce:true});
  h.events.toggle({target:h.details});
  h.flush();
  assert.equal(h.details.classes.has('motion-details-open'), false);
  h.preference(false);
  h.events.toggle({target:h.details});
  h.flush();
  h.root.dataset.motionLevel = 'reduced';
  h.mutate(h.root);
  assert.equal(h.details.classes.has('motion-details-open'), false);
  delete h.root.dataset.motionLevel;
  h.events.toggle({target:h.details});
  h.body.classList.add('menu-motion-reduced');
  h.mutate(h.body);
  h.flush();
  assert.equal(h.details.classes.has('motion-details-open'), false);
});

test('live tally stays steady even when presence creates a new Web Animation', () => {
  const h = motionHarness();
  const animation = h.animation(h.dot);
  h.body.dataset.liveState = 'live';
  h.mutate(h.body);
  assert.equal(animation.cancelled, true);
  const next = h.animation(h.dot);
  h.preference(true);
  assert.equal(next.cancelled, true);
});

test('motion safety does not cancel independent animations outside console chrome', () => {
  const h = motionHarness();
  const animation = {effect:{target:{closest:() => null}}, cancel() { this.cancelled = true; }};
  h.externalAnimations.push(animation);
  h.preference(true);
  assert.equal(animation.cancelled, undefined);
});

test('secondary support feedback does not defeat reduced motion or add another signature', () => {
  assert.match(css, /#donation-button:is\(:hover, :focus-visible\)[\s\S]*animation: none !important/);
  assert.match(css, /#donation-button::after[\s\S]*animation: none !important/);
});
