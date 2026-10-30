const { test, expect } = require('./fixtures');

test('optional tools load on demand, recover failure, and preserve navigation', async ({ operator }) => {
  const { page } = operator;
  expect(await page.locator('script[src="/static/minecraft.js"], script[src="/static/game_hotkeys.js"]').count()).toBe(0);
  let requests = 0;
  await page.route('**/static/minecraft.js', async route => {
    requests += 1;
    if (requests === 1) await route.abort();
    else await route.fallback();
  });
  await page.evaluate(() => window.Shell.show('minecraft'));
  const pane = page.locator('.config-content > [data-section="minecraft"]');
  await expect(pane.getByRole('button', { name: 'Reintentar', exact: true })).toBeVisible();
  await pane.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await expect(pane.getByRole('heading', { name: 'Minecraft Java por RCON' })).toBeVisible();
  await page.evaluate(() => { window.Shell.show('game-hotkeys'); window.Shell.show('live'); });
  await expect.poll(() => page.locator('[data-section="game-hotkeys"]').count()).toBe(1);
  await expect(page).toHaveURL(/#live$/);
  await expect(page.locator('.live-columns')).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/#game-hotkeys$/);
  await expect(page.locator('.config-content > [data-section="game-hotkeys"]')).toBeVisible();
  await page.evaluate(() => window.Shell.show('minecraft'));
  expect(requests).toBe(2);
  await page.reload();
  await operator.signalBackendReady();
  await expect(pane.getByRole('heading', { name: 'Minecraft Java por RCON' })).toBeVisible();
  await expect(page).toHaveURL(/#minecraft$/);
});

test.describe('operator startup evidence', () => {
  test.use({ operatorStartupScenario: { deferNavigation: true, delayPath: '/static/shell.js', delayMs: 250 } });

  test('records cold and warm startup evidence and keeps stages distinct', async ({ operator }, testInfo) => {
    const { page, start, signalBackendReady, assetTransfers } = operator;
    const firstNavigation = start();
    await expect(page.locator('#operator-boot-status')).toBeHidden();
    await expect(page.locator('html')).toHaveAttribute('data-operator-layout', 'pending');
    await expect(page.locator('.app')).toBeHidden();
    expect(await page.evaluate(() => window.OperatorBoot.snapshot().presentationReady)).toBe(false);
    const pendingBounds = await page.locator('.app').boundingBox();
    expect(pendingBounds.width).toBeGreaterThan(0);
    expect(pendingBounds.height).toBeGreaterThan(0);
    await expect(page.locator('.app')).toHaveAttribute('inert', '');
    await firstNavigation;
    await expect(page.locator('.app')).toBeVisible();
    await expect(page.locator('#operator-boot-status')).toBeHidden();
    await expect(page.locator('html')).not.toHaveAttribute('data-operator-layout', 'pending');
    await expect(page.locator('html')).toHaveAttribute('data-operator-boot-state', 'shell-ready');
    await expect(page.locator('.app')).toHaveAttribute('inert', '');
    expect(await page.evaluate(() => window.OperatorBoot.snapshot().presentationReady)).toBe(false);
    const beforeBackend = await page.locator('.app').boundingBox();
    await signalBackendReady();
    await expect(page.locator('#operator-boot-status')).toBeHidden();
    await expect.poll(() => page.evaluate(() => window.OperatorBoot.snapshot().presentationReady)).toBe(true);
    expect(await page.locator('.app').boundingBox()).toEqual(beforeBackend);
    await expect(page.locator('.app')).not.toHaveAttribute('inert', '');
    await expect(page.locator('html')).toHaveAttribute('data-operator-boot-state', 'backend-ready');
    await expect(page.locator('html')).not.toHaveAttribute('data-operator-boot-state', 'tiktok-live');
    const coldBrowser = await page.evaluate(() => ({
      domContentLoadedMs: performance.getEntriesByType('navigation')[0]?.domContentLoadedEventEnd || null,
      firstContentfulPaintMs: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || null,
      boot: window.OperatorBoot.snapshot(),
    }));
    const coldAssets = assetTransfers.slice();

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-operator-boot-state', 'shell-ready');
    await signalBackendReady();
    const warmBrowser = await page.evaluate(() => ({
      domContentLoadedMs: performance.getEntriesByType('navigation')[0]?.domContentLoadedEventEnd || null,
      firstContentfulPaintMs: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || null,
      boot: window.OperatorBoot.snapshot(),
    }));
    const warmAssets = assetTransfers.slice(coldAssets.length);
    const measurements = {
      cold: { assetRequestCount: coldAssets.length, transferredBytes: coldAssets.reduce((sum, item) => sum + item.bytes, 0), assets: coldAssets, ...coldBrowser },
      warm: { assetRequestCount: warmAssets.length, transferredBytes: warmAssets.reduce((sum, item) => sum + item.bytes, 0), assets: warmAssets, ...warmBrowser },
    };
    expect(measurements.cold.assetRequestCount).toBeGreaterThan(0);
    expect(measurements.cold.transferredBytes).toBeGreaterThan(0);
    for (const run of [measurements.cold, measurements.warm]) {
      const milestones = run.boot.milestones;
      expect(run.boot.firstUsefulStructureMs).not.toBeNull();
      expect(milestones.shellReadyMs).not.toBeNull();
      expect(milestones.backendReadyMs).not.toBeNull();
      expect(run.boot.firstUsefulStructureMs).toBeLessThan(milestones.shellReadyMs);
      expect(milestones.shellReadyMs).toBeLessThan(milestones.backendReadyMs);
    }
    expect(measurements.warm.boot.milestones.tikTokLiveMs).toBeNull();
    await testInfo.attach('operator-startup-measurements', { body: JSON.stringify(measurements, null, 2), contentType: 'application/json' });
    const concise = Object.fromEntries(Object.entries(measurements).map(([label, row]) => [label, {
      assetRequestCount: row.assetRequestCount,
      transferredBytes: row.transferredBytes,
      domContentLoadedMs: row.domContentLoadedMs,
      firstContentfulPaintMs: row.firstContentfulPaintMs,
      bootMilestonesMs: row.boot.milestones,
    }]));
    console.log(`operator-startup-measurements ${JSON.stringify(concise)}`);
  });
});

test.describe('operator startup recovery', () => {
  test.use({ operatorStartupScenario: { deferNavigation: true, failOncePath: '/static/shell.js' } });

  test('recovers once from a failed critical script without double-binding actions', async ({ operator }, testInfo) => {
    const { page, start, signalBackendReady, assetTransfers } = operator;
    await start();
    await expect(page.locator('html')).toHaveAttribute('data-operator-boot-state', 'initialization-error');
    await expect(page.locator('#operator-boot-retry')).toBeVisible();
    await expect(page.locator('#operator-boot-status')).toContainText('No se pudo completar el inicio.');
    await expect(page.locator('.app')).toHaveAttribute('inert', '');
    const retryNavigation = page.waitForNavigation();
    await page.locator('#operator-boot-retry').click();
    await retryNavigation;
    await expect(page.locator('html')).toHaveAttribute('data-operator-boot-state', 'shell-ready');
    await expect(page.locator('.app')).toHaveAttribute('inert', '');
    const counts = await page.evaluate(() => ({
      connect: window.__operatorSocket.listenerCount('connect'),
      startButton: window.__operatorSocket.listenerCount('start'),
    }));
    expect(counts.connect).toBe(1);
    await page.evaluate(() => document.getElementById('btn-connect').click());
    expect(await page.evaluate(() => window.__operatorSocket.sent.filter(row => row.event === 'start_live').length)).toBe(0);
    await signalBackendReady();
    await page.locator('#username-input').fill('fixture_user');
    await page.locator('#btn-connect').click();
    expect(await page.evaluate(() => window.__operatorSocket.sent.filter(row => row.event === 'start_live').length)).toBe(1);
    await page.evaluate(() => window.__operatorSocket.receive('connected', { username: 'fixture' }));
    await expect(page.locator('html')).toHaveAttribute('data-operator-boot-state', 'tiktok-live');
    expect(await page.evaluate(() => window.__operatorSocket.listenerCount('connect'))).toBe(1);
    const failureEvidence = {
      failedAssetResponses: assetTransfers.filter(item => item.status >= 500),
      recoveredStage: await page.locator('html').getAttribute('data-operator-boot-state'),
      connectionListenerCount: await page.evaluate(() => window.__operatorSocket.listenerCount('connect')),
      startLiveEmissions: await page.evaluate(() => window.__operatorSocket.sent.filter(row => row.event === 'start_live').length),
    };
    expect(failureEvidence.failedAssetResponses).toHaveLength(1);
    await testInfo.attach('operator-startup-failure-evidence', { body: JSON.stringify(failureEvidence, null, 2), contentType: 'application/json' });
    console.log(`operator-startup-failure-evidence ${JSON.stringify({ failedResponses: failureEvidence.failedAssetResponses.length, recoveredStage: failureEvidence.recoveredStage, connectionListenerCount: failureEvidence.connectionListenerCount, startLiveEmissions: failureEvidence.startLiveEmissions })}`);
  });
});

test.describe('operator boot-controller recovery', () => {
  test.use({ operatorStartupScenario: { deferNavigation: true, failOncePath: '/static/operator_boot.js' } });

  test('shows independent accessible retry after the boot controller itself fails', async ({ operator }, testInfo) => {
    test.setTimeout(30000);
    const { page, start, assetTransfers } = operator;
    await start();
    await page.waitForTimeout(11250);

    const status = page.locator('#operator-boot-status');
    await expect(status).toBeVisible();
    await expect(status).toHaveAttribute('aria-live', 'polite');
    await expect(page.locator('#operator-boot-retry')).toBeVisible();
    await expect(page.locator('#operator-boot-title')).toHaveText('No se pudo cargar el inicio.');
    await expect(page.locator('[data-boot-detail]')).toContainText('controlador de inicio');
    await expect(page.locator('#operator-boot-retry')).toBeEnabled();
    await expect(page.locator('.app')).toBeVisible();
    await expect(page.locator('.app')).toHaveAttribute('inert', '');
    await expect(page.locator('.app')).toHaveAttribute('aria-busy', 'true');
    expect(await page.locator('html').getAttribute('data-operator-boot-state')).toBe('initialization-error');
    expect(assetTransfers.filter(item => item.pathname === '/static/operator_boot.js' && item.status === 503)).toHaveLength(1);

    const retryNavigation = page.waitForNavigation();
    await page.locator('#operator-boot-retry').click();
    await retryNavigation;
    await expect(page.locator('html')).toHaveAttribute('data-operator-boot-state', 'shell-ready');
    await expect(page.locator('.app')).toHaveAttribute('inert', '');
    await operator.signalBackendReady();
    await expect(page.locator('.app')).not.toHaveAttribute('inert', '');
    await expect(page.locator('#operator-boot-status')).toBeHidden();
    await testInfo.attach('operator-boot-controller-failure', {
      body: JSON.stringify({ failedResponses: assetTransfers.filter(item => item.pathname === '/static/operator_boot.js' && item.status === 503),
        recoveredStage: await page.locator('html').getAttribute('data-operator-boot-state') }, null, 2),
      contentType: 'application/json',
    });
  });
});
