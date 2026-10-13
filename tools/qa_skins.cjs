// Browser CSS integration check: uses the real page and its stylesheet order,
// with network and application actions disabled. Requires Playwright + Edge.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {chromium} = require('playwright');

(async () => {
  const browser = await chromium.launch({channel:'msedge', headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1000}});
    let html = fs.readFileSync(path.join(__dirname,'../web/templates/index.html'),'utf8')
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'')
      .replace(/<link\b[^>]*>/gi, tag => {
        const file = tag.match(/href="\/static\/([^"?]+\.css)/);
        return file ? `<style>${fs.readFileSync(path.join(__dirname,'../web/static',file[1]),'utf8')}</style>` : '';
      });
    await page.route('**/*', route => route.request().isNavigationRequest()
      ? route.fulfill({contentType:'text/html',body:html}) : route.abort());
    await page.goto('http://skins.test');
    await page.addStyleTag({content:'*, *::before, *::after { transition:none!important; animation:none!important; }'});
    await page.addScriptTag({path:path.join(__dirname,'../web/static/skins.js')});
    const skins = await page.locator('#skin-select option').evaluateAll(options => options.map(option => option.value));
    await page.evaluate(() => {
      const fixture = document.createElement('section');
      fixture.id='skin-fixture';
      fixture.style.cssText='position:fixed;inset:0;z-index:99999;padding:24px;background:var(--skin-bg);overflow:auto';
      fixture.innerHTML='<h2>Controles del tema</h2><button id="qa-normal">Normal</button> <button id="qa-primary" class="primary-action">Guardar</button> <button id="qa-danger" class="danger-lite">Eliminar</button> <button id="qa-selected" aria-pressed="true">Seleccionado</button> <button id="qa-disabled" disabled>Deshabilitado</button><div class="overlay-gallery"><div class="overlay-categories"><button id="qa-category" class="active">Categoría activa</button></div><button class="overlay-card selected">Overlay seleccionado</button></div><div class="voice-setup"><button class="voice-character" data-selected="true">Voz seleccionada</button><div class="voice-summary"><p>Texto secundario</p><textarea id="qa-textarea" placeholder="Mensaje"></textarea></div></div>';
      document.body.append(fixture);
    });
    for (const skin of skins) {
      await page.mouse.move(1400,950);
      await page.evaluate(skin => {
        const select=document.querySelector('#skin-select');
        select.value=skin;
        select.dispatchEvent(new Event('change',{bubbles:true}));
      },skin);
      const colors = await page.evaluate(() => {
        const color = (selector,property) => getComputedStyle(document.querySelector(selector))[property];
        const token = name => {
          const probe=document.createElement('span');probe.style.color=`var(${name})`;document.body.append(probe);
          const value=getComputedStyle(probe).color;probe.remove();return value;
        };
        return {skin:document.documentElement.dataset.skin,saved:localStorage.getItem('tikreader.skin'),
          normal:color('#qa-normal','backgroundColor'),raised:token('--skin-raised'),
          primary:color('#qa-primary','backgroundColor'),accent:token('--skin-accent'),accent2:token('--skin-accent-2'),
          danger:color('#qa-danger','color'),dangerToken:token('--skin-danger'),
          selected:color('#qa-selected','borderTopColor'),category:color('#qa-category','borderTopColor'),
          disabled:color('#qa-disabled','opacity'),buttons:document.querySelectorAll('button').length};
      });
      assert.equal(colors.skin,skin);assert.equal(colors.saved,skin);
      const iconColors = await page.evaluate(() => {
        const icon = document.querySelector('#btn-connect .connect-button__icon');
        const colors = {};
        for (const state of ['disconnected','connected']) {
          icon.dataset.state = state;
          colors[state] = getComputedStyle(icon).color;
        }
        return colors;
      });
      assert.equal(iconColors.disconnected,'rgb(255, 255, 255)',`${skin}: disconnected plug icon must stay white`);
      assert.equal(iconColors.connected,'rgb(255, 255, 255)',`${skin}: connected plug icon must stay white`);
      assert.equal(colors.normal,colors.raised);
      assert.equal(colors.primary,skin==='original'?colors.raised:colors.accent,`${skin}: primary surface palette`);
      assert.equal(colors.danger,colors.dangerToken,`${skin}: danger palette`);
      assert.ok([colors.accent,colors.accent2].includes(colors.selected),`${skin}: selected palette`);
      assert.ok([colors.accent,colors.accent2].includes(colors.category),`${skin}: category palette`);
      assert.equal(colors.disabled,'0.5',`${skin}: disabled opacity`);
      const unthemed = await page.evaluate(() => [...document.querySelectorAll('#skin-fixture button')].flatMap(button => {
        const style=getComputedStyle(button), probe=document.createElement('span');
        probe.style.color=style.getPropertyValue('--control-ink');document.body.append(probe);
        const expected=getComputedStyle(probe).color;probe.remove();
        return style.color===expected ? [] : [button.id || button.className];
      }));
      assert.deepEqual(unthemed,[],`${skin}: every page button must inherit its semantic ink`);
      const voice = await page.evaluate(() => {
        const selectors=['.voice-setup-kicker','.voice-route i','.voice-setup-hero','#voice-setup-title','#custom-voice-sample','#custom-voice-test'];
        if (selectors.some(selector=>!document.querySelector(selector))) return null;
        const style = selector => getComputedStyle(document.querySelector(selector));
        const probe = document.createElement('span');
        document.body.append(probe);
        const token = name => {probe.style.color=`var(${name})`;return getComputedStyle(probe).color;};
        const result = {
          kicker:style('.voice-setup-kicker').color, accent:token('--skin-accent'),
          route:style('.voice-route i').backgroundColor,
          divider:style('.voice-setup-hero').borderBottomColor, border:token('--skin-border'),
          heading:style('#voice-setup-title').fontFamily,
          body:style('body').fontFamily, input:style('#custom-voice-sample').fontFamily,
          button:style('#custom-voice-test').fontFamily,
        };
        probe.style.fontFamily='var(--font-display)';
        result.display=getComputedStyle(probe).fontFamily;
        probe.remove();return result;
      });
      if (voice) {
        assert.equal(voice.kicker,voice.accent,`${skin}: voice accent`);
        assert.equal(voice.route,voice.accent,`${skin}: voice route`);
        assert.equal(voice.divider,voice.border,`${skin}: voice divider`);
        assert.equal(voice.heading,voice.display,`${skin}: heading typography`);
        assert.equal(voice.input,voice.body,`${skin}: input typography`);
        assert.equal(voice.button,voice.body,`${skin}: button typography`);
      }
      await page.locator('#qa-normal').hover();
      assert.notEqual(await page.locator('#qa-normal').evaluate(el=>getComputedStyle(el).backgroundColor),colors.normal);
      await page.locator('#qa-textarea').focus();
      assert.equal(await page.locator('#qa-textarea').evaluate(el=>getComputedStyle(el).outlineColor),colors.accent);
      console.log(`${skin}: palette, selected, danger, hover, disabled, focus, persistence OK (${colors.buttons} buttons)`);
    }
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:path.join(__dirname,'../docs/screenshots/qa-skins-mobile.png')});
    await page.setViewportSize({width:1440,height:1000});
    await page.evaluate(()=>{const select=document.querySelector('#skin-select');select.value='light';select.dispatchEvent(new Event('change',{bubbles:true}))});
    await page.screenshot({path:path.join(__dirname,'../docs/screenshots/qa-skins-light.png')});
    await page.evaluate(() => {
      document.querySelector('#skin-fixture').remove();
      const voice=document.querySelector('.voice-setup').cloneNode(true);
      voice.removeAttribute('hidden');
      voice.style.cssText='position:fixed;inset:0;z-index:99999;width:100%;max-width:none;padding:32px;overflow:auto;background:var(--skin-bg)';
      document.body.append(voice);
    });
    for (const skin of ['github-dark','light','kawai']) {
      await page.evaluate(skin=>{const select=document.querySelector('#skin-select');select.value=skin;select.dispatchEvent(new Event('change',{bubbles:true}))},skin);
      await page.screenshot({path:path.join(__dirname,`../docs/screenshots/qa-voice-${skin}.png`)});
    }
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1});
