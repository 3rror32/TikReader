(() => {
  const control = document.getElementById('voice-keep-warm');
  const status = document.getElementById('voice-keep-warm-status');
  const preload = document.getElementById('voice-preload');
  const model = document.getElementById('voice-local-model');
  if (!control || !status || !preload || !model) return;
  let confirmed = false, serial = 0, switching = false, pending = Promise.resolve();
  function show(data) {
    confirmed = data.keep_warm === true;
    control.checked = confirmed;
    preload.textContent = data.warm_loaded ? 'Volver a precargar' : 'Precargar ahora';
    status.textContent = data.warm_loaded
      ? 'Lista para leer · voz precargada en GPU.'
      : confirmed
      ? 'Activado: pulsa Precargar ahora para evitar la espera del primer mensaje.'
      : 'RVC liberado. La voz se descargará de memoria al terminar cada conversión.';
  }
  async function post(path, body) {
    const response = await fetch(path, {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body || {}), signal: AbortSignal.timeout(120000),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Error(data.error || 'No se pudo confirmar el cambio de memoria de RVC.');
    return data;
  }
  function run(action, changing = false) {
    const current = ++serial;
    control.disabled = preload.disabled = true;
    if (changing) {
      switching = true;
      status.textContent = 'Liberando RVC; si hay una conversión en curso, espera a que termine…';
      document.dispatchEvent(new CustomEvent('tikreader:voice-changing'));
    }
    // A late preload must finish before unloading, never after it.
    const job = pending.catch(() => {}).then(action);
    pending = job;
    return job.then(data => {
      if (current === serial) {
        show(data);
        document.dispatchEvent(new CustomEvent('voice-models-updated', {detail: data}));
      }
      return data;
    }).catch(error => {
      if (current === serial) {
        control.checked = confirmed;
        status.textContent = 'No se confirmó la liberación o precarga de RVC. ' + error.message;
      }
      throw error;
    }).finally(() => {
      if (current === serial) {
        control.disabled = preload.disabled = false;
        if (switching) {
          switching = false;
          document.dispatchEvent(new CustomEvent('tikreader:voice-changed'));
        }
      }
    });
  }
  window.RvcResources = {release: () => run(() => post('/voice-models/unload'), true)};
  async function prepare() {
    const selected = model.value;
    if (!selected) return;
    status.textContent = 'Precargando modelo RVC y voz base…';
    return run(() => post('/voice-models/preload', {model: selected}));
  }
  preload.addEventListener('click', () => prepare().catch(() => {}));
  document.addEventListener('voice-models-updated', event => show(event.detail));
  window.addEventListener('storage', event => {
    if (event.key === 'tikreader.voiceCharacter' && event.oldValue !== event.newValue) {
      window.RvcResources.release().catch(() => {});
    }
  });
  control.disabled = preload.disabled = true;
  fetch('/voice-models', {cache: 'no-store'})
    .then(response => { if (!response.ok) throw Error(); return response.json(); })
    .then(data => { if (!serial) show(data); })
    .catch(() => { if (!serial) status.textContent = 'No se pudo consultar el ajuste de RVC.'; })
    .finally(() => { if (!serial) control.disabled = preload.disabled = false; });
  control.addEventListener('change', () => {
    const enabled = control.checked, selected = model.value;
    if (!enabled) { window.RvcResources.release().catch(() => {}); return; }
    run(async () => {
      const data = await post('/voice-models/settings', {keep_warm: true});
      return !data.warm_loaded && selected ? post('/voice-models/preload', {model: selected}) : data;
    }).catch(() => {});
  });
})();
