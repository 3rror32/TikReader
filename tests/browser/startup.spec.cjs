const { test, expect } = require('./fixtures');

test.describe('operator startup evidence', () => {
  test.use({ operatorStartupScenario: { deferNavigation: true, delayPath: '/static/shell.js', delayMs: 250 } });

  test('records cold and warm startup evidence and keeps stages distinct', async ({ operator }, testInfo) => {
    const { page, start, signalBackendReady, assetTransfers } = operator;
    const firstNavigation = start();
    await expect(page.locator('#operator-boot-status')).toBeVisible();
    await expect(page.locator('.app')).toBeVisible();
    await expect(page.locator('.app')).toHaveAttribute('inert', '');
    await expect(page.locator('#operator-boot-status')).toContainText('Estructura visible');
    await firstNavigation;
    await expect(page.locator('html')).toHaveAttribute('data-operator-boot-state', 'shell-ready');
    await expect(page.locator('.app')).toHaveAttribute('inert', '');
    await signalBackendReady();
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
    expect(measurements.cold.boot.firstUsefulStructureMs).not.toBeNull();
    expect(measurements.cold.boot.milestones.shellReadyMs).not.toBeNull();
    expect(measurements.cold.boot.milestones.backendReadyMs).not.toBeNull();
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
