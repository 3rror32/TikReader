const fs = require('node:fs');
const test = require('node:test');
const assert = require('node:assert/strict');

const read = path => fs.readFileSync(path, 'utf8');

test('operational changes explain their effect before the request and report only confirmed results', () => {
  const overlays = read('web/static/overlay_gallery.js');
  const creator = read('web/static/creator.js');
  const alerts = read('web/static/animation_studio.js');
  const reliability = read('web/static/reliability.js');

  assert.ok(/¿Guardar este estilo.*programa de streaming/.test(overlays), 'overlay save explains its streaming effect');
  assert.ok(/if\(!r\.ok\)throw Error/.test(overlays), 'failed overlay save does not enter success state');
  assert.ok(/Borrador guardado\. La escena publicada sigue igual\./.test(creator), 'scene draft remains unpublished');
  assert.ok(/¿Añadir este perfil\? Escenas y reglas iniciales se añadirán con las reglas desactivadas/.test(creator), 'profile application explains its paused effect');
  assert.ok(/¿Activar todas las alertas para este LIVE\?/.test(alerts), 'arming all alerts requires confirmation');
  assert.ok(/Prueba enviada a la fuente de transmisión; no se envió un regalo real\./.test(alerts), 'alert test remains a test');
  assert.ok(/¿Aplicar el borrador y cancelar pasos pendientes/.test(reliability), 'publishing consequences remain explicit');
});

test('consequential profile and alert requests are guarded against duplicate submissions', () => {
  const workspace = read('web/static/workspace.js');
  const translations = read('web/static/translations.js');
  const alerts = read('web/static/animation_studio.js');
  const reliability = read('web/static/reliability.js');

  assert.ok(/profileLoadPending/.test(workspace), 'profile loading has a duplicate-submission guard');
  assert.ok(/\$\('tts-enabled'\)\.checked=false;\$\('tts-enabled'\)\.dispatchEvent\(new Event\('change',\{bubbles:true\}\)\);\$\('alerts-enabled'\)\.checked=false;\$\('alerts-enabled'\)\.dispatchEvent\(new Event\('change',\{bubbles:true\}\)\)/.test(workspace), 'profile loading persists both pauses through registered change listeners');
  assert.ok(!/wantsVoice=!!p\.voice;save\('tikreader\.voiceWanted',wantsVoice\)/.test(workspace), 'loading does not transiently restore profile voice');
  assert.ok(/¿Cargar este perfil en TikReader\?/.test(workspace), 'profile application consequences are confirmed');
  for (const source of [
    '¿Cargar este perfil en TikReader? Se actualizarán los ajustes locales; la voz y las alertas seguirán pausadas hasta que las reactives.',
    'Perfil aplicado localmente. Revisa las reglas desactivadas; voz y alertas locales siguen pausadas hasta reactivarlas.',
    'Borrador guardado · no se modificó la emisión.',
    '¿Guardar este estilo? Actualizará la configuración que recibe tu programa de streaming.',
  ]) assert.ok(translations.includes(source + '|'), `UX-6 consequence copy has a translation: ${source}`);
  assert.ok(/button\('Activar todas',[\s\S]*?if\(!\(window\.I18n\?\.confirm/.test(alerts), 'alert activation is confirmed');
  assert.ok(/b\.disabled=true;try\{await fn\(\)/.test(reliability), 'reliability actions disable while pending');
});
