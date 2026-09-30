const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
function render(name) {
  return fs.readFileSync(path.join(root, 'web/templates', name), 'utf8')
    .replace(/{% include '([^']+)' %}/g, (_, file) => render(file))
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<link\b[^>]*>/gi, tag => {
      const file = tag.match(/href="\/static\/([^"?]+\.css)/);
      return file ? `<style>${fs.readFileSync(path.join(root, 'web/static', file[1]), 'utf8')}</style>` : '';
    });
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const html = render('index.html');
    await page.route('**/*', route => route.request().isNavigationRequest()
      ? route.fulfill({ contentType: 'text/html', body: html }) : route.abort());
    await page.goto('http://platform-settings.test');
    assert.equal(await page.locator('#platform-connectors input[type="password"]').count(), 0,
      'live panel must not ask for credentials');
    assert.equal(await page.locator('.platform-integrations-page input[type="password"]').count(), 2,
      'settings must own the two secret fields');
    await page.locator('.platform-integrations-page').evaluate(node => {
      document.body.removeAttribute('class');
      document.body.replaceChildren(node);
      Object.assign(document.body.style, { margin: '0', padding: '28px', minHeight: '100vh', overflow: 'auto' });
      Object.assign(node.style, { margin: '0 auto' });
    });
    const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await settle();
    assert.equal(await page.locator('.platform-integration-grid').evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').length), 2);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'desktop settings overflow');
    await page.locator('.platform-integrations-page').screenshot({ path: path.join(root, 'docs/screenshots/qa-platform-integrations.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => { document.body.style.padding = '12px'; });
    await settle();
    assert.equal(await page.locator('.platform-integration-grid').evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').length), 1);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'mobile settings overflow');
    await page.locator('.platform-integrations-page').screenshot({ path: path.join(root, 'docs/screenshots/qa-platform-integrations-mobile.png') });
    console.log('Platform settings: credentials separated from live panel and responsive layout passed');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
