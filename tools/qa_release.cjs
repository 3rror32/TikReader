const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  const errors=[];
  try {
    const context=await browser.newContext();
    const page=await context.newPage();
    await page.emulateMedia({reducedMotion:'reduce'});
    page.on('pageerror', e=>errors.push(e.message));
    // Test the bundled UI with all external network requests disabled.
    await page.route('**/*', route=>route.request().url().startsWith('http://127.0.0.1:5199/') ? route.continue() : route.abort());
    await page.goto('http://127.0.0.1:5199/');
    await page.waitForFunction(()=>window.Workspace && window.Studio);
    await page.locator('[data-section-nav="workspace"]').click();
    await page.locator('#installation-title').scrollIntoViewIfNeeded();
    const originalSkin = await page.locator('#skin-select').inputValue();
    const selectedSkin = originalSkin === 'light' ? 'dark' : 'light';
    await page.locator('#skin-select').evaluate(select => { select.closest('details').open = true; });
    const saved = page.waitForResponse(response => response.url().endsWith('/system/preferences')
      && response.request().method() === 'POST'
      && response.request().postDataJSON()['tikreader.skin'] === selectedSkin);
    await page.locator('#skin-select').selectOption(selectedSkin);
    assert.equal((await saved).ok(), true, 'automatic preference save succeeds');
    assert.equal((await (await page.request.get('http://127.0.0.1:5199/system/preferences')).json())
      .values['tikreader.skin'], selectedSkin, 'selected theme is persisted on the device');
    // Remove the browser copy so reload must restore the device preference.
    await page.evaluate(() => localStorage.removeItem('tikreader.skin'));
    await page.reload();
    await page.waitForFunction(()=>window.Workspace && window.Studio);
    await page.waitForFunction(skin => document.documentElement.dataset.skin === skin, selectedSkin);
    assert.equal(await page.locator('#skin-select').inputValue(), selectedSkin);
    assert.equal(await page.evaluate(()=>typeof io),'function');
    assert.equal((await page.request.get('http://127.0.0.1:5199/diagnostics/export')).status(),200);
    for(const width of [1440,390]){
      await page.setViewportSize({width,height:1000});
      if(width<900) await page.waitForFunction(()=>document.querySelector('.app-sidebar').getBoundingClientRect().right<=1);
      await page.locator('#installation-title').scrollIntoViewIfNeeded();
      await page.screenshot({path:path.resolve('release',`settings-${width}.png`),fullPage:false});
      assert(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth), `Overflow ${width}`);
    }
    assert.deepEqual(errors,[]);
    console.log('PASS: packaged UI offline, save preferences, diagnostics, 1440/390px, no JS errors');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
