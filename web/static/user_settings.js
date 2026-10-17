/* Restore device preferences before the rest of the interface initializes. */
(() => {
  const bootstrap = JSON.parse(document.getElementById('saved-preferences').textContent);
  const keys = bootstrap.keys;
  try {
    for (const [key, value] of Object.entries(bootstrap.values)) {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
    }
  } catch (_) { /* Browser controls show the storage warning after startup. */ }
  document.addEventListener('DOMContentLoaded', () => {
    const $ = id => document.getElementById(id);
    let previous = '', saving = false, voiceTimer, voicesWereReady = false;
    async function api(path, body) {
      const response = await fetch(path, {method: body ? 'POST' : 'GET',
        headers: body ? {'Content-Type': 'application/json'} : {},
        body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(10000)});
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'No se pudo completar la operación.');
      return result;
    }
    async function save(force = false) {
      if (saving) return;
      try {
        const values = Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)]));
        const serialized = JSON.stringify(values);
        if (!force && serialized === previous) return;
        saving = true;
        await api('/system/preferences', values);
        previous = serialized;
        $('settings-save-status').textContent = 'Ajustes guardados en este equipo.';
      } catch (_) {
        $('settings-save-status').textContent = 'No se pudieron guardar los ajustes en el equipo. Se volverá a intentar.';
      } finally { saving = false; }
    }
    async function voices() {
      clearTimeout(voiceTimer);
      try {
        const state = await api('/system/voices');
        const button = $('settings-install-voices');
        const busy = state.status === 'installing';
        if (state.ready && !voicesWereReady) window.KokoroVoices?.reload();
        voicesWereReady = state.ready;
        button.disabled = busy || state.ready || !state.available;
        button.textContent = state.ready ? 'Voces instaladas' : busy ? 'Instalando…' : 'Descargar e instalar voces';
        $('settings-cancel-voices').hidden = !busy;
        $('settings-voice-status').textContent = state.detail || (state.ready ? 'Kokoro está listo para usar.' :
          state.available ? 'Descarga opcional. Apache 2.0 · motor MIT.' : 'La descarga guiada estará disponible en la versión instalada.');
        $('settings-voice-progress').hidden = !busy;
        $('settings-voice-progress').value = state.downloaded;
        if (busy) voiceTimer = setTimeout(voices, 2000);
      } catch (_) { $('settings-voice-status').textContent = 'No se pudo consultar el estado de las voces.'; }
    }
    $('settings-open-data').onclick = async () => {
      try { await api('/system/open-data', {}); }
      catch (error) { $('settings-save-status').textContent = error.message; }
    };
    $('settings-install-voices').onclick = async () => {
      $('settings-install-voices').disabled = true;
      try { await api('/system/voices/install', {confirm: true}); await voices(); }
      catch (error) { $('settings-voice-status').textContent = error.message; $('settings-install-voices').disabled = false; }
    };
    $('settings-cancel-voices').onclick = async () => {
      $('settings-cancel-voices').disabled = true;
      try { await api('/system/voices/cancel', {confirm: true}); await voices(); }
      catch (error) { $('settings-voice-status').textContent = error.message; }
      finally { $('settings-cancel-voices').disabled = false; }
    };
    $('settings-copy-diagnostic').onclick = async () => {
      const button = $('settings-copy-diagnostic');
      const status = $('settings-diagnostic-status');
      if (button.getAttribute('aria-disabled') === 'true') return;
      button.setAttribute('aria-disabled', 'true');
      button.setAttribute('aria-busy', 'true');
      status.textContent = '';
      try {
        // Share only the server's allowlisted report, never local settings or logs.
        const report = await api('/diagnostics/export');
        await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
        status.textContent = 'Diagnóstico copiado. Puedes compartirlo para pedir ayuda.';
      } catch (_) {
        status.textContent = 'No se pudo copiar. Usa Exportar diagnóstico para descargarlo.';
      } finally {
        button.setAttribute('aria-disabled', 'false');
        button.setAttribute('aria-busy', 'false');
      }
    };
    $('settings-exit').onclick = async () => {
      if (!confirm('¿Cerrar TikReader y detener la conexión y las voces?')) return;
      try {
        await save(true);
        await api('/system/exit', {confirm: true});
        $('settings-exit-status').textContent = 'TikReader se cerró. Puedes cerrar esta pestaña y volver a abrirlo desde su acceso directo.';
      } catch (error) { $('settings-exit-status').textContent = error.message; }
    };
    setInterval(() => { if (!document.hidden) save(); }, 3000);
    voices();
  });
})();
