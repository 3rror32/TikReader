/* Compact live tools; operational data stays in existing server/voice models. */
window.LiveExperience = (() => {
  const $ = id => document.getElementById(id);
  const make = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  function notify(text) {
    return window.Notifications?.show(text);
  }

  const pending = make('button', 'Pendientes —', 'feed-btn');
  pending.type = 'button'; pending.title = 'Abrir preguntas pendientes agrupadas';
  pending.onclick = () => { window.Shell.show('questions'); };
  document.querySelector('.chat-tools').append(pending);
  const focus = make('button', 'Concentración', 'feed-btn');
  focus.type = 'button'; focus.id = 'concentration-toggle';
  document.querySelector('.feed-actions').append(focus);
  const giftsToggle = make('button', 'Mostrar regalos', 'feed-btn');
  giftsToggle.type = 'button'; giftsToggle.id = 'focus-gifts-toggle';
  const giftsColumn = document.querySelector('.gifts-column');
  giftsColumn.id ||= 'live-focus-gifts';
  giftsToggle.setAttribute('aria-controls', giftsColumn.id);
  document.querySelector('.feed-actions').append(giftsToggle);
  let showGifts = false;
  let focused = false;
  try { focused = localStorage.getItem('tikreader.concentration') === 'true'; } catch (_) {}
  function focusMode() {
    document.body.classList.toggle('concentration', focused);
    focus.textContent = focused ? 'Salir de concentración' : 'Concentración';
    focus.setAttribute('aria-pressed', String(focused));
    if (!focused) showGifts = false;
    document.body.classList.toggle('focus-show-gifts', focused && showGifts);
    giftsToggle.hidden = !focused;
    giftsToggle.textContent = showGifts ? 'Ocultar regalos' : 'Mostrar regalos';
    giftsToggle.setAttribute('aria-expanded', String(focused && showGifts));
  }
  giftsToggle.onclick = () => { showGifts = !showGifts; focusMode(); };
  focus.onclick = () => { focused = !focused; focusMode(); try { localStorage.setItem('tikreader.concentration', String(focused)); } catch (_) {} };
  focusMode();

  const overview = make('section', '', 'live-voice-overview');
  overview.setAttribute('aria-label', 'Lectura por voz');
  const status = make('p', '', 'live-voice-status'); status.id = 'live-voice-status';
  status.setAttribute('role', 'status');
  const count = make('span', '', 'live-voice-count'); count.id = 'live-voice-count';
  const top = make('div', '', 'live-voice-overview-head'); top.append(status, count);
  const current = make('p', 'Sin lectura en curso'); current.id = 'live-voice-current';
  const next = make('p', 'Sin comentarios pendientes'); next.id = 'live-voice-next';
  const nowRow = make('div', '', 'live-voice-message'); nowRow.append(make('span', 'Ahora'), current);
  const nextRow = make('div', '', 'live-voice-message'); nextRow.append(make('span', 'Después'), next);
  nowRow.id = 'live-voice-now-row'; nextRow.id = 'live-voice-next-row';
  overview.append(top, nowRow, nextRow);
  $('voice-visible').hidden = true;
  const queue = make('details', '', 'live-voice-queue');
  const heading = make('summary', 'Cola de lectura · 0');
  const skip = make('button', 'Saltar lectura actual'); skip.type = 'button';
  skip.setAttribute('data-live-label', 'true');
  skip.onclick = () => { $('tts-skip').click(); notify('Lectura saltada.'); };
  const rows = make('div');
  const clearPending = make('button', 'Vaciar pendientes'); clearPending.type = 'button';
  clearPending.setAttribute('data-live-label', 'true');
  clearPending.id = 'live-queue-clear';
  clearPending.onclick = () => {
    const removed = window.Studio.clearPendingVoice();
    notify(removed ? 'Pendientes retirados. La lectura actual continúa.' : 'No hay comentarios pendientes.');
    refreshQueue();
  };
  const queueTools = make('div', '', 'live-queue-tools'); queueTools.append(skip, clearPending);
  queue.append(heading, make('p', 'Organiza los pendientes. Al vaciarlos, la lectura actual continúa.'), queueTools, rows);
  document.querySelector('.voice-dock').after(queue);
  document.querySelector('.voice-dock').after(overview);
  let queueSignature = '';
  let queueControls = [];
  function focusQueueSummary() {
    const toggle = document.querySelector('[aria-controls="live-reading-queue"]');
    (toggle || heading).focus();
  }
  function refreshQueue() {
    const snapshot = window.Studio.voiceSnapshot();
    const signature = JSON.stringify([snapshot.current, snapshot.pending, snapshot.status]);
    if (signature === queueSignature) return;
    const focusedControl = queueControls.find(control => control.node === document.activeElement);
    const clearHadFocus = document.activeElement === clearPending;
    queueSignature = signature;
    heading.textContent = `Cola de lectura · ${snapshot.pending.length}`;
    status.textContent = snapshot.status.replace(/ · cola: \d+$/, '');
    count.textContent = `${snapshot.pending.length} ${snapshot.pending.length === 1 ? 'pendiente' : 'pendientes'}`;
    count.hidden = !snapshot.pending.length;
    current.textContent = snapshot.current || '';
    next.textContent = snapshot.pending[0]?.text || '';
    nowRow.hidden = !snapshot.current;
    nextRow.hidden = !snapshot.pending.length;
    overview.classList.toggle('is-idle', !snapshot.current && !snapshot.pending.length);
    skip.hidden = !snapshot.current;
    clearPending.disabled = !snapshot.pending.length;
    rows.replaceChildren();
    queueControls = [];
    for (const [index, item] of snapshot.pending.entries()) {
      const row = make('div', '', 'live-queue-row');
      row.setAttribute('role', 'group');
      row.setAttribute('aria-label', `Pendiente ${index + 1}: ${item.text}`);
      row.append(make('span', `${index + 1}. ${item.text}`, 'live-queue-text'));
      const actions = make('div', '', 'live-queue-actions');
      for (const [label, action] of [['Subir', 'up'], ['Bajar', 'down'], ['Siguiente', 'front'], ['Quitar', 'remove']]) {
        const button = make('button', label); button.type = 'button';
        button.setAttribute('data-live-label', 'true');
        button.dataset.queueId = String(item.id); button.dataset.queueAction = action;
        button.disabled = (action === 'up' || action === 'front') && index === 0 || action === 'down' && index === snapshot.pending.length - 1;
        button.setAttribute('aria-label', `${label}: ${item.text}`);
        button.onclick = () => {
          const done = window.Studio.editQueue(item.id, action);
          notify(done ? action === 'remove' ? 'Comentario retirado de la cola.' : 'Orden de lectura actualizado.' : 'El comentario ya no está pendiente o no puede moverse en esa dirección.');
          refreshQueue();
        };
        queueControls.push({node:button, id:item.id, action, index});
        actions.append(button);
      }
      row.append(actions);
      rows.append(row);
    }
    if (!snapshot.pending.length) rows.append(make('p', 'No hay comentarios pendientes de lectura.'));
    if (focusedControl) {
      const sameItem = queueControls.filter(control => control.id === focusedControl.id);
      const neighbor = queueControls.filter(control => control.index === Math.min(focusedControl.index, snapshot.pending.length - 1));
      const candidates = sameItem.length ? sameItem : neighbor;
      const target = candidates.find(control => control.action === focusedControl.action && !control.node.disabled)
        || candidates.find(control => !control.node.disabled);
      if (target) target.node.focus(); else focusQueueSummary();
    } else if (clearHadFocus && clearPending.disabled) focusQueueSummary();
  }
  new MutationObserver(refreshQueue).observe($('tts-state'), {childList:true,characterData:true,subtree:true});
  refreshQueue();

  const summaryBox = make('aside', '', 'live-session-summary');
  summaryBox.hidden = true; summaryBox.setAttribute('aria-label', 'Resumen de la sesión terminada');
  document.body.append(summaryBox);
  let completed = '';
  function showSummary(data) {
    if (!data || data.session === completed) return;
    completed = data.session;
    const duration = Math.max(0, Number(data.duration_seconds) || 0);
    const close = make('button', 'Cerrar'); close.type = 'button'; close.onclick = () => {summaryBox.hidden = true;};
    const history = make('button', 'Ver Historial'); history.type = 'button';
    history.onclick = () => {window.Shell.show('history'); summaryBox.hidden = true;};
    summaryBox.replaceChildren(make('h3', 'Sesión finalizada'),
      make('p', `${Math.floor(duration/3600)} h ${Math.floor(duration/60)%60} min ${duration%60} s de sesión`),
      make('p', `${data.comments} comentarios · ${data.gifts} regalos`),
      make('p', `Pico observado: ${data.peak_viewers ?? 'sin datos'} espectadores`),
      make('p', data.saved ? 'Resumen guardado en Historial.' : 'No se pudo guardar el resumen en Historial.'), history, close);
    summaryBox.hidden = false;
  }
  function state(data) {
    const count = data.pending_questions;
    pending.textContent = `Pendientes ${Number.isInteger(count) ? count : '—'}`;
    pending.setAttribute('aria-label', Number.isInteger(count) ? `${count} preguntas pendientes; abrir Moderación` : 'Abrir preguntas pendientes');
    if (!data.connection?.connected && !data.connection?.connecting) showSummary(data.completed_summary);
  }
  function attach(socket) {
    socket.on('session_summary', showSummary);
    socket.on('connected', () => {summaryBox.hidden = true;});
  }
  return {notify, state, attach};
})();
