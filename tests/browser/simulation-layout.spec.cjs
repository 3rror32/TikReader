const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFile} = require('node:fs/promises');
const path = require('node:path');
const {chromium} = require('playwright');

const cssPath = path.resolve(__dirname, '../../web/static/simulation.css');
const dockMarkup = `
  <aside id="simulation-float">
    <header class="simulation-float-header">Laboratorio en vivo <button>×</button></header>
    <div class="simulation-float-state"><span>Simulación activa</span><button>Desactivar</button></div>
    <div class="simulation-float-tabs"><button>Chat</button><button>Actividad</button></div>
    <div id="simulation-float-chat-view" class="simulation-float-view">
      <div class="simulation-float-feed"><p>Mensaje de prueba</p></div>
      <form id="simulation-float-form">
        <fieldset>
          <div class="simulation-float-row">
            <label><span>Usuario</span><input value="simulador"></label>
            <label><span>Evento</span><select id="kind"><option>Comentario</option><option>Regalo</option></select></label>
          </div>
          <label id="comment-label"><span>Mensaje</span><textarea rows="2">Una nota de prueba</textarea></label>
          <div id="simulation-float-gift-fields" class="simulation-float-row" hidden>
            <label><span>Regalo</span><div class="simulation-gift-control"><input value="Rose"><div class="simulation-gift-selection">Arte del regalo</div></div></label>
            <label><span>Cantidad</span><input value="1"></label>
          </div>
          <div class="simulation-float-send-row"><label><span>Espera</span><input value="0"></label><button id="simulation-float-send">Enviar ahora</button></div>
        </fieldset>
      </form>
    </div>
    <div class="simulation-float-view" hidden></div>
    <footer><span>Sin envíos pendientes</span><button>Detener</button></footer>
  </aside>`;

test('floating simulation keeps mode fields and send controls reachable in a short viewport', async t => {
  const browser = await chromium.launch({headless: true,
    ...(process.env.SIMULATION_BROWSER_PATH ? {executablePath: process.env.SIMULATION_BROWSER_PATH} : {})});
  t.after(() => browser.close());
  const css = await readFile(cssPath, 'utf8');

  for (const height of [734, 550]) {
    const page = await browser.newPage({viewport: {width: 390, height}});
    await page.setContent(`<style>${css}</style>${dockMarkup}`);
    await page.locator('#kind').evaluate(node => node.addEventListener('change', () => {
      const giftMode = node.value === 'Regalo';
      document.querySelector('#comment-label').hidden = giftMode;
      document.querySelector('#simulation-float-gift-fields').hidden = !giftMode;
    }));
    const dock = page.locator('#simulation-float');
    const header = page.locator('.simulation-float-header');
    const tabs = page.locator('.simulation-float-tabs');
    const form = page.locator('#simulation-float-form');
    const comment = page.locator('#comment-label');
    const gift = page.locator('#simulation-float-gift-fields');
    const send = page.locator('#simulation-float-send');

    await page.locator('#kind').selectOption({label: 'Regalo'});
    assert.equal(await comment.evaluate(node => getComputedStyle(node).display), 'none');
    assert.equal(await gift.evaluate(node => getComputedStyle(node).display), 'grid');
    const dockHeight = await dock.evaluate(node => node.getBoundingClientRect().height);
    assert.ok(dockHeight <= height - 14, `dock height ${dockHeight} should fit viewport ${height}`);
    assert.ok(await header.isVisible());
    assert.ok(await tabs.isVisible());

    await form.evaluate(node => { node.scrollTop = node.scrollHeight; });
    if (process.env.SIMULATION_LAYOUT_SCREENSHOTS) {
      await page.screenshot({path: path.resolve(__dirname, `../../.tmp/simulation-layout-${height}.png`)});
    }
    const sendBox = await send.boundingBox();
    const formBox = await form.boundingBox();
    assert.ok(sendBox.y >= formBox.y && sendBox.y + sendBox.height <= formBox.y + formBox.height,
      `send button should fit inside the scrolled form at ${height}px`);
    if (height === 550) assert.ok(await form.evaluate(node => node.scrollHeight > node.clientHeight),
      'the constrained form should scroll internally in the short viewport');

    await page.locator('#kind').selectOption({label: 'Comentario'});
    assert.equal(await comment.evaluate(node => getComputedStyle(node).display), 'flex');
    assert.equal(await gift.evaluate(node => getComputedStyle(node).display), 'none');
    await page.close();
  }
});
