const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const template = read('web/templates/index.html');
const css = read('web/static/visual_refresh.css');
const personalities = read('web/static/theme_personalities.css');
const signatureCollection = read('web/static/theme_signature_collection.css');
const js = read('web/static/visual_refresh.js');
const presence = read('web/static/live_presence.js');
const liveButtonIcons = read('web/static/live_button_icons.js');
const production = read('web/static/production.js');
const liveColumns = read('web/static/live_columns.css');
const liveRefinement = read('web/static/live_refinement.css');

test('the studio loads the visual refresh while keeping the shared form contract authoritative', () => {
  assert.match(template, /visual_refresh\.css\?v=20261005-responsive-settings/);
  assert.match(template, /theme_personalities\.css\?v=2/);
  assert.match(template, /theme_signature_collection\.css\?v=menu-copy-2/);
  assert.match(template, /visual_refresh\.js\?v=operator-state-1/);
  assert(template.indexOf('visual_refresh.css') < template.indexOf('form_controls.css'));
  assert(template.indexOf('theme_personalities.css') < template.indexOf('form_controls.css'));
  assert(template.indexOf('theme_signature_collection.css') < template.indexOf('form_controls.css'));
});

test('automatic voice controls switch to a muted speaker icon when disabled', () => {
  assert.match(liveColumns, /auto-reading-toggle\[aria-pressed=['"]false['"]\]/);
  assert.match(liveColumns, /M16(?:%20|\s)9l5(?:%20|\s)5/);
});

test('comment actions stay visible, labeled, and wrap without splitting button text', () => {
  const commentDecoration = production.match(/function decorate\(card,data\)\{([\s\S]*?)\n function readComment/)?.[1] || '';
  assert.match(commentDecoration, /marker\.type\s*=\s*'button'/);
  assert.match(commentDecoration, /marker\.textContent\s*=\s*'Marcar momento'/);
  assert.match(commentDecoration, /translation\.type\s*=\s*'button'/);
  assert.match(commentDecoration, /translation\.textContent\s*=\s*'Traducir'/);
  assert.match(commentDecoration, /marker\.setAttribute\('data-live-label',\s*'true'\)/);
  assert.match(commentDecoration, /translation\.setAttribute\('data-live-label',\s*'true'\)/);
  assert.match(commentDecoration, /bar\.append\(marker,\s*translation\)/);
  assert.doesNotMatch(commentDecoration, /document\.createElement\(["']details["']\)/);
  assert.match(liveButtonIcons, /control\.hasAttribute\('data-live-label'\)\)\s*return/);
  assert.doesNotMatch(liveButtonIcons, /comment-actions summary/);
  assert.match(liveRefinement, /\.comment-card \.comment-actions\s*\{[^}]*display:\s*flex[^}]*align-items:\s*center[^}]*align-self:\s*flex-start[^}]*flex-wrap:\s*wrap/s);
  assert.match(liveRefinement, /html\[data-skin\] body \.live-columns \.comment-actions > button\[data-live-label\]\s*\{[^}]*white-space:\s*nowrap/);
  assert.doesNotMatch(liveRefinement, /\.comment-actions\s*>\s*details|\.comment-actions\s*>\s*details\[open\]/);
  assert.match(liveRefinement, /@media\s*\(pointer:\s*coarse\)[\s\S]*?\.live-columns \.comment-actions > button\s*\{[^}]*min-height:\s*44px/);
  assert.match(liveRefinement, /\.comment-actions > button:focus-visible\s*\{[^}]*outline/);
  assert.match(template, /live_refinement\.css\?v=usability-2/);
  assert.match(liveColumns, /html body \.live-columns \[data-live-icon\][\s\S]*?width:\s*36px[\s\S]*?height:\s*36px/);
});

test('desktop participant scrolling reserves space and stays inside a fixed panel', () => {
  assert.match(liveRefinement, /@media\s*\(min-width:\s*701px\) and \(max-width:\s*1279px\)\s*\{[\s\S]*?\.live-columns > \.participants-bar\s*\{[^}]*height:\s*560px[^}]*min-height:\s*560px[^}]*max-height:\s*560px/s);
  assert.match(liveRefinement, /\.live-columns \.participants-list\s*\{[^}]*overflow-y:\s*scroll[^}]*scrollbar-gutter:\s*stable[^}]*overscroll-behavior:\s*contain[^}]*overflow-anchor:\s*none/s);
});

test('operator recovery content fits the clipped feed and Swiss Brutalist keeps three desk tracks', () => {
  const feedRule = liveColumns.match(/\.live-columns #comment-feed\s*\{([^}]*)\}/)?.[1] || '';
  const emptyStateRule = css.match(/#empty-state\s*\{([^}]*)\}/)?.[1] || '';
  const swissDeskRule = signatureCollection.match(/html\[data-skin="swiss-brutalist"\] body \.live-columns\s*\{([^}]*)\}/)?.[1] || '';
  assert.match(feedRule, /min-height:\s*0/);
  assert.match(emptyStateRule, /height:\s*auto/);
  assert.match(emptyStateRule, /margin:\s*0\s+auto/);
  assert.match(emptyStateRule, /padding:\s*20px/);
  assert.match(swissDeskRule, /grid-template-columns:\s*minmax\(0,\s*1\.52fr\)\s+minmax\(0,\s*\.72fr\)\s+minmax\(0,\s*1fr\)/);
});

test('the disconnected desk has no colored metric pipes', () => {
  assert.match(css, /body:not\(\[data-live-state="live"\]\)[\s\S]*\.stat-card::before\s*{\s*display: none/);
  assert.match(presence, /const state = mode !== 'live' \? 'inactive' : pending \? 'pending'/);
});

test('warnings stay quieter than classified errors across the legacy skin cascade', () => {
  assert.match(css, /html\[data-skin\] body \.session-panel :is\(#status-bar\.warn, \.session-warning\)\s*\{[^}]*border-color: var\(--tr-divider\) !important[^}]*color: var\(--skin-text, var\(--tr-day\)\) !important/s);
  assert.match(css, /#error-panel\s*\{[^}]*var\(--skin-danger/s);
});

test('the refresh omits the four-stage signal strip while retaining live empty-state updates', () => {
  assert.doesNotMatch(js, /signal-route|signal-stage|stageDefinitions|stageNodes|syncSignalRoute|signalObserver|voiceIsOn/);
  assert.doesNotMatch(css, /\.signal-route|\.signal-stage|tr-signal-flow/);
  assert.doesNotMatch(template, /signal-route|signal-stage/);
  assert.match(js, /data-live-state/);
  assert.match(js, /function connectionState\(\)/);
  assert.match(js, /new MutationObserver\(enhanceEmptyState\)\.observe\(body/);
});

test('themes are curated without removing saved legacy choices', () => {
  assert.match(template, /optgroup label="Temas con personalidad"/);
  assert.match(template, /optgroup label="Cabinas recomendadas"/);
  assert.match(template, /optgroup label="Más temas"/);
  for (const value of ['broadcast-console', 'creator-pop', 'studio-rundown', 'terminal-crt', 'cyber-neumorph', 'swiss-brutalist', 'tactile-scrapbook', 'original', 'light', 'cute', 'dracula', 'glass', 'chromapulse']) {
    assert.match(template, new RegExp(`option value="${value}"`));
  }
});

test('each signature theme changes geometry, type and component composition', () => {
  for (const theme of ['broadcast-console', 'creator-pop', 'studio-rundown']) {
    assert.match(personalities, new RegExp(`data-skin="${theme}"`));
  }
  assert.match(personalities, /--control-field-radius: 2px/);
  assert.match(personalities, /--control-field-radius: 15px/);
  assert.match(personalities, /--control-field-radius: 0px/);
  assert.match(personalities, /\.comment-card:nth-child\(even\)/);
  assert.match(personalities, /content: "RUN OF SHOW"/);
  assert.match(personalities, /text-transform: uppercase/);
});

test('studio rundown sidebar keeps readable text across hover and keyboard focus', () => {
  assert.match(personalities, /--nav-ink: #fffdf7/);
  assert.match(personalities, /studio-rundown[\s\S]*data-section-nav\]:is\(:hover, :focus-visible\)/);
  assert.match(personalities, /summary:is\(:hover, :focus-visible\)[\s\S]*color: #fffdf7 !important/);
  assert.match(personalities, /sidebar-icon[\s\S]*color: currentColor !important/);
});

test('the second signature collection gives each theme its own material and layout language', () => {
  for (const theme of ['terminal-crt', 'cyber-neumorph', 'swiss-brutalist', 'tactile-scrapbook']) {
    assert.match(signatureCollection, new RegExp(`data-skin="${theme}"`));
  }
  assert.match(signatureCollection, /repeating-linear-gradient\(0deg/);
  assert.match(signatureCollection, /@keyframes tr-crt-cursor/);
  assert.match(signatureCollection, /inset 3px 3px 7px/);
  assert.match(signatureCollection, /grid-template-columns: 1\.7fr \.85fr 1\.1fr 1\.45fr/);
  assert.match(signatureCollection, /transform: rotate\(-\.7deg\)/);
  assert.match(signatureCollection, /prefers-reduced-motion: reduce/);
});

test('terminal CRT keeps sidebar copy in sentence case without a baud label', () => {
  assert.match(signatureCollection, /terminal-crt[^}]+\.app-sidebar \[data-section-nav\][\s\S]*?text-transform: none/);
  assert.match(signatureCollection, /terminal-crt[^}]+\.app-sidebar :is\(\.nav-section-label[\s\S]*?text-transform: none/);
  assert.doesNotMatch(signatureCollection, /TTY-01|9600 BAUD/);
});

test('mobile navigation, actionable empty states and reduced motion are present', () => {
  assert.match(js, /mobile-command-dock/);
  assert.match(js, /empty-state-action/);
  assert.match(js, /target: 'gifts', label: 'Regalos'/);
  assert.match(js, /menuOpen \? 'Cerrar' : 'Más'/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.doesNotMatch(css, /\.app > header #donation-button\s*\{\s*display:\s*none/);
  assert.match(liveButtonIcons, /control\.matches\('\.empty-state-action'\)/);
});

test('recommended themes are visible before the full legacy catalog', () => {
  assert.match(template, /class="skin-recommendations"/);
  assert.match(template, /data-skin-choice="original"/);
  assert.match(template, /class="skin-more settings-disclosure"/);
  assert.match(css, /\.skin-recommendations/);
});

test('settings groups keep a responsive gutter inside every theme treatment', () => {
  assert.match(css, /settings-stack > \.setting-card[\s\S]*padding: 24px clamp\(16px, 2vw, 24px\)/);
});

test('settings respond to their usable panel width without collapsing headings', () => {
  assert.match(css, /container-name: settings-stack/);
  assert.match(css, /\.skin-settings\s*\{\s*grid-template-columns: minmax\(280px, \.7fr\) minmax\(0, 1\.3fr\)/);
  assert.match(css, /@container settings-stack \(max-width: 860px\)[\s\S]*\.skin-settings\s*\{[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(css, /\.settings-group-title :is\(h3, p\)[^}]*word-break: normal/);
});

test('empty-state actions follow confirmed connection state and preserve recovery context', () => {
  const body = {dataset: {liveState: 'idle'}}, children = [];
  const paragraph = {children: [], querySelector: () => paragraph.children.find(node => node.tag === 'strong'),
    replaceChildren(...nodes) { this.children = nodes; }, append(...nodes) { this.children.push(...nodes); }};
  const empty = {dataset: {}, querySelector: selector => selector === 'p' ? paragraph : children[0],
    append: node => children.push(node)};
  let focused = false, actionWrites = 0;
  const document = {getElementById: id => id === 'empty-state' ? empty : {scrollIntoView() {}, focus() { focused = true; }},
    createTextNode: textContent => ({textContent}), createElement: tag => ({tag})};
  const context = vm.createContext({body, document, window: {}, translate: value => value,
    matchMedia: () => ({matches: true}),
    create: (tag, className, text) => ({tag, className,
      get textContent() { return text; },
      set textContent(value) { text = value; if (className === 'empty-state-action') actionWrites++; },
      addEventListener(_, fn) { this.click = fn; }})});
  vm.runInContext(js.slice(js.indexOf('  function connectionState()'), js.indexOf('  const feed =')), context);
  for (const [state, title, hidden] of [
    ['connecting','Conectando',true], ['reconnecting','Reconectando',true],
    ['live','Conexión lista',true], ['failed','No se pudo conectar',false],
    ['cancelled','Conexión cancelada',false], ['offline','Sin conexión',false],
  ]) {
    body.dataset.liveState = state; context.enhanceEmptyState();
    assert.equal(paragraph.children[0].textContent, title);
    assert.equal(children[0].hidden, hidden);
  }
  children[0].click(); assert.equal(focused, true);
  const before = actionWrites;
  context.enhanceEmptyState(); context.enhanceEmptyState();
  assert.equal(actionWrites, before, 'observer-driven presentation must converge without rewriting unchanged content');
});

test('status tone uses confirmed state rather than localized success-like substrings', () => {
  const body = {dataset: {}}, status = {dataset: {}, textContent: 'Desconectado.', classList: {contains: () => false}};
  const context = vm.createContext({status, connectionState: () => body.dataset.liveState});
  vm.runInContext(js.slice(js.indexOf('  function syncStatusTone()'), js.indexOf('  if (status) {')), context);
  for (const [state, expected] of [['idle','neutral'], ['cancelled','neutral'], ['connecting','pending'], ['reconnecting','pending'], ['live','success'], ['failed','error'], ['offline','error']]) {
    body.dataset.liveState = state; context.syncStatusTone(); assert.equal(status.dataset.tone, expected, state);
  }
});
