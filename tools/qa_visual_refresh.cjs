const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const output = path.join(os.tmpdir(), 'tikreader-visual-refresh');

function html(name) {
  return fs.readFileSync(path.join(root, 'web/templates', name), 'utf8')
    .replace(/{% include '([^']+)' %}/g, (_, file) => html(file))
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<link\b[^>]*>/gi, tag => {
      const match = tag.match(/href="\/static\/([^"?]+\.css)/);
      return match ? `<style>${fs.readFileSync(path.join(root, 'web/static', match[1]), 'utf8')}</style>` : '';
    });
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route('**/*', route => route.request().isNavigationRequest()
      ? route.fulfill({ contentType: 'text/html', body: html('index.html') })
      : route.abort());
    await page.goto('http://visual-refresh.test');
    await page.evaluate(() => { document.documentElement.dataset.skin = 'original'; });
    for (const file of ['shell.js', 'sidebar.js', 'live_presence.js', 'skins.js', 'visual_refresh.js', 'motion_system.js']) {
      await page.addScriptTag({ path: path.join(root, 'web/static', file) });
    }
    await page.waitForTimeout(80);

    assert.equal(await page.locator('.signal-route .signal-stage').count(), 4);
    assert.equal(await page.locator('.mobile-command-dock button').count(), 4);
    assert.equal(await page.locator('#skin-select optgroup').count(), 3);
    assert.equal(await page.locator('.signal-stage[data-stage="reader"]').getAttribute('data-state'), 'ready');
    assert.equal(await page.locator('html').getAttribute('data-motion-level'), 'reduced');

    const desktop = path.join(output, 'desktop.png');
    await page.screenshot({ path: desktop, fullPage: true });

    for (const theme of ['broadcast-console', 'creator-pop', 'studio-rundown', 'terminal-crt', 'cyber-neumorph', 'swiss-brutalist', 'tactile-scrapbook']) {
      await page.locator('#skin-select').selectOption(theme);
      await page.locator('#skin-apply').click();
      assert.equal(await page.locator('html').getAttribute('data-skin'), theme);
      await page.screenshot({ path: path.join(output, `${theme}.png`), fullPage: true });
    }

    await page.setViewportSize({ width: 390, height: 844 });
    const mobile = path.join(output, 'mobile.png');
    await page.screenshot({ path: mobile, fullPage: false });
    assert.equal(await page.locator('.mobile-command-dock').isVisible(), true);

    console.log(desktop);
    console.log(mobile);
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
