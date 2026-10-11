const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

// Execute the authored navigation and registration code with deterministic DOM/history ports.
function navigation(hash = '') {
  const frames = [], events = [], listeners = new Map();
  let focused = null;
  function node(label = '') {
    const attributes = new Map(), classes = new Set();
    return {
      textContent: label, hidden: false, dataset: {},
      classList: {
        add: value => classes.add(value), remove: value => classes.delete(value),
        contains: value => classes.has(value),
        toggle(value, force = !classes.has(value)) { force ? classes.add(value) : classes.delete(value); return force; },
      },
      setAttribute: (key, value) => attributes.set(key, String(value)),
      getAttribute: key => attributes.get(key) ?? null,
      hasAttribute: key => attributes.has(key), removeAttribute: key => attributes.delete(key),
      focus() { focused = this; }, getClientRects: () => [1],
      closest: () => null, scrollIntoView() {}, remove() {}, append() {}, click() {},
      querySelector: () => null, querySelectorAll: () => [],
    };
  }
  const view = label => {
    const pane = node(), title = node(label);
    pane.querySelector = selector => selector.includes('h2') ? title : null;
    pane.querySelectorAll = selector => selector.includes('h2') ? [title] : [];
    pane.title = title;
    return pane;
  };
  const views = new Map(['voice', 'workspace', 'overlay-gallery', 'custom-overlays', 'alerts', 'creator-suite'].map(key => [key, view(key)]));
  const keys = ['live', ...views.keys(), 'control-center', 'overlay-favorites', 'overlay-tools', 'overlay-custom', 'overlay-my-animations'];
  const buttons = keys.map(key => Object.assign(node(key), {dataset: {sectionNav: key}}));
  const sidebar = node();
  sidebar.querySelectorAll = () => buttons;
  sidebar.querySelector = selector => buttons.find(button => selector.includes(`"${button.dataset.sectionNav}"`)) || null;
  const live = view('Comments'), config = node(), heading = node(), toggle = node(), body = node();
  const location = {hash, pathname: '/', search: '?profile=operator'};
  const entries = [hash];
  let index = 0;
  function updateUrl(url) {
    assert.ok(url.startsWith('/?profile=operator#'), 'navigation preserves the current path and query');
    location.hash = url.slice(url.indexOf('#'));
  }
  const history = {
    pushState(_state, _title, url) { updateUrl(url); entries.splice(index + 1); entries.push(location.hash); index++; },
    replaceState(_state, _title, url) { updateUrl(url); entries[index] = location.hash; },
  };
  const window = {
    CreatorBridge: {open: tab => events.push({type: 'creator', detail: tab})},
    dispatchEvent: event => events.push(event),
    addEventListener(type, listener) { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(listener); },
  };
  const document = {
    body, createElement: () => heading, querySelector: () => node(), getElementById: () => node(),
    get activeElement() { return focused; },
  };
  const source = read('web/static/shell.js');
  const registration = source.slice(source.indexOf(' function add('), source.indexOf(' const panes='));
  const routing = source.slice(source.indexOf(' const heading='), source.indexOf(' const api='));
  const api = vm.runInNewContext(`${registration}\n${routing}\n({show,registerView})`, {
    document, window, location, history, views, sidebar, config, live, toggle,
    destinationLabels: new Map(keys.map(key => [key, key])), links: [], alertStudio: null,
    requestAnimationFrame: callback => frames.push(callback), matchMedia: () => ({matches: false}),
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
  });
  function flush() { while (frames.length) frames.shift()(); }
  function emit(type) { for (const listener of listeners.get(type) || []) listener(); }
  return {
    ...api, views, live, config, heading, toggle, body, buttons, location, entries, events, view, flush,
    get focused() { return focused; },
    focus(target) { target.focus(); },
    back() { if (index) location.hash = entries[--index]; emit('popstate'); emit('hashchange'); flush(); },
    forward() { if (index < entries.length - 1) location.hash = entries[++index]; emit('popstate'); emit('hashchange'); flush(); },
    hash(value) { location.hash = value; emit('hashchange'); flush(); },
  };
}

test('unknown and malformed hashes recover to Live and a canonical URL', () => {
  for (const hash of ['#missing-view', '#overlay-unknown', '#creator-unknown', '#%E0%A4%A', '#bad"selector']) {
    const app = navigation(hash); app.flush();
    assert.equal(app.live.hidden, false, hash);
    assert.equal(app.config.hidden, true, hash);
    assert.equal(app.location.hash, '#live', hash);
    assert.equal(app.entries.length, 1, 'recovery replaces rather than adds history');
    assert.equal(app.focused, null, 'recovery on load must not steal focus');
  }
});

test('navigation updates history, Back/Forward restore screens, and refresh restores the route', () => {
  const app = navigation(); app.flush();
  app.show('voice'); app.flush();
  app.show('workspace'); app.flush();
  app.show('workspace'); app.flush();
  assert.deepEqual(app.entries, ['#live', '#voice', '#workspace']);
  app.back();
  assert.equal(app.location.hash, '#voice');
  assert.equal(app.views.get('voice').hidden, false);
  assert.equal(app.events.filter(event => event.type === 'tikreader:navigation-change').length, 5, 'one event per traversal even when both browser events fire');
  app.forward();
  assert.equal(app.location.hash, '#workspace');
  assert.equal(app.views.get('workspace').hidden, false);
  const refreshed = navigation(app.location.hash); refreshed.flush();
  assert.equal(refreshed.views.get('workspace').hidden, false);
  assert.equal(refreshed.focused, null);
});

test('external hash changes restore a valid route and recover invalid routes', () => {
  const app = navigation(); app.flush();
  app.hash('#voice');
  assert.equal(app.views.get('voice').hidden, false);
  app.hash('#does-not-exist');
  assert.equal(app.live.hidden, false);
  assert.equal(app.location.hash, '#live');
});

test('overlay aliases preserve their URL and dispatch the intended destination', () => {
  for (const [key, target, section] of [
    ['overlay-gallery', 'overlay-gallery', 'favorites'],
    ['overlay-tools', 'overlay-gallery', 'tools'],
    ['fortune-wheel', 'overlay-gallery', 'tools'],
    ['point-drop', 'overlay-gallery', 'tools'],
    ['overlay-custom', 'custom-overlays'],
    ['animation-studio', 'alerts'],
    ['overlay-my-animations', 'alerts'],
  ]) {
    const app = navigation(`#${key}`); app.flush();
    assert.equal(app.location.hash, `#${key}`);
    assert.equal(app.views.get(target).hidden, false, key);
    if (section) assert.ok(app.events.some(event => event.type === 'tikreader:open-overlay-section' && event.detail.section === section));
  }
});

test('creator subroutes retain their tab and activate the Preparar destination', () => {
  const app = navigation('#creator-calendar'); app.flush();
  assert.equal(app.views.get('creator-suite').hidden, false);
  assert.equal(app.location.hash, '#creator-calendar');
  assert.ok(app.events.some(event => event.type === 'creator' && event.detail === 'calendar'));
  assert.equal(app.buttons.find(button => button.dataset.sectionNav === 'creator-suite').getAttribute('aria-current'), 'page');
});

test('late registered screens restore requested routes without stealing initial focus', () => {
  const app = navigation('#control-center'); app.flush();
  assert.equal(app.location.hash, '#control-center');
  assert.equal(app.live.hidden, false, 'keep a usable screen until registration');
  const pane = app.view('Control center');
  app.registerView('control-center', pane); app.flush();
  assert.equal(pane.hidden, false);
  assert.equal(app.live.hidden, true);
  assert.equal(app.focused, null);
  app.show('voice'); app.flush();
  const replacement = app.view('Updated control center');
  app.registerView('control-center', replacement); app.flush();
  assert.equal(replacement.hidden, true, 'registration must not interrupt another route');
});

test('deliberate navigation focuses the destination heading and closes the mobile menu', () => {
  const app = navigation('#voice'); app.flush();
  assert.equal(app.focused, null, 'initial route must not take focus');
  app.focus(app.toggle); app.body.classList.add('menu-open');
  app.show('workspace'); app.flush();
  assert.equal(app.focused, app.views.get('workspace').title);
  assert.equal(app.focused.getAttribute('tabindex'), '-1');
  assert.equal(app.body.classList.contains('menu-open'), false);
  app.show('live'); app.flush();
  assert.equal(app.focused, app.live.title);
});

test('pending deliberate navigation focuses once registered but cancelled routes stay cancelled', () => {
  const app = navigation(); app.flush();
  app.show('control-center'); app.flush();
  const pane = app.view('Control center');
  app.registerView('control-center', pane); app.flush();
  assert.equal(app.focused, pane.title);
  const cancelled = navigation('#control-center'); cancelled.flush();
  cancelled.show('workspace'); cancelled.flush();
  cancelled.registerView('control-center', cancelled.view('Control center')); cancelled.flush();
  assert.equal(cancelled.views.get('workspace').hidden, false);
});

test('rapid navigation does not deliver stale focus or overlay effects', () => {
  const app = navigation(); app.flush();
  app.show('fortune-wheel'); app.show('workspace'); app.flush();
  assert.equal(app.focused, app.views.get('workspace').title);
  assert.equal(app.events.filter(event => event.type === 'tikreader:open-overlay').length, 0);
});

test('screens without a visible heading use the named shell heading', () => {
  const app = navigation(); app.flush();
  app.views.get('creator-suite').querySelectorAll = () => [];
  app.show('creator-scenes'); app.flush();
  assert.equal(app.focused, app.heading);
  assert.equal(app.heading.getAttribute('role'), 'heading');
  assert.equal(app.heading.getAttribute('aria-level'), '2');
  assert.equal(app.heading.textContent, 'creator-suite');
});

test('registered extension screens are addressable and replacing the current view keeps it visible', () => {
  const app = navigation(); app.flush();
  const pane = app.view('Extension');
  app.registerView('extension-screen', pane); app.flush();
  assert.equal(pane.hidden, true);
  app.show('extension-screen'); app.flush();
  assert.equal(pane.hidden, false);
  assert.equal(app.location.hash, '#extension-screen');
  const replacement = app.view('Replacement');
  app.registerView('extension-screen', replacement); app.flush();
  assert.equal(replacement.hidden, false);
});

test('mobile navigation leaves destination focus alone while dismissal restores the menu toggle', () => {
  const source = read('web/static/sidebar.js');
  const close = source.slice(source.indexOf('  function closeMobile()'), source.indexOf('  const tooltip ='));
  assert.match(close, /toggle\.focus\(\)/);
  const click = source.slice(source.indexOf("  sidebar.addEventListener('click'"), source.indexOf("  document.addEventListener('keydown'"));
  assert.doesNotMatch(click, /toggle\.focus\(\)/);
});
