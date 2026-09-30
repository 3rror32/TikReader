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
  let focused = false;
  try { focused = localStorage.getItem('tikreader.concentration') === 'true'; } catch (_) {}
  function focusMode() {
    document.body.classList.toggle('concentration', focused);
    focus.textContent = focused ? 'Salir de concentración' : 'Concentración';
    focus.setAttribute('aria-pressed', String(focused));
  }
  focus.onclick = () => { focused = !focused; focusMode(); try { localStorage.setItem('tikreader.concentration', String(focused)); } catch (_) {} };
  focusMode();

  const queue = make('details', '', 'live-voice-queue');
  const heading = make('summary', 'Cola de lectura · 0');
  const current = make('p', 'Sin lectura en curso');
  const skip = make('button', 'Saltar lectura actual'); skip.type = 'button';
  skip.onclick = () => { $('tts-skip').click(); notify('Lectura saltada.'); };
  const rows = make('div');
  queue.append(heading, current, skip, rows);
  document.querySelector('.voice-dock').after(queue);
  let queueSignature = '';
  function refreshQueue() {
    const snapshot = window.Studio.voiceSnapshot();
    const signature = JSON.stringify([snapshot.current, snapshot.pending, snapshot.status]);
    if (signature === queueSignature) return;
    queueSignature = signature;
    heading.textContent = `Cola de lectura · ${snapshot.pending.length}`;
    current.textContent = snapshot.current ? `Leyendo: ${snapshot.current}` : 'Sin lectura en curso';
    skip.hidden = !snapshot.current;
    rows.replaceChildren();
    for (const item of snapshot.pending) {
      const row = make('div', '', 'live-queue-row');
      row.append(make('span', item.text));
      for (const [label, action] of [['Siguiente', 'front'], ['Quitar', 'remove']]) {
        const button = make('button', label); button.type = 'button';
        button.setAttribute('aria-label', `${label}: ${item.text}`);
        button.onclick = () => {
          const done = window.Studio.editQueue(item.id, action);
          notify(done ? action === 'remove' ? 'Comentario retirado de la cola.' : 'Comentario colocado como siguiente.' : 'Ese comentario ya no está pendiente.');
          refreshQueue();
        };
        row.append(button);
      }
      rows.append(row);
    }
    if (!snapshot.pending.length) rows.append(make('p', 'No hay comentarios pendientes de lectura.'));
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
