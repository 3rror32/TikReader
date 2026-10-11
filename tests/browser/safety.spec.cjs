const { test, expect } = require('./fixtures.cjs');
const credentialTest = test.extend({
  operatorCredentialScenario: [{kickWebhookSecret:'fixture-secret-alpha'}, {option:true}],
});

test('canceling alert activation leaves the streaming configuration unchanged', async ({ operator }) => {
  const { page, requests } = operator;
  const group = page.locator(`details:has([data-section-nav="alerts"])`).first();
  if (await group.count() && !(await group.evaluate(node => node.open))) await group.locator('summary').first().click();
  await page.locator('[data-section-nav="alerts"]').click();
  await expect(page.locator('.alerts-workspace')).toBeVisible();
  const activate = page.getByRole('button', { name: 'Activar todas', exact: true });
  await expect(activate).toBeEnabled();

  let message = '';
  page.once('dialog', async dialog => { message = dialog.message(); await dialog.dismiss(); });
  await activate.click();

  expect(message).toContain('Los eventos reales coincidentes');
  expect(requests.filter(request => request.path === '/animation-studio/arm')).toEqual([]);
  await expect(page.locator('.alerts-feedback')).not.toContainText('Alertas activadas');
  expect(operator.errors).toEqual([]);
});

test('loading an enabled profile keeps voice and local alerts paused after reload', async ({ operator }) => {
  const { page } = operator;
  const storedProfile = { voice:true, alerts:true, settings:{'alerts-enabled':true},
    layout:{split:58,presenter:false} };
  await page.evaluate(profile => {
    localStorage.setItem('tikreader.profiles', JSON.stringify({Enabled:profile}));
  }, storedProfile);
  await page.reload();
  await operator.signalBackendReady();
  const workspace = page.locator('[data-section-nav="workspace"]');
  const group = page.locator('details:has([data-section-nav="workspace"])').first();
  if (await group.count() && !(await group.evaluate(node => node.open))) await group.locator('summary').first().click();
  await workspace.click();
  await expect(page).toHaveURL(/#workspace$/);
  const selector = page.locator('#profile-select');
  await selector.selectOption('Enabled');
  await selector.dispatchEvent('change');
  await expect(page.locator('#profile-load')).toBeEnabled();
  let confirmation = '';
  page.once('dialog', async dialog => { confirmation = dialog.message(); await dialog.accept(); });
  await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded'}), page.locator('#profile-load').click()]);
  await operator.signalBackendReady();
  expect(confirmation).toContain('seguirán pausadas');
  const persisted = await page.evaluate(() => ({
    voice:localStorage.getItem('tikreader.voiceWanted'),
    preferences:JSON.parse(localStorage.getItem('tikreader.preferences') || '{}'),
    profile:JSON.parse(localStorage.getItem('tikreader.profiles')).Enabled,
  }));
  expect(persisted.voice).toBe('false');
  expect(persisted.preferences['alerts-enabled']).toBe(false);
  expect(persisted.profile.voice).toBe(true);
  expect(persisted.profile.alerts).toBe(true);
  expect(await page.locator('#tts-enabled').isChecked()).toBe(false);
  expect(await page.locator('#alerts-enabled').isChecked()).toBe(false);
  await page.evaluate(() => {
    for (const id of ['tts-enabled','alerts-enabled']) {
      const input = document.getElementById(id);
      input.checked = true;
      input.dispatchEvent(new Event('change', {bubbles:true}));
    }
  });
  const reactivated = await page.evaluate(() => ({
    voice:localStorage.getItem('tikreader.voiceWanted'),
    alerts:JSON.parse(localStorage.getItem('tikreader.preferences') || '{}')['alerts-enabled'],
  }));
  expect(reactivated).toEqual({voice:'true',alerts:true});
});

test('UX-6 dynamic outcome templates translate and interpolate their runtime values', async ({ operator }) => {
  const translated = await operator.page.evaluate(() => {
    window.I18n.setLocale('en');
    return [
      window.I18n.t('No se completó. {error}', {error:'fixture failure'}),
      window.I18n.t('Aplicado localmente · {notice}', {notice:'profile applied'}),
      window.I18n.t('¿Activar “{name}”? Los eventos reales coincidentes podrán mostrarla en la transmisión.', {name:'Friday alert'}),
    ];
  });
  expect(translated).toEqual([
    'Could not complete. fixture failure',
    'Applied locally · profile applied',
    'Enable “Friday alert”? Matching real events may show it on stream.',
  ]);
});

credentialTest('Kick webhook paths stay private unless intentionally revealed or copied', async ({ operator }) => {
  const {page} = operator;
  await page.evaluate(() => window.Shell.show('platform-integrations'));
  const path = page.locator('#kick-webhook-path');
  const reveal = page.locator('#kick-reveal-webhook');
  const copy = page.locator('#kick-copy-webhook');
  await expect(path).toHaveText('/kick/webhook/fixture-secret-alpha');
  await expect(path).toHaveAttribute('aria-hidden', 'true');
  await expect(reveal).toHaveAttribute('aria-pressed', 'false');
  await expect(reveal).toBeVisible();
  await expect(copy).toBeVisible();
  await expect(page.locator('#kick-webhook-warning')).toContainText('No la compartas');

  const captureBounds = await path.boundingBox();
  const captureOptions = {animations:'disabled', mask:[path], maskColor:'#182330', clip:captureBounds};
  const captureA = await page.screenshot(captureOptions);
  await path.evaluate(node => { node.textContent = '/kick/webhook/fixture-secret-bravo'; });
  const captureB = await page.screenshot(captureOptions);
  expect(captureB.equals(captureA)).toBe(true);
  await path.evaluate(node => { node.textContent = '/kick/webhook/fixture-secret-alpha'; });

  await page.context().grantPermissions(['clipboard-read','clipboard-write'], {origin:new URL(page.url()).origin});
  await reveal.focus();
  await page.keyboard.press('Enter');
  await expect(reveal).toHaveAttribute('aria-pressed', 'true');
  await expect(path).toHaveAttribute('aria-hidden', 'false');
  await copy.click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('/kick/webhook/fixture-secret-alpha');
  await expect(reveal).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => window.I18n.setLocale('en', false));
  await expect(page.locator('#kick-webhook-warning')).toContainText('This path contains a secret');
  await expect(reveal).toHaveText('Hide path');
  await copy.click();
  await expect(page.locator('#kick-webhook-notice')).toHaveText('Path copied. Add your public HTTPS domain.');
  await reveal.click();
  await expect(path).toHaveAttribute('aria-hidden', 'true');
  await expect(reveal).toHaveAttribute('aria-pressed', 'false');
  await expect(reveal).toHaveText('Reveal path');

  const persisted = await page.evaluate(() => {
    const values = [...Object.values(localStorage), ...Object.values(sessionStorage)];
    return {values, revealed:document.querySelector('#kick-webhook-path').getAttribute('aria-hidden')};
  });
  expect(persisted.values.join('\n')).not.toMatch(/fixture-secret-(alpha|bravo)/);
  expect(page.url()).not.toMatch(/fixture-secret-(alpha|bravo)/);
  expect(JSON.stringify(operator.requests)).not.toMatch(/fixture-secret-(alpha|bravo)/);
  expect(operator.errors.join('\n')).not.toMatch(/fixture-secret-(alpha|bravo)/);
  await page.reload();
  await operator.signalBackendReady();
  await page.evaluate(() => window.Shell.show('platform-integrations'));
  await expect(page.locator('#kick-reveal-webhook')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#kick-webhook-path')).toHaveAttribute('aria-hidden', 'true');
  const secretAsPreference = await page.evaluate(() => JSON.stringify({local:{...localStorage},session:{...sessionStorage}}));
  expect(secretAsPreference).not.toContain('fixture-secret-alpha');

  let confirmation = '';
  page.once('dialog', async dialog => { confirmation = dialog.message(); await dialog.dismiss(); });
  await page.locator('[data-platform-delete="kick"]').click();
  expect(confirmation).toContain('Eliminar la credencial guardada de Kick');
  expect(operator.requests.filter(request => request.path === '/system/platform-credentials' && request.method === 'DELETE')).toEqual([]);
});
