const { test: base, expect, chromium } = require('@playwright/test');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
// The decoder ships with our pinned Playwright version; no extra dependency.
const { PNG } = require('playwright-core/lib/utilsBundle');

async function diagnoseCaptureDifference(page, first, second, label, boundary = page) {
  if (first.equals(second)) return;
  const a = PNG.sync.read(first), b = PNG.sync.read(second);
  if (a.width !== b.width || a.height !== b.height) {
    console.log('capture-difference', JSON.stringify({ label, dimensions: [[a.width, a.height], [b.width, b.height]] }));
    return;
  }
  let minX = a.width, minY = a.height, maxX = -1, maxY = -1, pixels = 0;
  const samples = [];
  for (let y = 0; y < a.height; y++) for (let x = 0; x < a.width; x++) {
    const offset = (y * a.width + x) * 4;
    if (a.data.subarray(offset, offset + 4).equals(b.data.subarray(offset, offset + 4))) continue;
    pixels++; minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    if (samples.length < 6 && (!samples.length || y - samples.at(-1).y > 8)) samples.push({ x, y });
  }
  if (!pixels) return;
  const region = boundary === page ? await page.evaluate(() => ({ x: 0, y: 0, width: innerWidth })) : await boundary.boundingBox();
  const metadata = await page.evaluate(({ samples, region, width }) => ({
    dpr: devicePixelRatio, fonts: document.fonts.status, platform: navigator.platform,
    activeElement: document.activeElement?.id,
    samples: samples.map(({ x, y }) => {
      const node = document.elementFromPoint(region.x + x * region.width / width, region.y + y * region.width / width);
      const style = node && getComputedStyle(node);
      return { x, y, tag: node?.tagName, id: node?.id, className: typeof node?.className === 'string' ? node.className : '', font: style?.font, animation: style?.animationName };
    }),
  }), { samples, region, width: a.width });
  console.log('capture-difference', JSON.stringify({ label, pixels, bounds: { minX, minY, maxX, maxY }, metadata }));
  // Only synthetic fixture pixels are captured. Keep log previews tiny and bounded.
  for (const [name, image] of [['first', a], ['second', b]]) {
    const crop = new PNG({ width: Math.min(64, a.width - minX), height: Math.min(64, a.height - minY) });
    PNG.bitblt(image, crop, minX, minY, crop.width, crop.height, 0, 0);
    const encoded = PNG.sync.write(crop).toString('base64');
    if (encoded.length <= 8192) console.log('capture-difference-crop', JSON.stringify({ label, name, x: minX, y: minY, pngBase64: encoded }));
  }
}

const root = path.resolve(__dirname, '../..');
// Read the backend's real allowlist without importing or starting the application.
const preferenceSource = fs.readFileSync(path.join(root, 'app/release_support.py'), 'utf8');
const preferenceDeclaration = preferenceSource.match(/PREFERENCE_KEYS = frozenset\('''([\s\S]*?)'''\.split\(\)\)/);
if (!preferenceDeclaration) throw new Error('Update the fixture parser for the production preference declaration.');
const preferenceKeys = preferenceDeclaration[1].trim().split(/\s+/).sort();
const seed = { 'tikreader.skin': 'original', 'tikreader.interfaceMode': '"advanced"',
  'tikreader.liveBadgeMotion': 'off' };

function resolveStaticAsset(urlPath) {
  let pathname;
  try { pathname = decodeURIComponent(urlPath); }
  catch { return null; }
  if (!pathname.startsWith('/static/')) return null;
  let relative = pathname.slice('/static/'.length);
  const base = relative.startsWith('icons/')
    ? path.join(root, 'assets/icons')
    : path.join(root, 'web/static');
  if (relative.startsWith('icons/')) relative = relative.slice('icons/'.length);
  const file = path.resolve(base, relative);
  const fromBase = path.relative(base, file);
  if (!fromBase || fromBase === '..' || fromBase.startsWith(`..${path.sep}`) || path.isAbsolute(fromBase)) return null;
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return null;
  return file;
}

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
    listenerCount(event) { return (listeners.get(event) || []).length; },
  };
  window.__operatorSocket = socket;
  window.io = () => socket;
})();`;

function apiResponse(url, credentialScenario = {}) {
  if (url === '/animation-studio') return { templates: [], connected: false, source_online: false, enabled_count: 0, muted: false };
  if (url === '/animation-studio/status') return { connected: false, source_online: false, enabled_count: 0, muted: false };
  if (url === '/animation-studio/media') return { files: [] };
  if (url === '/gift-catalog') return { gifts: [] };
  if (url === '/system/platform-credentials') return { storage: 'memory', platforms: credentialScenario.kickWebhookSecret
    ? [{ platform: 'kick', configured: true, webhook_path: `/kick/webhook/${credentialScenario.kickWebhookSecret}` }]
    : [] };
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
  operatorStartupScenario: [{}, { option: true }],
  operatorCredentialScenario: [{}, { option: true }],
  origin: [async ({}, use) => {
    const types = { '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png',
      '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
    const server = http.createServer((request, response) => {
      const file = resolveStaticAsset(new URL(request.url, 'http://localhost').pathname);
      if (!file) {
        response.writeHead(404); response.end(); return;
      }
      response.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
      fs.createReadStream(file).pipe(response);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    await use(`http://127.0.0.1:${server.address().port}`);
    await new Promise(resolve => server.close(resolve));
  }, { scope: 'worker' }],
  operator: async ({ origin, operatorStartupScenario, operatorCredentialScenario }, use, testInfo) => {
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
    const blocked = [], requests = [], errors = [], assetResponses = [], assetTransfers = [];
    const startupScenario = { ...operatorStartupScenario };
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
        const start = process.hrtime.bigint();
        await route.fulfill({ contentType: 'text/javascript', body: socketScript });
        assetTransfers.push({ pathname: url.pathname, status: 200, bytes: Buffer.byteLength(socketScript), elapsedMs: Number(process.hrtime.bigint() - start) / 1e6 });
        return;
      }
      if (url.pathname.startsWith('/static/')) {
        const asset = resolveStaticAsset(url.pathname);
        if (!asset) {
          await route.fulfill({ status: 404, body: 'Fixture asset not found.' }); return;
        }
        const start = process.hrtime.bigint();
        if (startupScenario.delayPath === url.pathname && startupScenario.delayMs) {
          await new Promise(resolve => setTimeout(resolve, startupScenario.delayMs));
        }
        if (startupScenario.failOncePath === url.pathname) {
          startupScenario.failOncePath = null;
          assetTransfers.push({ pathname: url.pathname, status: 503, bytes: 0, elapsedMs: Number(process.hrtime.bigint() - start) / 1e6 });
          await route.fulfill({ status: 503, body: 'Deterministic startup fixture failure.' }); return;
        }
        const body = fs.readFileSync(asset);
        assetResponses.push({ pathname: url.pathname, file: asset, status: 200 });
        await route.fulfill({ contentType: assetTypes[path.extname(asset)] || 'application/octet-stream', body });
        assetTransfers.push({ pathname: url.pathname, status: 200, bytes: body.byteLength, elapsedMs: Number(process.hrtime.bigint() - start) / 1e6 });
        return;
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
        ? { values: preferences, keys: preferenceKeys } : apiResponse(url.pathname, operatorCredentialScenario) });
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
    let navigation;
    const start = () => navigation ||= page.goto(origin);
    const signalBackendReady = async () => {
      await page.evaluate(() => window.__operatorSocket?.receive('connect'));
      await expect(page.locator('html')).toHaveAttribute('data-operator-boot-state', 'backend-ready');
    };
    if (!startupScenario.deferNavigation) {
      await start();
      await expect(page.locator('#operator-boot-status')).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('data-operator-boot-state', 'shell-ready');
      await expect(page.locator('#btn-connect')).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('data-skin', 'original');
      await expect(page.locator('.app-sidebar')).toBeAttached();
      await signalBackendReady();
      await expect(page.locator('#operator-boot-status')).toBeHidden();
    }
    const zoom = async factor => {
      const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
      return worker.evaluate(({ url, factor }) => globalThis.operatorZoom(url, factor), { url: page.url(), factor });
    };
    const captureOptions = () => ({ animations: 'disabled',
      mask: [page.locator('input[type="password"], #kick-client-id, #twitch-nickname')],
      maskColor: '#182330', caret: 'hide' });
    try { await use({ page, context, preferences, blocked, requests, errors, assetResponses, assetTransfers,
      start, signalBackendReady, zoom, captureOptions }); }
    finally {
      await testInfo.attach('fixture-requests', { body: JSON.stringify({ requests: requests.map(({path, method}) => ({path, method})), blocked, errors, assetTransfers }, null, 2), contentType: 'application/json' });
      await context.close();
      // Delete only this fixture's generated profile inside the authorized cache.
      if (!path.resolve(profile).startsWith(path.resolve(profiles) + path.sep)) {
        throw new Error('Refusing to remove a profile outside the operator runtime cache.');
      }
      fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
    }
  },
});

module.exports = { test, expect, diagnoseCaptureDifference };
