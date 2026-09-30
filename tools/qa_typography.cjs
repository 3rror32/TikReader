// Isolated browser audit of actual templates, navigation and the final CSS cascade.
// No server, live connection, microphone or application actions are started.
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
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route('**/*', route => {
      if (route.request().isNavigationRequest()) return route.fulfill({ contentType: 'text/html', body: render('index.html') });
      const url = new URL(route.request().url());
      if (url.origin === 'http://typography.test' && url.pathname.startsWith('/static/icons/')) {
        const file = path.join(root, 'web/static/icons', path.basename(url.pathname));
        if (fs.existsSync(file)) return route.fulfill({ path: file });
      }
      return route.abort();
    });
    await page.goto('http://typography.test');
    await page.addScriptTag({ path: path.join(root, 'web/static/shell.js') });
    await page.addScriptTag({ path: path.join(root, 'web/static/sidebar.js') });
    await page.addScriptTag({ path: path.join(root, 'web/static/skins.js') });
    const skins = await page.locator('#skin-select option').evaluateAll(options => options.map(option => option.value));
    for (const skin of skins) {
      await page.evaluate(skin => {
        document.querySelector('#skin-select').value = skin;
        document.querySelector('#skin-apply').click();
      }, skin);
      assert.equal(await page.evaluate(() => localStorage.getItem('tikreader.skin')), skin);
      assert.equal(await page.evaluate(() => document.documentElement.dataset.skin), skin);
      const failures = await page.evaluate(() => [...document.querySelectorAll('h1,h2,h3,h4,label,input,select,textarea')].flatMap(el => {
        const expected = { H1: 28, H2: 24, H3: 18, H4: 16 }[el.tagName] || 14;
        const size = parseFloat(getComputedStyle(el).fontSize);
        const panelHeading = el.matches('.live-columns .feed-title, .live-columns .participants-head h2, .live-columns #gift-heading');
        return size === (panelHeading ? 18 : expected) ? [] : [{ element: el.id || el.tagName, size, expected }];
      }));
      assert.deepEqual(failures, [], skin);
      console.log(`${skin}: shared title, subtitle and form scale OK`);
    }
    for (const skin of ['aetheria', 'cloudfoam', 'monolith', 'chromapulse']) {
      await page.evaluate(skin => {
        document.querySelector('#skin-select').value = skin;
        document.querySelector('#skin-apply').click();
        Shell.show('workspace');
      }, skin);
      const contrast = await page.evaluate(() => {
        const style = getComputedStyle(document.documentElement);
        const luminance = name => {
          const hex = style.getPropertyValue(name).trim().replace('#', '');
          const expanded = hex.length === 3 ? [...hex].map(c => c + c).join('') : hex;
          const channels = expanded.match(/../g).map(c => parseInt(c, 16) / 255)
            .map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
          return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
        };
        const ratio = (a, b) => (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
        return [ratio(luminance('--skin-text'), luminance('--skin-raised')),
          ratio(luminance('--skin-muted'), luminance('--skin-surface')),
          ratio(luminance('--skin-accent-ink'), luminance('--skin-accent'))];
      });
      assert(contrast.every(ratio => ratio >= 4.5), `${skin}: text contrast ${contrast}`);
      await page.locator('#skin-apply').focus();
      assert.equal(await page.locator('#skin-apply').evaluate(e => getComputedStyle(e).outlineStyle), 'solid');
      const material = await page.locator('.config-content').evaluate(e => {
        const style = getComputedStyle(e);
        return { blur: style.backdropFilter, shadow: style.boxShadow, scheme: style.colorScheme };
      });
      if (skin === 'aetheria') assert(material.blur.includes('blur(16px)'));
      if (skin === 'cloudfoam') assert.equal(material.scheme, 'light');
      if (skin === 'monolith') assert.equal(material.shadow, 'none');
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${skin} ${width}: overflow`);
        await page.screenshot({ path: path.join(root, `docs/screenshots/qa-${skin}-${width}.png`) });
      }
      // Exercise the early theme restoration script as well as normal initialization.
      await page.reload();
      const source = fs.readFileSync(path.join(root, 'web/templates/index.html'), 'utf8');
      const startup = source.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
      await page.addScriptTag({ content: startup });
      assert.equal(await page.evaluate(() => document.documentElement.dataset.skin), skin);
      await page.evaluate(() => document.documentElement.removeAttribute('data-ui-loading'));
      await page.addScriptTag({ path: path.join(root, 'web/static/shell.js') });
      await page.addScriptTag({ path: path.join(root, 'web/static/sidebar.js') });
      await page.addScriptTag({ path: path.join(root, 'web/static/skins.js') });
      assert.equal(await page.locator('#skin-select').inputValue(), skin);
      console.log(`${skin}: contrast, material, focus, mobile and reload persistence OK`);
    }
    await page.evaluate(() => document.documentElement.dataset.skin = 'original');
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const section of ['workspace', 'voice', 'custom-voice', 'simulation', 'history', 'moderator', 'preflight']) {
        await page.evaluate(section => Shell.show(section), section);
        const result = await page.evaluate(() => {
          const visible = e => e.getClientRects().length && e.getBoundingClientRect().width;
          const rows = [...document.querySelectorAll('.config-content .tool-buttons')].filter(visible);
          return { overflow: document.documentElement.scrollWidth > innerWidth,
            badGaps: rows.filter(e => parseFloat(getComputedStyle(e).columnGap) < 8).length,
            overlaps: rows.flatMap(row => {
              const children = [...row.children].filter(visible);
              return children.flatMap((el, i) => children.slice(i + 1).filter(other => {
                const a = el.getBoundingClientRect(), b = other.getBoundingClientRect();
                return Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
              }).map(() => row.className));
            }) };
        });
        assert.equal(result.overflow, false, `${section} ${width}: page overflow`);
        assert.equal(result.badGaps, 0, `${section} ${width}: action spacing`);
        assert.deepEqual(result.overlaps, [], `${section} ${width}: overlapping actions`);
      }
      await page.evaluate(() => Shell.show('workspace'));
      await page.screenshot({ path: path.join(root, `docs/screenshots/qa-typography-${width}.png`) });
      console.log(`${width}px: seven sections without page overflow or overlapping action buttons`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
