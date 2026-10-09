// Isolated browser fixtures: no live connection or saved settings are changed.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const widgetTemplatePath = path.join(root, 'web', 'templates', 'widget.html');
const studioBundlePath = path.join(root, 'web', 'static', 'build', 'studio.js');
const settings = { background:'#101925',text_color:'#f4f7fc',accent_color:'#85dec5',border_color:'#2c3a4b',font_family:'Trebuchet MS',font_size:23,title_size:15,radius:18,opacity:93,show_background:true,show_avatar:true,show_name:true,show_details:true,show_time:false,show_connection:false,max_items:4,alignment:'left',layout:'stack',animation:'fade' };
(async () => {
  const browser = await chromium.launch({channel:'msedge',headless:true});
  try {
    const page = await browser.newPage({viewport:{width:540,height:620}}), errors = [], requests = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', route => {
      const url = new URL(route.request().url()); requests.push(url.pathname);
      if (url.origin !== 'http://studio.test') return route.abort();
      if (url.pathname === '/static/build/studio.js') return route.fulfill({path:studioBundlePath});
      if (url.pathname.startsWith('/static/')) return route.fulfill({path:path.join(root,'web',url.pathname)});
      if (url.pathname.startsWith('/widget-settings/')) return route.fulfill({json:{settings}});
      if (url.pathname.startsWith('/widget/')) return route.fulfill({contentType:'text/html',body:fs.readFileSync(widgetTemplatePath,'utf8').replaceAll('{{ panel }}',url.pathname.split('/').pop())});
      // Compatibility-only fixture: retain coverage for legacy animation markup without using it for shipped widgets.
      return route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/static/overlay_animations.css"><link rel="stylesheet" href="/static/overlay_studio.css"></head><body><main id="effect-stage"></main><script src="/static/overlay_studio.js"></script><script src="/static/overlay_animation_renderer.js"></script></body></html>'});
    });
    for (const panel of ['goal-likes','goals','gifts','countdown-likes']) {
      await page.goto(`http://studio.test/widget/${panel}?preview=1`);
      await page.waitForSelector('.studio-goal,.gift-feed-row');
      await page.waitForTimeout(1000);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${panel}: fits`);
      if (panel === 'goal-likes') {
        assert.equal(await page.locator('.goal-number').textContent(),'350');
        await page.screenshot({path:path.join(root,'docs/screenshots/overlay-studio-goal.png'),omitBackground:true});
      }
      if (panel === 'gifts') await page.screenshot({path:path.join(root,'docs/screenshots/overlay-studio-gifts.png'),omitBackground:true});
      await page.setViewportSize({width:280,height:620});
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${panel}: fits 280px`);
      await page.setViewportSize({width:540,height:620});
    }
    assert(requests.includes('/static/build/studio.js'), 'widget template loads the shipped Vite studio bundle');
    // Value changes animate from the preceding value and celebrate only crossings.
    await page.goto('http://studio.test/widget/goal-custom-1?preview=1');
    await page.waitForSelector('.studio-goal');
    await page.evaluate(settings => postMessage({type:'widget-preview-settings',settings,goal:{goal:100,value:110,title:'Meta del chat'}},location.origin),settings);
    await page.waitForFunction(() => document.querySelector('.goal-number')?.textContent === '110');
    // Establish the same title below target, then cross it.
    await page.evaluate(settings => postMessage({type:'widget-preview-settings',settings,goal:{goal:100,value:90,title:'Meta del chat'}},location.origin),settings);
    await page.waitForFunction(() => document.querySelector('.goal-number')?.textContent === '90');
    await page.evaluate(settings => postMessage({type:'widget-preview-settings',settings,goal:{goal:100,value:110,title:'Meta del chat'}},location.origin),settings);
    await page.waitForSelector('.studio-medal svg');
    assert.equal(await page.locator('.studio-goal').getAttribute('data-complete'),'true');
    await page.goto('http://studio.test/compatibility-effects');
    for (const key of ['coins','celebration','hearts','welcome']) {
      await page.evaluate(key => { window.task = OverlayAnimationRenderer.render(document.getElementById('effect-stage'),key,{size:48,duration:10,sound:'none',motion:'full'},{user:'TikReader',gift:'Rosa',count:12}); },key);
      await page.waitForSelector('.studio-pixi canvas');
      if (key === 'celebration') await page.waitForSelector('.studio-medal svg');
      await page.waitForTimeout(900);
      if (key === 'coins') {
        assert(await page.evaluate(() => !!window.Matter.Engine));
        await page.screenshot({path:path.join(root,'docs/screenshots/overlay-studio-coins.png'),omitBackground:true});
      }
      if (key === 'celebration') await page.screenshot({path:path.join(root,'docs/screenshots/overlay-studio-celebration.png'),omitBackground:true});
      await page.evaluate(async () => { task.cancel(); await task.done; });
      assert.equal(await page.locator('#effect-stage > *').count(),0,'Emergency cancellation clears output');
    }
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.goto('http://studio.test/compatibility-effects'); const before = requests.length;
    await page.evaluate(() => { window.task = OverlayAnimationRenderer.render(document.getElementById('effect-stage'),'coins',{size:48,duration:10,sound:'none',motion:'system'},{user:'Luna'}); });
    await page.waitForTimeout(300);
    assert.equal(await page.locator('canvas').count(),0);
    assert(!requests.slice(before).some(p => p.includes('/vendor/')),'Reduced motion does not load visual engines');
    await page.evaluate(() => task.cancel());
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.route('**/vendor/**', route => route.abort());
    await page.goto('http://studio.test/compatibility-effects');
    await page.evaluate(() => { window.task = OverlayAnimationRenderer.render(document.getElementById('effect-stage'),'coins',{size:48,duration:10,sound:'none',motion:'full'},{user:'Luna'}); });
    await page.waitForTimeout(350);
    assert.equal(await page.locator('.effect-particle').count(),64,'CSS fallback survives engine load failure');
    assert.equal(await page.locator('.studio-pixi').count(),0);
    assert.equal(await page.locator('.effect-caption>span').textContent(),'¡Gracias, Luna!');
    await page.evaluate(() => task.cancel());
    assert.deepEqual(errors,[]);
    console.log('PASS: 4 widgets at 540/280px; counter updates; Lottie goal crossing; 4 Pixi effects; Matter coins; immediate cancellation; reduced motion; no browser errors.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
