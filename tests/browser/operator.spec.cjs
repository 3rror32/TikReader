const { test, expect } = require('./fixtures.cjs');
const fs = require('node:fs');
const path = require('node:path');

const themes = ['original', 'broadcast-console', 'creator-pop', 'studio-rundown',
  'terminal-crt', 'cyber-neumorph', 'swiss-brutalist', 'tactile-scrapbook', 'kawai',
  'dark', 'light', 'cute', 'dracula', 'ice', 'one-dark-pro', 'github-dark', 'monokai',
  'glass', 'aetheria', 'cloudfoam', 'monolith', 'chromapulse'];
const representative = ['original', 'light', 'dark', 'broadcast-console',
  'creator-pop', 'swiss-brutalist', 'tactile-scrapbook'];

async function navigate(page, key, keyboard = false) {
  if (await page.locator('.app-sidebar').evaluate(node => node.inert)) {
    const headerMenu = page.locator('#menu-toggle');
    const menu = await headerMenu.isVisible() ? headerMenu : page.locator('[data-mobile-target="more"]');
    await menu.click();
  }
  const destination = page.locator(`[data-section-nav="${key}"]`);
  const group = page.locator(`details:has([data-section-nav="${key}"])`).first();
  if (await group.count() && !(await group.evaluate(node => node.open))) await group.locator('summary').first().click();
  if (keyboard) {
    await expect(page.locator('.app-sidebar')).not.toHaveAttribute('inert');
    await destination.focus();
    await expect(destination).toBeFocused();
    await page.keyboard.press('Enter');
  }
  else await destination.click();
  await expect(page).toHaveURL(new RegExp(`#${key}$`));
}

async function chooseTheme(page, theme) {
  await navigate(page, 'workspace');
  const disclosure = page.locator('details:has(#skin-select)').last();
  if (!(await disclosure.evaluate(node => node.open))) await disclosure.locator('summary').first().click();
  await page.locator('#skin-select').selectOption(theme);
  await expect(page.locator('html')).toHaveAttribute('data-skin', theme);
}

async function classifiedError(operator, code = 'INVALID_USERNAME') {
  const input = operator.page.locator('#username-input');
  if (await input.isVisible() && await input.isEnabled()) await input.fill('fixture_operator');
  await operator.page.evaluate(code => window.__operatorSocket.receive('tiktok_error', {
    code, title: 'No se pudo conectar', detail: 'El usuario necesita revisión.',
    suggestion: 'Revisa el usuario e inténtalo de nuevo.',
  }), code);
  await expect(operator.page.locator('#error-panel')).toBeVisible();
}

async function reachable(locator) {
  await locator.scrollIntoViewIfNeeded();
  await expect(locator).toBeVisible();
  await expect(locator).toBeEnabled();
  const bounds = await locator.evaluate(node => {
    const box = node.getBoundingClientRect();
    return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: innerWidth, height: innerHeight };
  });
  expect(bounds.left).toBeGreaterThanOrEqual(0);
  expect(bounds.right).toBeLessThanOrEqual(bounds.width + 1);
  expect(bounds.top).toBeGreaterThanOrEqual(0);
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.height + 1);
}

test('production template boots in isolation', async ({ operator }) => {
  const logo = operator.page.locator('.logo-icon img');
  const productionLogo = path.resolve(__dirname, '../../assets/icons/tikreader-192.png');
  expect(fs.existsSync(productionLogo)).toBe(true);
  await expect(logo).toHaveAttribute('src', '/static/icons/tikreader-192.png');
  await expect.poll(() => logo.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
  await expect.poll(() => operator.assetResponses.some(asset => asset.pathname === '/static/icons/tikreader-192.png'
    && asset.file === productionLogo && asset.status === 200)).toBe(true);
  await expect(operator.page.getByRole('button', { name: 'Conectar', exact: true })).toBeVisible();
  const { page } = operator;
  const staticMounts = await page.evaluate(() => ['voice', 'filters', 'alerts-local', 'history', 'workspace', 'diagnostics', 'obs']
    .map(key => [key, document.querySelectorAll(`[data-view-mount="${key}"]`).length]));
  expect(staticMounts).toEqual(['voice', 'filters', 'alerts-local', 'history', 'workspace', 'diagnostics', 'obs']
    .map(key => [key, 1]));
  for (const route of ['voice', 'filters', 'alerts', 'history', 'workspace', 'diagnostics', 'obs']) {
    await page.evaluate(key => window.Shell.show(key, { history: 'none', focus: false }), route);
    expect(await page.locator('.config-content').evaluate(node => [...node.children].filter(child => !child.hidden).length), route)
      .toBe(1);
  }
  await page.locator('[data-view-mount="filters"] h2').evaluate(node => { node.textContent = 'Copy changed without changing ownership'; });
  await page.evaluate(() => window.Shell.show('filters', { history: 'none', focus: false }));
  await expect(page.locator('.config-content > [data-view-mount="filters"]')).toBeVisible();
  await expect(page.locator('[data-view-mount="filters"] h2')).toHaveText('Copy changed without changing ownership');
  await page.evaluate(() => {
    window.__creatorFrame = document.querySelector('[data-section="creator-suite"] iframe');
    window.__microphoneRoot = document.querySelector('[data-section="microphone-captions"]');
  });
  await page.evaluate(() => window.Shell.show('creator-suite', { history: 'none', focus: false }));
  await page.evaluate(() => window.Shell.show('live', { history: 'none', focus: false }));
  await page.evaluate(() => window.Shell.show('creator-suite', { history: 'none', focus: false }));
  await page.evaluate(() => window.Shell.show('microphone-captions', { history: 'none', focus: false }));
  await page.evaluate(() => window.Shell.show('live', { history: 'none', focus: false }));
  await page.evaluate(() => window.Shell.show('microphone-captions', { history: 'none', focus: false }));
  expect(await page.evaluate(() => window.__creatorFrame === document.querySelector('[data-section="creator-suite"] iframe')
    && document.querySelectorAll('[data-section="creator-suite"] iframe').length === 1
    && window.__microphoneRoot === document.querySelector('[data-section="microphone-captions"]')
    && document.querySelectorAll('[data-section="microphone-captions"]').length === 1)).toBe(true);
  await page.evaluate(() => window.Shell.show('live', { history: 'none', focus: false }));
  // Compare loaded tags with the recursively rendered production template's order.
  const production = fs.readFileSync(path.resolve(__dirname, '../../web/templates/index.html'), 'utf8');
  const authored = [...production.matchAll(/<script[^>]+src="([^"]+)"/g)].map(match => match[1]);
  const loaded = await operator.page.locator('script[src]').evaluateAll(nodes => nodes.map(node => node.getAttribute('src')));
  expect(loaded.filter(src => authored.includes(src))).toEqual(authored);
  expect(operator.errors).toEqual([]);
  // Prove the route boundary, including a child frame and a newly opened tab.
  await operator.page.evaluate(() => fetch('https://example.invalid/operator-probe').catch(() => null));
  const extra = await operator.context.newPage();
  await extra.goto('https://example.invalid/popup-probe').catch(() => null);
  await extra.close();
  await operator.page.evaluate(() => { const frame = document.createElement('iframe'); frame.src = 'https://example.invalid/frame-probe'; document.body.append(frame); });
  await expect.poll(() => operator.blocked.filter(url => url.startsWith('https://example.invalid/')).length).toBe(3);
});

test('keyboard navigation restores history and destination focus without initial theft', async ({ operator }) => {
  const { page } = operator;
  expect(await page.evaluate(() => document.activeElement.tagName)).toBe('BODY');
  await navigate(page, 'workspace', true);
  await expect(page.locator(':focus')).toHaveAttribute('tabindex', '-1');
  expect(await page.locator(':focus').evaluate(node => /H[123]/.test(node.tagName))).toBe(true);
  await navigate(page, 'live', true);
  await page.goBack();
  await expect(page).toHaveURL(/#workspace$/);
  await page.goForward();
  await expect(page).toHaveURL(/#live$/);
  await page.reload();
  await expect(page.locator('[data-section-nav="live"]')).toHaveAttribute('aria-current', 'page');
  await page.goto(new URL('/#unknown-screen', page.url()).href);
  await expect(page).toHaveURL(/#live$/);
});

test('all 22 themes retain named controls, focus, and reload-persistent preferences', async ({ operator }) => {
  test.setTimeout(120000);
  const { page, signalBackendReady } = operator;
  expect(await page.locator('#skin-select option').evaluateAll(nodes => nodes.map(node => node.value).sort())).toEqual([...themes].sort());
  for (const theme of themes) {
    await test.step(theme, async () => {
      await chooseTheme(page, theme);
      await expect(page.getByRole('combobox', { name: 'Tema de la cabina' })).toHaveValue(theme);
      await page.reload();
      await signalBackendReady();
      await expect(page.locator('html')).toHaveAttribute('data-skin', theme);
      await navigate(page, 'live');
      const input = page.getByRole('textbox', { name: 'Usuario de TikTok', exact: true });
      await input.focus();
      await page.keyboard.press('Tab');
      await expect(page.getByRole('button', { name: 'Conectar', exact: true })).toBeFocused();
      const focus = await page.locator(':focus').evaluate(node => {
        const css = getComputedStyle(node);
        return { outline: parseFloat(css.outlineWidth), style: css.outlineStyle, size: parseFloat(css.fontSize) };
      });
      expect(focus.outline).toBeGreaterThanOrEqual(2);
      expect(focus.style).not.toBe('none');
      expect(focus.size).toBeGreaterThanOrEqual(12);
    });
  }
  await expect.poll(() => operator.preferences['tikreader.skin']).toBe('chromapulse');
  expect(operator.errors).toEqual([]);
});

test('one connection control handles disconnected, connecting, connected and disconnecting states', async ({ operator }) => {
  const { page } = operator;
  const input = page.locator('#username-input');
  const control = page.locator('#btn-connect');
  await input.fill('fixture_operator');

  await expect(control).toHaveAccessibleName('Conectar');
  await expect(control).toHaveAttribute('aria-busy', 'false');
  await expect(control).toHaveAttribute('data-connection-state', 'disconnected');
  await expect(page.locator('#btn-stop')).toBeHidden();
  await control.focus();
  await control.click();
  await expect(control).toBeFocused();
  await expect(control).toHaveAccessibleName('Conectando…');
  await expect(control).toHaveAttribute('aria-busy', 'true');
  await expect(control).toHaveAttribute('aria-disabled', 'true');
  await expect(control).toHaveAttribute('data-connection-state', 'connecting');
  await expect(page.locator('#btn-stop')).toBeHidden();
  await control.evaluate(node => node.click());
  expect(await page.evaluate(() => window.__operatorSocket.sent.filter(item => item.event === 'start_live').length)).toBe(1);

  await page.evaluate(() => window.__operatorSocket.receive('connected', { username: 'fixture_operator' }));
  await expect(control).toHaveAccessibleName('Desconectar');
  await expect(control).toBeEnabled();
  await expect(control).toHaveAttribute('aria-busy', 'false');
  await expect(control).toHaveAttribute('data-connection-state', 'connected');
  await expect(page.locator('#btn-stop')).toBeHidden();
  await control.click();
  await expect(control).toHaveAccessibleName('Desconectando…');
  await expect(control).toHaveAttribute('aria-busy', 'true');
  await expect(control).toHaveAttribute('aria-disabled', 'true');
  await expect(control).toHaveAttribute('data-connection-state', 'disconnecting');
  expect(await page.evaluate(() => window.__operatorSocket.sent.filter(item => item.event === 'stop_live').length)).toBe(1);
  await page.evaluate(() => window.__operatorSocket.receive('disconnected', { reason: 'Detenido por el usuario' }));
  await expect(control).toHaveAccessibleName('Conectar');
  await expect(control).toHaveAttribute('data-connection-state', 'disconnected');
});

test('connection intent, unknown viewers, confirmed zero and single classified announcement', async ({ operator }) => {
  const { page } = operator;
  const username = page.getByRole('textbox', { name: 'Usuario de TikTok', exact: true });
  await expect(page.locator('#stat-viewers')).toHaveText('—');
  await username.fill('fixture_operator');
  await username.press('Enter');
  // A pending button reports the request; confirmed session state comes from Socket.IO.
  await expect(page.locator('body')).toHaveAttribute('data-live-state', 'idle');
  await page.evaluate(() => window.__operatorSocket.receive('connecting', { username: 'fixture_operator' }));
  await expect(page.locator('body')).toHaveAttribute('data-live-state', 'connecting');
  await expect(page.locator('#btn-connect')).toHaveAttribute('aria-disabled', 'true');
  expect(await page.evaluate(() => window.__operatorSocket.sent.filter(item => item.event === 'start_live')))
    .toEqual([{ event: 'start_live', payload: { username: 'fixture_operator' } }]);
  await page.evaluate(() => window.__operatorSocket.receive('connected', { username: 'fixture_operator' }));
  await expect(page.locator('body')).toHaveAttribute('data-live-state', 'live');
  await page.evaluate(() => window.__operatorSocket.receive('stats_update', { comments: 0, likes: 0, gifts: 0, viewers: 0, viewers_known: true }));
  await expect(page.locator('#stat-viewers')).toHaveText('0');
  await page.evaluate(() => {
    window.__announcements = [];
    new MutationObserver(() => window.__announcements.push(document.querySelector('#connection-error-announcement').textContent))
      .observe(document.querySelector('#connection-error-announcement'), { childList: true, subtree: true, characterData: true });
  });
  await classifiedError(operator);
  const alert = page.getByRole('alert').filter({ hasText: 'El usuario necesita revisión.' });
  await expect(alert).toHaveCount(1);
  await expect(alert).toHaveAttribute('aria-atomic', 'true');
  await classifiedError(operator);
  expect(await page.evaluate(() => window.__announcements)).toEqual([
    'No se pudo conectar. El usuario necesita revisión.. Revisa el usuario e inténtalo de nuevo.',
  ]);
  await expect(page.locator('body')).toHaveAttribute('data-live-state', 'failed');
  await page.getByRole('button', { name: 'Revisar usuario', exact: true }).click();
  await expect(username).toBeFocused();
  await expect(username).toHaveValue('fixture_operator');
});

test('changed reduced-motion preference cancels active motion and survives reload', async ({ operator }) => {
  const { page } = operator;
  await navigate(page, 'workspace');
  await page.locator('#motion-level-select').selectOption('expressive');
  await page.evaluate(() => {
    const target = document.querySelector('.app');
    window.__testMotion = target.animate([{ opacity: 1 }, { opacity: .9 }], { duration: 60000, iterations: Infinity });
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => page.evaluate(() => window.__testMotion.playState)).toBe('idle');
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.locator('#motion-level-select').selectOption('reduced');
  await expect(page.locator('body')).toHaveClass(/menu-motion-reduced/);
  await page.reload();
  await expect(page.locator('#motion-level-select')).toHaveValue('reduced');
  await expect(page.locator('body')).toHaveClass(/menu-motion-reduced/);
});

test('mobile keyboard navigation closes the menu without replacing destination focus', async ({ operator }) => {
  const { page, signalBackendReady } = operator;
  await page.setViewportSize({ width: 360, height: 640 });
  await signalBackendReady();
  await navigate(page, 'workspace', true);
  await expect(page.locator('body')).not.toHaveClass(/menu-open/);
  await expect(page.locator('#menu-toggle')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator(':focus')).toHaveAttribute('tabindex', '-1');
  expect(await page.locator(':focus').evaluate(node => /H[123]/.test(node.tagName))).toBe(true);
  await expect(page.locator('#menu-toggle')).not.toBeFocused();
  await navigate(page, 'live', true);
  await expect(page.locator('body')).not.toHaveClass(/menu-open/);
});

for (const code of ['NOT_LIVE', 'NETWORK_ERROR']) {
  test(`${code}: classified recovery retries the unchanged username`, async ({ operator }) => {
    const { page } = operator;
    await classifiedError(operator, code);
    await expect(page.getByRole('alert').filter({ hasText: 'El usuario necesita revisión.' })).toHaveCount(1);
    const recovery = page.getByRole('button', { name: 'Reintentar conexión', exact: true });
    await recovery.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#username-input')).toHaveValue('fixture_operator');
    expect(await page.evaluate(() => window.__operatorSocket.sent.filter(item => item.event === 'start_live')))
      .toEqual([{ event: 'start_live', payload: { username: 'fixture_operator' } }]);
    await expect(page.locator('#btn-connect')).toBeDisabled();
    await expect(page.locator('#connection-error-announcement')).toBeEmpty();
  });
}

for (const theme of representative) {
  test(`${theme}: visual baseline, narrow/short recovery, genuine browser zoom`, async ({ operator }, testInfo) => {
    const { page } = operator;
    await chooseTheme(page, theme);
    await navigate(page, 'live');
    for (const viewport of [{ width: 360, height: 640 }, { width: 960, height: 360 }]) {
      await page.setViewportSize(viewport);
      await classifiedError(operator);
      const recovery = page.getByRole('button', { name: 'Revisar usuario', exact: true });
      await reachable(recovery);
      await recovery.focus();
      await page.keyboard.press('Enter');
      await expect(page.locator('#username-input')).toBeFocused();
      await expect(page.locator('#username-input')).toHaveValue('fixture_operator');
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    const before = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio }));
    const zoom = await operator.zoom(2);
    expect(zoom.factor).toBe(2);
    expect(zoom.settings).toMatchObject({ mode: 'automatic', scope: 'per-tab' });
    await expect.poll(() => page.evaluate(() => innerWidth)).toBe(before.width / 2);
    expect(await page.evaluate(() => innerHeight)).toBe(before.height / 2);
    expect(await page.evaluate(() => devicePixelRatio)).toBe(before.dpr * 2);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).zoom)).toBe('1');
    // Preserve a 1280x900 CSS viewport while native zoom remains 200% so the
    // reviewed screenshot shows the same desktop layout at twice the pixel scale.
    await page.setViewportSize({ width: 2560, height: 1800 });
    const captureZoom = await operator.zoom(2);
    expect(captureZoom.factor).toBe(2);
    await expect.poll(() => page.evaluate(() => innerWidth)).toBe(before.width);
    expect(await page.evaluate(() => innerHeight)).toBe(before.height);
    expect(await page.evaluate(() => devicePixelRatio)).toBe(before.dpr * 2);
    await page.evaluate(() => window.scrollTo(0, 0));
    await classifiedError(operator);
    const recovery = page.getByRole('button', { name: 'Revisar usuario', exact: true });
    await expect(page.locator('#error-panel')).toBeVisible();
    await expect(recovery).toBeVisible();
    const panel = await page.locator('.session-panel').boundingBox();
    const action = await recovery.boundingBox();
    const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
    expect(panel).not.toBeNull();
    expect(action).not.toBeNull();
    expect(panel.x).toBeGreaterThanOrEqual(0);
    expect(panel.x + panel.width).toBeLessThanOrEqual(viewport.width);
    expect(panel.y).toBeGreaterThanOrEqual(0);
    expect(panel.y + panel.height).toBeLessThanOrEqual(viewport.height);
    expect(action.x).toBeGreaterThanOrEqual(0);
    expect(action.x + action.width).toBeLessThanOrEqual(viewport.width);
    expect(action.y).toBeGreaterThanOrEqual(0);
    expect(action.y + action.height).toBeLessThanOrEqual(viewport.height);
    expect(action.width).toBeGreaterThan(0);
    expect(action.height).toBeGreaterThan(0);
    const bounds = await page.evaluate(() => {
      const panel = document.querySelector('.session-panel').getBoundingClientRect();
      return { panel: { left: panel.left, right: panel.right, top: panel.top, bottom: panel.bottom },
        viewport: { width: innerWidth, height: innerHeight } };
    });
    expect(bounds.panel.left).toBeGreaterThanOrEqual(0);
    expect(bounds.panel.right).toBeLessThanOrEqual(bounds.viewport.width);
    expect(bounds.panel.top).toBeGreaterThanOrEqual(0);
    expect(bounds.panel.bottom).toBeLessThanOrEqual(bounds.viewport.height);
    const captureBoundary = page;
    await page.locator('#sidebar-search-input').hover();
    const review = testInfo.outputPath(`${theme}-review.png`);
    const image = await captureBoundary.screenshot({ ...operator.captureOptions(), path: review });
    expect({ width: image.readUInt32BE(16), height: image.readUInt32BE(20) })
      .toEqual({ width: 2560, height: 1800 });
    await testInfo.attach('reviewed-zoom-capture', { path: review, contentType: 'image/png' });
    await expect(captureBoundary).toHaveScreenshot(`${theme}.png`, operator.captureOptions());
    expect(await page.evaluate(() => innerWidth)).toBe(before.width);
    await operator.zoom(1);
    expect(operator.errors).toEqual([]);
  });
}

test('synthetic credentials are redacted from captures and excluded from preference persistence', async ({ operator }) => {
  const { page } = operator;
  await page.locator('details:has([data-platform-settings="youtube"]) > summary').click();
  await page.locator('[data-platform-settings="youtube"]').click();
  await expect(page).toHaveURL(/#platform-integrations$/);
  const secret = 'fixture-secret-NEVER-PERSIST';
  await page.locator('#youtube-api-key').fill(secret);
  await page.locator('#kick-client-id').fill('fixture-client-id');
  await page.locator('#kick-client-secret').fill(secret);
  await page.locator('#twitch-token').fill(secret);
  await page.locator('#twitch-nickname').fill('fixture-private-nickname');
  await page.locator('#kick-webhook-path').evaluate(node => { node.textContent = '/hooks/kick/fixture-secret-NEVER-PERSIST'; });
  await expect(page.locator('#youtube-api-key')).toHaveAttribute('type', 'password');
  // Equal pixels for unequal secret lengths prove our capture mask, without OCR claims.
  const credentialPage = page.locator('[data-section="platform-integrations"]');
  await page.evaluate(() => document.activeElement.blur());
  const first = await credentialPage.screenshot(operator.captureOptions());
  await page.locator('#youtube-api-key').fill('different-fixture-secret-with-another-length');
  await page.locator('#kick-client-id').fill('another-fixture-client-id');
  await page.locator('#kick-client-secret').fill('another-fixture-private-secret');
  await page.locator('#twitch-token').fill('another-fixture-private-secret');
  await page.locator('#twitch-nickname').fill('another-fixture-private-nickname');
  await page.locator('#kick-webhook-path').evaluate(node => { node.textContent = '/hooks/kick/fixture-secret-OTHER-PRIVATE'; });
  await page.evaluate(() => document.activeElement.blur());
  const second = await credentialPage.screenshot(operator.captureOptions());
  expect(second.equals(first)).toBe(true);
  await chooseTheme(page, 'dark');
  await expect.poll(() => operator.preferences['tikreader.skin']).toBe('dark');
  const persisted = JSON.stringify({ server: operator.preferences,
    browser: await page.evaluate(() => ({ ...localStorage })) });
  for (const canary of ['secret', 'fixture-client-id', 'fixture-private-nickname']) {
    expect(persisted).not.toContain(canary);
  }
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-skin', 'dark');
  await expect(page.locator('#youtube-api-key')).toHaveValue('');
  expect(operator.errors).toEqual([]);
});
