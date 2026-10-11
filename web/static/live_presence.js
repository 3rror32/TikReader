/* Connection presentation: Socket.IO confirms connection; silence is not failure. */
window.LivePresence = (() => {
  const $ = id => document.getElementById(id);
  const translate = value => window.I18n?.t?.(value) || value;
  const panel = document.querySelector('.app > .panel');
  panel.classList.add('session-panel');
  // Keep routine technical messages available without crowding the live view.
  const diagnosticsPane = document.querySelector('[data-pane="diagnostics"]');
  const connectionDetails = document.createElement('details');
  connectionDetails.className = 'setting-card connection-messages';
  const summary = document.createElement('summary');
  summary.textContent = 'Detalles de conexión y origen de los datos';
  connectionDetails.append(summary);
  for (const id of ['status-bar']) {
    const message = $(id);
    if (message) connectionDetails.append(message);
  }
  diagnosticsPane.append(connectionDetails);
  const logs = document.createElement('section');
  logs.className = 'setting-card';
  logs.innerHTML = '<h3>Registros diarios</h3><p>Se conservan los últimos 30 días en data/logs. No incluyen nombres ni comentarios del chat.</p><div class="tool-buttons"><button type="button" id="daily-log-download">Descargar registro de hoy</button><button type="button" id="daily-log-folder">Abrir carpeta de logs</button></div><p id="daily-log-notice" role="status"></p>';
  diagnosticsPane.append(logs);
  $('daily-log-download').onclick = async () => {
    try {
      const response = await fetch('/diagnostics/logs/today');
      if (!response.ok) throw Error((await response.json()).error || 'No se pudo descargar el registro');
      const url = URL.createObjectURL(await response.blob()), link = document.createElement('a');
      link.href = url; link.download = 'tikreader-' + new Date().toLocaleDateString('sv-SE') + '.log';
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      $('daily-log-notice').textContent = 'Registro descargado.';
    } catch (error) { $('daily-log-notice').textContent = error.message; }
  };
  $('daily-log-folder').onclick = async () => {
    try {
      const response = await fetch('/diagnostics/logs/open-folder', {method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
      if (!response.ok) throw Error((await response.json()).error || 'No se pudo abrir la carpeta');
      $('daily-log-notice').textContent = 'Carpeta abierta.';
    } catch (error) { $('daily-log-notice').textContent = error.message; }
  };
  for (const id of ['like-status', 'data-freshness']) {
    const message = $(id);
    if (message) message.hidden = true;
  }
  const warning = document.createElement('p');
  warning.className = 'session-warning';
  warning.id = 'connection-inline-status';
  warning.setAttribute('role', 'alert');
  warning.hidden = true;
  panel.append(warning);
  function syncWarning() {
    const status = $('status-bar');
    const detailedErrorVisible = $('error-panel').classList.contains('visible');
    const message = status.classList.contains('err') && status.dataset.errorKind !== 'classified' && !detailedErrorVisible ? status.textContent : '';
    if (message && window.LiveExperience) {
      if (warning.dataset.message !== message) window.LiveExperience.notify(message);
      warning.dataset.message = message;
      warning.hidden = true;
      return;
    }
    warning.dataset.message = message;
    if (warning.textContent !== message) warning.textContent = message;
    warning.hidden = !message;
  }
  new MutationObserver(syncWarning).observe($('status-bar'), {childList:true, characterData:true, subtree:true, attributes:true, attributeFilter:['class']});
  new MutationObserver(syncWarning).observe($('error-panel'), {attributes:true, attributeFilter:['class']});
  syncWarning();
  const hero = document.createElement('section');
  hero.className = 'session-hero';
  hero.setAttribute('aria-label', 'Sesión de TikTok');
  hero.innerHTML = `<div class="session-avatar" aria-hidden="true">TR</div>
    <div class="session-identity"><p class="session-eyebrow">TIKTOK LIVE · ESTUDIO</p>
    <h2 id="session-heading">Listo para conectar</h2>
    <p id="session-channel">Conecta un canal para seguir su directo.</p></div>
    <div class="session-clock"><span id="session-clock">00:00:00</span><small>Conectado en esta ventana</small></div>`;
  panel.prepend(hero);
  const activity = document.createElement('div');
  activity.className = 'session-activity';
  activity.innerHTML = '<span class="activity-dot" aria-hidden="true"></span><span id="session-activity-text">Sin conexión a TikTok</span><span class="session-platform">Conexión a TikTok · El programa de streaming se gestiona por separado</span>';
  hero.after(activity);
  const persistent = document.createElement('div');
  persistent.id = 'session-persistent';
  persistent.setAttribute('role', 'status');
  persistent.innerHTML = '<span class="session-live-dot" aria-hidden="true"></span><span class="session-persistent-label" translate="no" aria-hidden="true"></span>';
  const persistentLabel = persistent.querySelector('.session-persistent-label');
  const liveDot = persistent.querySelector('.session-live-dot');
  let liveLightAnimation = null;
  function syncLiveLight(isLive) {
    if (isLive && !liveLightAnimation) {
      // Animate this status light directly, independently of stylesheet motion resets.
      liveLightAnimation = liveDot.animate([
        { opacity: 1, boxShadow: '0 0 8px 2px #f52d5680' },
        { opacity: 0.04, boxShadow: '0 0 0 0 #f52d5600' },
        { opacity: 1, boxShadow: '0 0 8px 2px #f52d5680' }
      ], { duration: 2800, iterations: Infinity, easing: 'ease-in-out' });
    } else if (!isLive && liveLightAnimation) {
      liveLightAnimation.cancel();
      liveLightAnimation = null;
    }
  }
  const donate = document.createElement('a');
  donate.id = 'donation-button';
  donate.href = 'https://ko-fi.com/3rror32?ref=onboarding_email_founderwelcome#checkoutModal';
  donate.target = '_blank';
  donate.rel = 'noopener noreferrer';
  donate.style.textDecoration = 'none';
  donate.className = 'project-support-button';
  donate.dataset.text = 'APOYAR EL PROYECTO';
  donate.innerHTML = '<span aria-hidden="true">☕</span><b>Apoyar el proyecto</b>';
  donate.setAttribute('aria-label', 'Regálame un café en Ko-fi. Se abre en una pestaña nueva.');
  donate.title = 'Apoyar en Ko-fi';
  const aboutDonate = donate.cloneNode(true);
  aboutDonate.removeAttribute('id');
  const headerActions = document.createElement('div');
  headerActions.className = 'header-session-actions';
  const safety = document.querySelector('.broadcast-safety');
  headerActions.append(persistent);
  if (safety) headerActions.append(safety);
  headerActions.append(donate);
  document.querySelector('.creator-actions')?.append(aboutDonate);
  document.querySelector('header').append(headerActions);
  const viewerCard = $('stat-viewers').closest('.stat-card');
  viewerCard.classList.add('stat-audience');
  viewerCard.parentElement.prepend(viewerCard);
  $('btn-stop').textContent = 'Desconectar';
  $('username-input').setAttribute('aria-label', 'Usuario de TikTok');
  $('username-input').setAttribute('aria-describedby', 'connection-inline-status');
  let mode = 'idle', username = '', since = 0, lastComment = 0, lastEvent = 0, pulseTimer, retryAt = 0;
  let latestStats = null, stopTarget = null;
  function stats(data) {
    latestStats = data;
    for (const [key, label] of [['likes','Likes'],['viewers','Espectadores'],['comments','Comentarios'],['gifts','Regalos']]) {
      const value = $('stat-' + key), card = value.closest('.stat-card');
      const pending = key === 'likes' ? !(data.likes_known || data.like_events) : key === 'viewers' ? !(Number.isFinite(data.viewers) && data.viewers >= 0 && (data.viewers_known || data.viewers > 0)) : false;
      const recovered = key === 'likes' && data.likes_source === 'recovered';
      const state = mode !== 'live' ? 'inactive' : pending ? 'pending' : recovered ? 'recovered' : 'current';
      card.dataset.valueState = state;
      const note = translate(pending ? 'Esperando datos de TikTok' : state === 'inactive' ? 'Último valor observado; sin conexión activa' : recovered ? 'Total recuperado; pendiente de actualización en vivo' : 'Datos de la conexión actual');
      card.title = `${translate(label)}: ${note}`;
      const observed = key === 'viewers' && pending ? translate('Sin datos recibidos') : value.textContent;
      const accessible = `${translate(label)}: ${observed}. ${note}`;
      if (value.getAttribute('aria-label') !== accessible) value.setAttribute('aria-label', accessible);
    }
  }
  const titles = {idle:'Listo para conectar', connecting:'CONECTANDO', reconnecting:'RECONECTANDO', live:'EN VIVO', offline:'SIN CONEXIÓN', cancelled:'Conexión cancelada', failed:'No se pudo conectar'};
  function requestStop() { stopTarget = ['connecting','reconnecting'].includes(mode) ? 'cancelled' : 'offline'; }
  function tick() {
    const elapsed = since ? Math.max(0, Math.floor((Date.now() - since) / 1000)) : 0;
    $('session-clock').textContent = [Math.floor(elapsed / 3600), Math.floor(elapsed / 60) % 60, elapsed % 60].map(n => String(n).padStart(2, '0')).join(':');
    const age = at => Math.max(0, Math.floor((Date.now() - at) / 1000));
    $('session-activity-text').textContent = mode === 'live'
      ? lastComment ? `Último comentario hace ${age(lastComment)} s` : lastEvent ? `Última actividad hace ${age(lastEvent)} s · esperando comentarios` : 'Conectado · esperando actividad'
      : mode === 'reconnecting' ? retryAt > Date.now() ? `Próximo intento en ${Math.ceil((retryAt-Date.now())/1000)} s` : 'Intentando recuperar la conexión a TikTok…' : mode === 'connecting' ? 'Esperando confirmación de TikTok…' : 'Sin conexión a TikTok';
  }
  function set(next, user) {
    if (next === 'connecting' && mode !== 'connecting') {
      latestStats = {...latestStats, viewers: null, viewers_known: false};
      $('stat-viewers').textContent = '—';
    }
    if (user) username = String(user).replace(/^@/, '');
    if (next === 'live' && mode !== 'live') since = Date.now();
    if (next !== 'live') { since = 0; lastComment = 0; lastEvent = 0; }
    mode = next;
    if (mode !== 'reconnecting') retryAt = 0;
    $('btn-stop').textContent = ['connecting','reconnecting'].includes(mode) ? 'Cancelar conexión' : 'Desconectar';
    document.body.dataset.liveState = mode;
    syncLiveLight(mode === 'live');
    if (latestStats) stats(latestStats);
    const title = translate(titles[mode]);
    if ($('session-heading').textContent !== title) $('session-heading').textContent = title;
    $('session-channel').textContent = username && ['live','connecting','reconnecting'].includes(mode) ? `@${username}` : 'Conecta un canal para seguir su directo.';
    hero.querySelector('.session-avatar').textContent = username ? username.slice(0, 2).toUpperCase() : 'TR';
    persistentLabel.textContent = 'LIVE';
    const connectionSource = mode === 'live' ? 'Conectado a @{username}' : mode === 'connecting' ? 'Conectando a @{username}' : mode === 'reconnecting' ? 'Reconectando a @{username}' : titles[mode];
    const connectionLabel = window.I18n?.t?.(connectionSource, {username}) || connectionSource.replace('{username}', username);
    // Errors have their own announcement path; routine clocks and metrics are not live regions.
    persistent.setAttribute('aria-live', ['failed','offline'].includes(mode) ? 'off' : 'polite');
    if (persistent.getAttribute('aria-label') !== connectionLabel) persistent.setAttribute('aria-label', connectionLabel);
    persistent.title = connectionLabel;
    // Restore the empty feed's message when a connection ends.
    const empty = $('empty-state')?.querySelector('p');
    if (empty) empty.textContent = mode === 'live' ? 'Conexión lista. Los próximos comentarios aparecerán aquí.' : 'Conecta una transmisión activa para empezar a leer comentarios.';
    tick();
  }
  function event(at = Date.now(), comment = false) {
    if (mode !== 'live') return;
    if (comment) lastComment = at;
    if (at <= lastEvent) { tick(); return; }
    lastEvent = at;
    activity.classList.add('has-activity');
    clearTimeout(pulseTimer);
    pulseTimer = setTimeout(() => activity.classList.remove('has-activity'), 700);
    tick();
  }
  function attach(socket) {
  socket.on('connected', data => {stopTarget = null;set('live', data.username);});
  socket.on('connecting', data => {stopTarget = null;set('connecting', data.username);});
  socket.on('reconnecting', data => {retryAt = Date.now() + Math.max(0, Number(data.delay)||0)*1000;set('reconnecting', data.username);});
  socket.on('status', data => {
    retryAt = Date.now() + Math.max(0, Number(data.retry_in)||0)*1000;
    const terminal = stopTarget || (['failed','cancelled','offline'].includes(mode) ? mode : mode === 'live' ? 'offline' : 'idle');
    if (!data.connected && !data.connecting) stopTarget = null;
    set(data.connected ? 'live' : data.connecting ? data.retry_count ? 'reconnecting' : 'connecting' : terminal, data.username);
  });
  socket.on('disconnected', data => {
    if (data.reason === 'Cerrando conexión') return;
    const userCancelled = data.reason === 'Detenido por el usuario' && ['connecting','reconnecting'].includes(mode);
    const next = ['failed','cancelled'].includes(mode) ? mode : stopTarget || (userCancelled ? 'cancelled' : 'offline');
    stopTarget = null;
    set(next);
  });
  for (const name of ['error','tiktok_error']) socket.on(name, () => {stopTarget = null;set('failed');});
  for (const name of ['disconnect','connect_error']) socket.on(name, () => {stopTarget = null;set('offline');});
  socket.on('new_comment', () => event(Date.now(), true));
  }
  // Diagnostic timestamps distinguish real activity from periodic snapshots.
  function diagnostics(data) {
    if (mode !== 'live') return;
    const comment = Number(data.diagnostics?.comment) * 1000;
    if (comment >= since && comment > lastComment) event(comment, true);
    const newest = Math.max(...['like','gift','viewers'].map(key => Number(data.diagnostics?.[key]) * 1000 || 0));
    if (newest >= since) event(newest);
  }
  set('idle');
  // Preserve only collapsible navigation/settings sections, never operational state.
  let savedDetails = {};
  try { savedDetails = JSON.parse(localStorage.getItem('tikreader.expandedSections') || '{}') || {}; } catch (_) {}
  const occurrences = new Map();
  for (const details of document.querySelectorAll('.app-sidebar details, .settings-view details')) {
    const section = details.closest('[data-pane], [data-section]');
    const base = (section?.dataset.pane || section?.dataset.section || 'navigation') + ':' + (details.querySelector('summary')?.textContent || '');
    const index = occurrences.get(base) || 0; occurrences.set(base, index+1);
    const key = base + ':' + index;
    if (typeof savedDetails[key] === 'boolean') details.open = savedDetails[key];
    details.addEventListener('toggle', () => {
      savedDetails[key] = details.open;
      try { localStorage.setItem('tikreader.expandedSections', JSON.stringify(savedDetails)); } catch (_) {}
    });
  }
  setInterval(tick, 1000);
  window.addEventListener('tikreader:localechange', () => set(mode));
  return {diagnostics, attach, stats, requestStop};
})();
