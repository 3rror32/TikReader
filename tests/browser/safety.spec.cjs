const { test, expect } = require('./fixtures.cjs');

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
