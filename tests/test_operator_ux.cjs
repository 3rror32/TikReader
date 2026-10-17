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

function connection() {
  const elements = new Map(), handlers = new Map(), notifications = [], emitted = [];
  let focused = null;
  function element(id) {
    if (elements.has(id)) return elements.get(id);
    const attributes = new Map(), classes = new Set(), children = new Map();
    const node = {
      dataset: {}, style: {setProperty() {}}, textContent: '', value: '', hidden: false, disabled: false,
      classList: {
        contains: name => classes.has(name), add: name => classes.add(name), remove: name => classes.delete(name),
        toggle(name, force) { force ? classes.add(name) : classes.delete(name); },
      },
      set className(value) { classes.clear(); value.split(' ').filter(Boolean).forEach(name => classes.add(name)); },
      setAttribute: (key, value) => attributes.set(key, String(value)),
      getAttribute: key => attributes.get(key) ?? null,
      querySelector(selector) { if (!children.has(selector)) children.set(selector, element(`${id}/${selector}`)); return children.get(selector); },
      closest: () => element(`${id}/card`), addEventListener() {}, appendChild() {},
      focus() { focused = node; }, select() { node.selected = true; },
    };
    elements.set(id, node); return node;
  }
  const document = {body: element('body'), getElementById: element, addEventListener() {},
    querySelector: element, createElement: () => element('created'), hidden: false};
  const socket = {connected: true, on(name, callback) {
    if (!handlers.has(name)) handlers.set(name, []); handlers.get(name).push(callback);
  }, emit: (...args) => emitted.push(args)};
  const localeListeners = [];
  const window = {LiveExperience: {notify: text => notifications.push(text), attach() {}},
    addEventListener(name, callback) { if (name === 'tikreader:localechange') localeListeners.push(callback); }};
  const context = vm.createContext({window, document, io: () => socket,
    clearTimeout() {}, setTimeout() {}, setInterval() {}, URLSearchParams, AbortSignal});
  vm.runInContext(read('web/static/translations.js'), context);
  const presence = read('web/static/live_presence.js');
  const warning = presence.slice(presence.indexOf('  function syncWarning()'), presence.indexOf('  new MutationObserver(syncWarning)'));
  const state = presence.slice(presence.indexOf('  let mode ='), presence.indexOf('  // Preserve only collapsible'));
  vm.runInContext(`const $=id=>document.getElementById(id); const translate=value=>window.I18n?.t?.(value)||value; const warning=$('connection-inline-status');
    const hero=$('hero'),persistent=$('session-persistent'),persistentLabel=$('persistent-label'),activity=$('activity');
    function syncLiveLight(){};${warning}\n${state}
    window.LivePresence={attach,stats,requestStop:typeof requestStop==='function'?requestStop:undefined};`, context);
  const localeStart = presence.indexOf("  window.addEventListener('tikreader:localechange'");
  if (localeStart >= 0) vm.runInContext(presence.slice(localeStart, presence.indexOf('  return {diagnostics')), context);
  vm.runInContext(read('web/static/core_ui.js'), context);
  element('username-input').value = ' @Creator ';
  return {window, context, element, notifications, emitted,
    locale(locale) { window.I18n = {locale, t(source, values = {}) {
      const translated = window.TikReaderTranslations[locale]?.[source] || source;
      return translated.replace(/\{(\w+)\}/g, (match, name) => values[name] ?? match);
    }}; localeListeners.forEach(callback => callback()); },
    event(name, payload = {}) { for (const callback of handlers.get(name) || []) callback(payload); context.syncWarning(); },
    get focused() { return focused; },
  };
}

test('viewer telemetry stays unavailable until a valid measured count arrives', () => {
  const app = connection(); app.event('connected', {username: 'Creator'});
  const snapshot = {revision: 1, comments: 0, gifts: 0, likes: 0, viewers: 0, viewers_known: false};
  app.event('stats_update', snapshot);
  const value = app.element('stat-viewers');
  assert.equal(value.textContent, '—');
  assert.match(value.getAttribute('aria-label'), /[Ss]in datos|[Ee]sperando datos/);
  assert.doesNotMatch(value.getAttribute('aria-label'), /En cero|Espectadores: 0/);
  assert.equal(value.closest().dataset.valueState, 'pending');
  app.event('stats_update', {...snapshot, revision: 2, viewers_known: true});
  assert.equal(value.textContent, '0');
  assert.equal(value.closest().dataset.valueState, 'current');
  assert.match(value.getAttribute('aria-label'), /Espectadores: 0/);
  app.event('stats_update', {...snapshot, revision: 3, viewers: 7});
  assert.equal(value.textContent, '7', 'positive legacy counts remain measured data');
  app.event('stats_update', {...snapshot, revision: 4, viewers: null, viewers_known: true});
  assert.equal(value.textContent, '—', 'a known flag does not make an invalid value numeric');
});

test('active disconnect waits for confirmed backend closure', () => {
  const app = connection(); app.event('connecting', {username: 'Creator'});
  assert.equal(app.element('body').dataset.liveState, 'connecting');
  assert.match(app.element('status-bar').textContent, /Conectando/);
  app.event('connected', {username: 'Creator'});
  app.context.stopLive();
  assert.equal(app.element('btn-connect').dataset.connectionState, 'disconnecting');
  assert.match(app.element('status-bar').textContent, /Desconectando/);
  assert.deepEqual(app.emitted.map(args => args[0]), ['stop_live']);
  app.event('disconnected', {reason: 'Cerrando conexión'});
  assert.equal(app.element('btn-connect').dataset.connectionState, 'disconnecting', 'closing is not closed');
  app.event('disconnected', {reason: 'Detenido por el usuario'});
  assert.equal(app.element('btn-connect').dataset.connectionState, 'disconnected');
  assert.match(app.element('session-heading').textContent, /SIN CONEXIÓN|Listo para conectar/i);
  app.event('status', {connected: false, connecting: false});
  assert.equal(app.element('body').dataset.liveState, 'offline');
  app.event('disconnected', {reason: 'Conexión finalizada'});
  assert.equal(app.element('body').dataset.liveState, 'offline');
  app.event('connected', {username: 'Creator'}); app.context.stopLive();
  assert.equal(app.element('body').dataset.liveState, 'live');
  assert.equal(app.element('live-badge').classList.contains('visible'), true);
  assert.match(app.element('status-bar').textContent, /Desconectando/);
});

test('classified errors announce once, offer recovery, and preserve the username', () => {
  const app = connection(); app.event('connecting', {username: 'Creator'});
  const error = {code: 'INVALID_USERNAME', title: 'Usuario inválido', detail: 'Usa el usuario, no una URL.', suggestion: 'Revisa el nombre.'};
  app.event('tiktok_error', error);
  assert.equal(app.element('body').dataset.liveState, 'failed');
  const announcement = app.element('connection-error-announcement').textContent;
  assert.match(announcement, /Usuario inválido/);
  assert.match(announcement, /Revisa el nombre/);
  assert.equal(app.notifications.length, 0, 'classified errors do not also create a notification');
  assert.equal(app.element('error-recovery').textContent, 'Revisar usuario');
  assert.equal(app.element('username-input').value, ' @Creator ');
  app.context.recoverConnection();
  assert.equal(app.focused, app.element('username-input'));
  assert.equal(app.emitted.length, 0, 'invalid input needs review rather than a blind retry');
  app.context.hideError(); app.context.syncWarning();
  assert.equal(app.notifications.length, 0, 'closing the panel must not reannounce its error');
  app.event('disconnected', {reason: 'Conexión finalizada'});
  app.event('status', {connected: false, connecting: false});
  assert.equal(app.element('body').dataset.liveState, 'failed');
  app.event('tiktok_error', {...error, code: 'TIMEOUT'});
  assert.equal(app.element('error-recovery').textContent, 'Reintentar conexión');
  app.context.recoverConnection();
  assert.equal(app.emitted.at(-1)[0], 'start_live');
  assert.equal(app.emitted.at(-1)[1].username, 'Creator');
});

test('simple errors keep their existing single notification path and empty-state recovery', () => {
  const app = connection(); app.event('connected', {username: 'Creator'});
  assert.match(app.element('empty-state').querySelector('p').textContent, /Conexión lista/);
  app.event('error', {message: 'Red no disponible'});
  assert.equal(app.notifications.length, 1);
  assert.match(app.notifications[0], /Red no disponible/);
  assert.match(app.element('empty-state').querySelector('p').textContent, /Conecta/);
  app.context.syncWarning();
  assert.equal(app.notifications.length, 1, 'unchanged errors do not notify again');
});

test('classified error markup provides one dedicated live region and a keyboard recovery control', () => {
  const template = read('web/templates/index.html');
  assert.match(template, /id="connection-error-announcement"[^>]*role="alert"/);
  assert.match(template, /id="error-panel"[^>]*aria-labelledby="err-title"/);
  assert.match(template, /id="error-recovery"[^>]*type="button"/);
});

test('Control center uses the same vocabulary in navigation and contextual help', () => {
  assert.match(read('web/static/shell.js'), /"Centro de control"\s*,\s*"control-center"/);
  assert.doesNotMatch(read('web/static/shell.js'), /Automatizaciones[^\n]*control-center/);
  assert.match(read('web/static/navigation_help.js'), /'control-center': 'Centro de control:/);
});

test('idle status acknowledges cancellation and a new connection resets old viewer measurements', () => {
  const app = connection(); app.event('connecting', {username: 'Creator'});
  app.context.stopLive(); app.event('status', {connected: false, connecting: false});
  assert.deepEqual(app.emitted.map(args => args[0]), ['stop_live']);
  assert.equal(app.element('body').dataset.liveState, 'cancelled');
  assert.match(app.element('status-bar').textContent, /Conexión cancelada/);
  app.event('connected', {username: 'Creator'});
  app.event('stats_update', {revision: 1, viewers: 25, viewers_known: true});
  app.event('connecting', {username: 'NextCreator'});
  app.event('connected', {username: 'NextCreator'});
  assert.equal(app.element('stat-viewers').textContent, '—');
  assert.equal(app.element('stat-viewers').closest().dataset.valueState, 'pending');
});

test('connection names and metric availability remain localized without becoming live counters', () => {
  const app = connection(); app.locale('en'); app.event('connected', {username: 'Creator'});
  assert.equal(app.element('session-persistent').getAttribute('aria-label'), 'Connected to @Creator');
  app.event('stats_update', {revision: 1, viewers: 0, viewers_known: false});
  assert.match(app.element('stat-viewers').getAttribute('aria-label'), /Viewers: No data received/);
  assert.equal(app.element('stat-viewers').getAttribute('aria-live'), null);
  app.locale('fr');
  assert.equal(app.element('session-persistent').getAttribute('aria-label'), 'Connecté à @Creator');
  app.event('tiktok_error', {title: 'No se pudo conectar'});
  assert.equal(app.element('session-persistent').getAttribute('aria-live'), 'off');
});
