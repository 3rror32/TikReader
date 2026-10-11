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
