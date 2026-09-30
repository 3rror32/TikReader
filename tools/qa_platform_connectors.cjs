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
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    const html = render('index.html');
    await page.route('**/*', route => route.request().isNavigationRequest()
      ? route.fulfill({ contentType: 'text/html', body: html }) : route.abort());
    await page.goto('http://platforms.test');
    await page.addScriptTag({ path: path.join(root, 'web/static/live_presence.js') });
    await page.locator('#platform-connectors').evaluate(node => { node.open = true; });
    const settleLayout = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

    for (const width of [390, 760, 1180, 1600]) {
      await page.setViewportSize({ width, height: 900 });
      await settleLayout();
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `horizontal overflow at ${width}px`);
      const panel = await page.locator('.session-panel').boundingBox();
      const connectors = await page.locator('#platform-connectors').boundingBox();
      assert(panel && connectors, `connection panel missing at ${width}px`);
      const panelPadding = await page.locator('.session-panel').evaluate(node => {
        const style = getComputedStyle(node);
        return { left: parseFloat(style.paddingLeft), right: parseFloat(style.paddingRight) };
      });
      assert(Math.abs((panel.x + panelPadding.left) - connectors.x) < 2, `connector left edge is not aligned at ${width}px`);
      assert(Math.abs((panel.width - panelPadding.left - panelPadding.right) - connectors.width) < 3, `connector does not use the full panel content width at ${width}px`);
    }

    const columns = await page.locator('.platform-connector-grid').evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').length);
    assert.equal(columns, 2, 'desktop should show two balanced platform cards');
    const desktopConnector = await page.locator('#platform-connectors').boundingBox();
    assert(desktopConnector && desktopConnector.height > 250, 'desktop connector drawer is unexpectedly compressed');

    await page.setViewportSize({ width: 390, height: 844 });
    await settleLayout();
    const mobileColumns = await page.locator('.platform-connector-grid').evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').length);
    assert.equal(mobileColumns, 1, 'mobile should stack platform cards');

    await page.locator('#platform-connectors').evaluate(node => {
      document.body.removeAttribute('class');
      document.body.replaceChildren(node);
      Object.assign(document.body.style, { margin: '0', padding: '24px', minHeight: '100vh', overflow: 'auto' });
      Object.assign(node.style, { maxWidth: '1200px', margin: '0 auto' });
    });
    await page.setViewportSize({ width: 1600, height: 900 });
    await settleLayout();
    await page.locator('#platform-connectors').screenshot({ path: path.join(root, 'docs/screenshots/qa-platform-connectors.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => { document.body.style.padding = '8px'; });
    await settleLayout();
    await page.locator('#platform-connectors').screenshot({ path: path.join(root, 'docs/screenshots/qa-platform-connectors-mobile.png') });
    console.log('Platform connectors: full-width alignment, responsive stacking and overflow checks passed');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
