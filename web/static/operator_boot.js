(() => {
  'use strict';
  if (window.__operatorBootRecoveryFailed) return;

  const failureDelayMs = 10000;
  const navigationStart = performance.getEntriesByType('navigation')[0]?.startTime;
  const startedAt = Number.isFinite(navigationStart) ? navigationStart : performance.now();
  const milestones = {documentStructureReadyMs: null, shellReadyMs: null, backendReadyMs: null, tikTokLiveMs: null};
  let stage = 'document-structure-ready';
  let shellReady = false;
  let backendReady = false;
  let failed = false;
  let retrying = false;
  let failureTimer;

  function mark(name) {
    const elapsed = performance.now() - startedAt;
    milestones[name] = elapsed;
    performance.mark(`operator-boot:${name}`);
    return elapsed;
  }

  function text(source) {
    return window.I18n?.t(source) || source;
  }

  function render(message, detail, showRetry = false) {
    document.documentElement.dataset.operatorBootState = stage;
    const app = document.querySelector('.app');
    if (app) {
      app.inert = !(shellReady && backendReady && !failed);
      app.setAttribute('aria-busy', String(app.inert));
    }
    const panel = document.getElementById('operator-boot-status');
    if (!panel) return;
    panel.dataset.state = stage;
    panel.hidden = shellReady && backendReady && !failed;
    const title = panel.querySelector('[data-boot-message]');
    const detailNode = panel.querySelector('[data-boot-detail]');
    const retry = document.getElementById('operator-boot-retry');
    if (title && message) title.textContent = text(message);
    if (detailNode && detail) detailNode.textContent = text(detail);
    if (retry) retry.hidden = !showRetry;
  }

  function documentReady() {
    if (milestones.documentStructureReadyMs === null) mark('documentStructureReadyMs');
    if (!shellReady && !failed) {
      stage = 'document-structure-ready';
      render('Estructura visible', 'Preparando el menú y la conexión local…');
    }
  }

  function shellReadySignal() {
    if (failed) return;
    if (!shellReady) mark('shellReadyMs');
    shellReady = true;
    stage = 'shell-ready';
    render('Menú listo', 'Conectando con el servicio local…');
  }

  function backendReadySignal() {
    if (!shellReady) return false;
    if (!backendReady || failed) mark('backendReadyMs');
    backendReady = true;
    failed = false;
    stage = 'backend-ready';
    clearTimeout(failureTimer);
    render('Servicio local listo', 'TikTok todavía no está conectado.');
    return true;
  }

  function liveSignal() {
    if (!backendReady) return false;
    if (stage !== 'tiktok-live') mark('tikTokLiveMs');
    stage = 'tiktok-live';
    render('Conexión de TikTok confirmada.', '');
    return true;
  }

  function tiktokOffline() {
    if (!backendReady) return;
    stage = 'backend-ready';
    render('Servicio local listo', 'TikTok todavía no está conectado.');
  }

  function fail(reason = 'initialization') {
    if (retrying) return;
    failed = true;
    backendReady = false;
    stage = 'initialization-error';
    clearTimeout(failureTimer);
    const copy = reason === 'stalled'
      ? 'El inicio no respondió. Puedes reintentar sin cerrar el estudio.'
      : 'TikReader sigue mostrando la interfaz. Reintenta el inicio para recuperar las funciones.';
    render('No se pudo completar el inicio.', copy, true);
  }

  function retry() {
    if (!failed || retrying) return false;
    retrying = true;
    const button = document.getElementById('operator-boot-retry');
    if (button) button.disabled = true;
    window.location.reload();
    return true;
  }

  function guardInteraction(event) {
    if (!document.querySelector('.app')?.inert || !event.target?.closest?.('.app')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function snapshot() {
    return {
      stage,
      shellReady,
      backendReady,
      failed,
      retrying,
      firstUsefulStructureMs: milestones.documentStructureReadyMs,
      milestones: {...milestones},
      elapsedMs: performance.now() - startedAt,
    };
  }

  window.OperatorBoot = Object.freeze({
    shellReady: shellReadySignal,
    backendReady: backendReadySignal,
    backendLost: () => fail('backend'),
    tiktokLive: liveSignal,
    tiktokOffline,
    fail,
    retry,
    snapshot,
  });

  document.addEventListener('DOMContentLoaded', documentReady, {once: true});
  const structureObserver = new MutationObserver(() => {
    if (!document.querySelector('#operator-boot-status') || !document.querySelector('.app')) return;
    documentReady();
    structureObserver.disconnect();
  });
  structureObserver.observe(document.documentElement, {childList: true, subtree: true});
  window.addEventListener('tikreader:shell-ready', shellReadySignal, {once: true});
  window.addEventListener('error', event => {
    const source = event.target instanceof HTMLScriptElement ? event.target.src : '';
    if (/\/static\/(?:shell|core_ui)\.js(?:\?|$)/.test(source)) fail('critical-script');
  }, true);
  for (const type of ['click', 'submit', 'beforeinput', 'input', 'change']) {
    document.addEventListener(type, guardInteraction, true);
  }
  document.addEventListener('click', event => {
    if (event.target?.closest?.('#operator-boot-retry')) retry();
  }, true);
  failureTimer = setTimeout(() => {
    if (!backendReady) fail('stalled');
  }, failureDelayMs);
})();
