const { test: base, expect, chromium } = require('@playwright/test');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
// Read the backend's real allowlist without importing or starting the application.
const preferenceSource = fs.readFileSync(path.join(root, 'app/release_support.py'), 'utf8');
const preferenceDeclaration = preferenceSource.match(/PREFERENCE_KEYS = frozenset\('''([\s\S]*?)'''\.split\(\)\)/);
if (!preferenceDeclaration) throw new Error('Update the fixture parser for the production preference declaration.');
const preferenceKeys = preferenceDeclaration[1].trim().split(/\s+/).sort();
const seed = { 'tikreader.skin': 'original', 'tikreader.interfaceMode': '"advanced"',
  'tikreader.liveBadgeMotion': 'off' };

function template(preferences) {
  const include = name => fs.readFileSync(path.join(root, 'web/templates', name), 'utf8')
    .replace(/{% include '([^']+)' %}/g, (_, nested) => include(nested));
  const html = include('index.html')
    .replace(/{{ \{'values':[\s\S]*?\| tojson }}/, JSON.stringify({ values: preferences, keys: preferenceKeys }))
    .replace(/{{ app_version[^}]*}}/g, 'browser-fixture')
    .replace(/{{ 'true' if lan_enabled else 'false' }}/g, 'false')
    .replace(/{{ lan_view_token[^}]*}}/g, '');
  if (/{{|{%/.test(html)) throw new Error('Fixture must explicitly render every production template expression.');
  return html;
}

const socketScript = `(() => {
  const listeners = new Map();
  const socket = {
    connected: true, id: 'operator-fixture', sent: [],
    on(event, callback) { const rows = listeners.get(event) || []; rows.push(callback); listeners.set(event, rows); return this; },
    off(event, callback) { listeners.set(event, (listeners.get(event) || []).filter(row => row !== callback)); return this; },
    emit(event, payload) { this.sent.push({event, payload}); return this; },
    receive(event, payload) { for (const callback of listeners.get(event) || []) callback(payload); },
  };
  window.__operatorSocket = socket;
  window.io = () => socket;
})();`;

function apiResponse(url) {
  if (url === '/system/platform-credentials') return { storage: 'memory', platforms: [] };
  if (url === '/feed') return { comments: [], gifts: [], stats: { comments: 0, likes: 0, gifts: 0, viewers: 0, viewers_known: false } };
  if (url === '/system/voices') return { status: 'idle', ready: false, available: false };
  if (url === '/local-tts') return { available: false, voices: [], models: [] };
  if (url === '/interactivity') return { rules: [], serial: 0, effects: [], log: [], remaining: 0, running: false };
  if (url === '/production/state') return { revision: 0, scene: 'talk', emergency: false,
    hide_names: false, hide_photos: false, redact: false };
  // Optional studios receive empty, explicitly synthetic inventory/state.
  return { items: [], profiles: [], models: [], voices: [], participants: [], events: [],
    templates: [], markers: [], questions: [], prepared: [],
    history: [], settings: {}, state: {}, enabled: false, connected: false, available: false };
}

const test = base.extend({
  origin: [async ({}, use) => {
    const types = { '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png',
      '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
    const server = http.createServer((request, response) => {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const file = path.resolve(root, 'web', '.' + pathname);
      const staticRoot = path.join(root, 'web/static') + path.sep;
      if (!file.startsWith(staticRoot) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
        response.writeHead(404); response.end(); return;
      }
      response.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
      fs.createReadStream(file).pipe(response);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    await use(`http://127.0.0.1:${server.address().port}`);
    await new Promise(resolve => server.close(resolve));
  }, { scope: 'worker' }],
  operator: async ({ origin }, use, testInfo) => {
    const extension = path.join(__dirname, 'zoom-extension');
    const profiles = path.join(root, 'runtime/playwright-browsers/profiles');
    fs.mkdirSync(profiles, { recursive: true });
    const profile = fs.mkdtempSync(path.join(profiles, 'operator-'));
    const context = await chromium.launchPersistentContext(profile, {
      channel: 'chromium', headless: true, viewport: { width: 1280, height: 900 },
      deviceScaleFactor: 1, locale: 'es-MX', timezoneId: 'UTC',
      args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
    });
    const preferences = Object.fromEntries(Object.entries(seed).filter(([key]) => preferenceKeys.includes(key)));
    const blocked = [], requests = [], errors = [];
    const assetTypes = { '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png',
      '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
    // Context-level routing protects frames and new pages as well as the main tab.
    await context.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin !== origin) { blocked.push(url.href); await route.abort('blockedbyclient'); return; }
      if (url.pathname === '/') {
        await route.fulfill({ contentType: 'text/html', body: template(preferences) }); return;
      }
      if (url.pathname === '/static/vendor/socket.io/socket.io.min.js') {
        await route.fulfill({ contentType: 'text/javascript', body: socketScript }); return;
      }
      if (url.pathname.startsWith('/static/')) {
        const asset = path.resolve(root, 'web', '.' + decodeURIComponent(url.pathname));
        const staticRoot = path.join(root, 'web/static') + path.sep;
        if (!asset.startsWith(staticRoot) || !fs.existsSync(asset) || !fs.statSync(asset).isFile()) {
          await route.fulfill({ status: 404, body: 'Fixture asset not found.' }); return;
        }
        await route.fulfill({ contentType: assetTypes[path.extname(asset)] || 'application/octet-stream',
          body: fs.readFileSync(asset) }); return;
      }
      requests.push({ path: url.pathname, method: request.method(), body: request.postDataJSON() });
      if (url.pathname === '/system/preferences' && request.method() === 'POST') {
        const values = request.postDataJSON();
        if (Object.keys(values).some(key => !preferenceKeys.includes(key))) {
          await route.fulfill({ status: 400, json: { error: 'Ajustes inválidos.' } }); return;
        }
        for (const [key, value] of Object.entries(values)) {
          if (value === null) delete preferences[key];
          else preferences[key] = value;
        }
      }
      await route.fulfill({ json: url.pathname === '/system/preferences'
        ? { values: preferences, keys: preferenceKeys } : apiResponse(url.pathname) });
    });
    await context.addInitScript(seed => {
      // Seed only once: reloading must not overwrite preferences changed through the UI.
      for (const [key, value] of Object.entries(seed)) {
        if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
      }
      // Stable timestamps, not timer or layout emulation; production script order stays intact.
      const RealDate = Date;
      globalThis.Date = class extends RealDate {
        constructor(...args) { super(...(args.length ? args : ['2026-10-11T12:00:00Z'])); }
        static now() { return new RealDate('2026-10-11T12:00:00Z').getTime(); }
      };
    }, seed);
    const page = context.pages()[0];
    page.on('pageerror', error => errors.push(error.stack || error.message));
    await page.goto(origin);
    await expect(page.locator('html')).not.toHaveAttribute('data-ui-loading');
    await expect(page.locator('#btn-connect')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-skin', 'original');
    await page.evaluate(() => window.__operatorSocket.receive('connect'));
    await expect(page.locator('.app-sidebar')).toBeAttached();
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    const zoom = factor => worker.evaluate(({ url, factor }) => globalThis.operatorZoom(url, factor), { url: page.url(), factor });
    const captureOptions = () => ({ animations: 'disabled',
      mask: [page.locator('input[type="password"], #kick-client-id, #kick-webhook-path, #twitch-nickname')],
      maskColor: '#182330', caret: 'hide' });
    try { await use({ page, context, preferences, blocked, requests, errors, zoom, captureOptions }); }
    finally {
      await testInfo.attach('fixture-requests', { body: JSON.stringify({ requests: requests.map(({path, method}) => ({path, method})), blocked, errors }, null, 2), contentType: 'application/json' });
      await context.close();
      // Delete only this fixture's generated profile inside the authorized cache.
      if (!path.resolve(profile).startsWith(path.resolve(profiles) + path.sep)) {
        throw new Error('Refusing to remove a profile outside the operator runtime cache.');
      }
      fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
    }
  },
});

module.exports = { test, expect };
