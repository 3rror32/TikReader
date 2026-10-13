/* Icon-only controls are limited to the three live columns. */
(() => {
  const root = document.querySelector('.live-columns');
  if (!root) return;
  const scope = '.feed-wrap, .participants-bar, [data-pane="gifts"], .gift-ranking';
  // One operational strip per column; keep the existing handlers and nodes.
  const comments = root.querySelector('.feed-wrap .live-reading-controls');
  const participants = root.querySelector('.participants-bar .live-reading-controls');
  const gifts = root.querySelector('[data-pane="gifts"] .live-reading-controls');
  function disclosure(details, toolbar, id) {
    if (!details || !toolbar) return;
    const summary = details.querySelector(':scope > summary');
    if (!summary) return;
    details.id = id;
    details.classList.add('toolbar-disclosure');
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-controls', id);
    const sync = () => {
      button.textContent = window.I18n?.sourceText(summary) ?? summary.textContent;
      button.setAttribute('aria-expanded', String(details.open));
    };
    button.onclick = () => { details.open = !details.open; sync(); };
    details.addEventListener('toggle', sync);
    new MutationObserver(sync).observe(summary, {childList: true, characterData: true, subtree: true});
    sync();
    toolbar.append(button);
  }
  disclosure(root.querySelector('.live-voice-queue'), comments, 'live-reading-queue');
  const actions = root.querySelector('.feed-actions');
  if (comments && actions) {
    const pending = root.querySelector('.chat-tools > button');
    if (pending) actions.prepend(pending);
    actions.classList.add('live-toolbar-group');
    actions.setAttribute('role', 'group');
    actions.setAttribute('aria-label', 'Acciones de comentarios');
    comments.append(actions);
  }
  const tabs = root.querySelector('.participants-tabs');
  if (participants && tabs) {
    tabs.classList.add('live-toolbar-group');
    tabs.setAttribute('role', 'group');
    tabs.setAttribute('aria-label', 'Vista de participantes');
    participants.append(tabs);
  }
  const rankingGroup = document.createElement('div');
  rankingGroup.className = 'live-toolbar-group';
  if (gifts) {
    gifts.append(rankingGroup);
    disclosure(root.querySelector('.gift-ranking'), rankingGroup, 'live-gift-ranking');
  }
  const ownLabels = new WeakSet();
  function decorate(control) {
    if (!control.closest(scope) || control.matches('.empty-state-action') || control.hasAttribute('data-live-label')) return;
    const text = (window.I18n?.sourceText(control) ?? control.textContent).trim();
    const label = control.getAttribute('aria-label') || text;
    if (!control.hasAttribute('aria-label') || ownLabels.has(control)) {
      ownLabels.add(control);
      control.setAttribute('aria-label', text);
    }
    // The shared tooltip supports both pointer hover and keyboard focus.
    control.removeAttribute('title');
    let icon = 'more';
    if (control.matches('.auto-reading-toggle')) icon = 'voice';
    else if (control.id === 'voice-pause') icon = 'pause';
    else if (/Saltar|Siguiente/.test(text)) icon = 'next';
    else if (control.id === 'btn-autoscroll' || control.id === 'chat-new-messages') icon = 'auto';
    else if (/Limpiar|Quitar/.test(text)) icon = 'trash';
    else if (control.id === 'concentration-toggle') icon = 'focus';
    else if (/Saludar/.test(text)) icon = 'greet';
    else if (/En el chat/.test(text)) icon = 'chat';
    else if (/Se unieron/.test(text)) icon = 'join';
    else if (/Pendientes/.test(text)) icon = 'question';
    else if (/Cola de lectura/.test(text)) icon = 'queue';
    else if (/regaladores/.test(text)) icon = 'trophy';
    else if (/Destacar|Fijar/.test(text)) icon = 'pin';
    else if (/Respondido/.test(text)) icon = 'check';
    else if (/Leer/.test(text)) icon = 'voice';
    control.dataset.liveIcon = icon;
    const help = {
      pause: 'Pausa o continúa la lectura por voz sin desconectar el LIVE.',
      next: 'Interrumpe la lectura actual y pasa a la siguiente pendiente.',
      auto: 'Activa o pausa el seguimiento de los comentarios nuevos.',
      focus: 'Activa o desactiva la vista de concentración del chat.',
      greet: 'Reproduce un saludo por voz local; no publica un comentario en TikTok.',
      chat: 'Muestra las personas observadas en el chat.',
      join: 'Muestra las personas que se unieron a la transmisión.',
      question: 'Abre las preguntas pendientes de responder.',
      queue: 'Muestra u oculta las lecturas pendientes.',
      trophy: 'Muestra u oculta el ranking de regaladores de esta sesión.',
      pin: 'Destaca este comentario en pantalla.',
      check: 'Marca este comentario como respondido.',
    };
    const byId = {
      'voice-toggle': 'Activa o desactiva la lectura automática de comentarios nuevos.',
      'gift-auto-toggle': 'Activa o desactiva la lectura automática de regalos nuevos.',
      'greeting-auto-toggle': 'Activa o desactiva los saludos automáticos a personas nuevas.',
      'chat-new-messages': 'Vuelve a los comentarios más recientes y activa el seguimiento.',
    };
    const specific = control.matches('.feed-actions > button[onclick="clearFeed()"]') ? 'Limpia los comentarios visibles; no borra el historial guardado.' : '';
    control.dataset.help = byId[control.id] || specific || help[icon] || (icon === 'voice' && !text.includes('traducción') ? 'Lee este comentario en voz alta.' : control.getAttribute('aria-label') || label);
  }
  function scan(node) {
    if (node.nodeType !== 1) return;
    if (node.matches('button, summary')) decorate(node);
    node.querySelectorAll('button, summary').forEach(decorate);
  }
  scan(root);
  new MutationObserver(records => {
    for (const record of records) {
      const element = record.target.nodeType === 1 ? record.target : record.target.parentElement;
      const control = element?.closest('button, summary');
      if (control) decorate(control);
      record.addedNodes.forEach(scan);
    }
  }).observe(root, {childList: true, characterData: true, subtree: true});
})();
