(() => {
  const body = document.body;
  const panel = document.querySelector('.app > .session-panel, .app > .panel');
  if (!body || !panel) return;
  const translate = value => window.I18n?.t?.(value) || value;

  const create = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  function connectionState() {
    return body.dataset.liveState || 'idle';
  }

  function enhanceEmptyState() {
    const empty = document.getElementById('empty-state');
    if (!empty) return;
    const paragraph = empty.querySelector('p');
    const isLive = connectionState() === 'live';
    if (paragraph && !paragraph.querySelector('strong')) {
      const heading = create('strong', '', translate(isLive ? 'Conexión lista' : 'Tu chat aparecerá aquí'));
      const copy = document.createTextNode(translate(isLive
        ? 'Los próximos comentarios se mostrarán en cuanto lleguen.'
        : 'Conecta un LIVE para ver y escuchar la conversación.'));
      paragraph.replaceChildren(heading, document.createElement('br'), copy);
    }
    let action = empty.querySelector('.empty-state-action');
    if (!action) {
      action = create('button', 'empty-state-action', translate('Conectar un LIVE'));
      action.type = 'button';
      action.addEventListener('click', () => {
        const input = document.getElementById('username-input');
        input?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
        input?.focus();
      });
      empty.append(action);
    }
    action.hidden = isLive;
  }

  const feed = document.getElementById('comment-feed');
  if (feed) new MutationObserver(enhanceEmptyState).observe(feed, { childList: true, subtree: true, characterData: true });
  new MutationObserver(enhanceEmptyState).observe(body, { attributes: true, attributeFilter: ['data-live-state'] });
  enhanceEmptyState();

  const giftEmpty = document.getElementById('gift-empty');
  if (giftEmpty) giftEmpty.textContent = translate('Los regalos aparecerán aquí con su remitente y cantidad cuando comience la actividad.');
  const rankingEmpty = document.getElementById('ranking-empty');
  if (rankingEmpty) rankingEmpty.textContent = translate('El ranking se formará automáticamente con los regalos de esta sesión.');

  const status = document.getElementById('status-bar');
  function syncStatusTone() {
    if (!status) return;
    const text = status.textContent.toLocaleLowerCase();
    status.dataset.tone = status.classList.contains('err') || /error|no se pudo|sin conexión/.test(text)
      ? 'error'
      : /conectando|esperando|reintent/.test(text) ? 'pending'
        : /conectado|listo|activo/.test(text) ? 'success' : 'neutral';
  }
  if (status) {
    new MutationObserver(syncStatusTone).observe(status, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class'] });
    syncStatusTone();
  }

  function svg(path) {
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('aria-hidden', 'true');
    const line = document.createElementNS(icon.namespaceURI, 'path');
    line.setAttribute('d', path);
    icon.append(line);
    return icon;
  }

  const dockItems = [
    { target: 'live', label: 'En vivo', path: 'M4 8v8m4-11v14m4-16v18m4-16v14m4-11v8' },
    { target: 'voice', label: 'Lectura', path: 'M9 4a3 3 0 0 1 6 0v8a3 3 0 0 1-6 0V4m-3 7v1a6 6 0 0 0 12 0v-1m-6 7v4m-4 0h8' },
    { target: 'gifts', label: 'Regalos', path: 'M4 9h16v12H4V9m-1-4h18v4H3V5m9 0v16M12 5c-1-3-5-3-5-.5S10 7 12 5m0 0c1-3 5-3 5-.5S14 7 12 5' },
    { target: 'more', label: 'Más', path: 'M5 7h14M5 12h14M5 17h14' },
  ];
  const dock = create('nav', 'mobile-command-dock');
  dock.setAttribute('aria-label', 'Accesos principales');
  for (const item of dockItems) {
    const button = create('button', '');
    button.type = 'button';
    button.dataset.mobileTarget = item.target;
    button.dataset.defaultLabel = item.label;
    button.dataset.defaultPath = item.path;
    button.append(svg(item.path), create('span', 'mobile-command-label', translate(item.label)));
    button.addEventListener('click', () => {
      if (item.target === 'more') {
        document.getElementById('menu-toggle')?.click();
        return;
      }
      if (item.target === 'gifts') {
        document.querySelector('.app-sidebar [data-section-nav="live"]')?.click();
        requestAnimationFrame(() => {
          const gifts = document.querySelector('.live-columns > .gifts-column');
          gifts?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
          const heading = document.getElementById('gift-heading');
          if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
        });
        return;
      }
      const destination = document.querySelector(`.app-sidebar [data-section-nav="${item.target}"]`);
      destination?.click();
    });
    dock.append(button);
  }
  body.append(dock);

  const sidebar = document.querySelector('.app-sidebar');
  function syncDock() {
    const current = sidebar?.querySelector('[data-section-nav][aria-current="page"], [data-section-nav].active')?.dataset.sectionNav || 'live';
    for (const button of dock.querySelectorAll('button')) {
      const menuControl = button.dataset.mobileTarget === 'more';
      const menuOpen = body.classList.contains('menu-open');
      const active = menuControl ? menuOpen : button.dataset.mobileTarget === current;
      if (menuControl) {
        button.querySelector('.mobile-command-label').textContent = translate(menuOpen ? 'Cerrar' : 'Más');
        button.querySelector('path').setAttribute('d', menuOpen ? 'M6 6l12 12M18 6 6 18' : button.dataset.defaultPath);
        button.setAttribute('aria-expanded', String(menuOpen));
        button.setAttribute('aria-label', translate(menuOpen ? 'Cerrar menú' : 'Abrir más herramientas'));
      } else button.querySelector('.mobile-command-label').textContent = translate(button.dataset.defaultLabel);
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
  }
  if (sidebar) new MutationObserver(syncDock).observe(sidebar, { subtree: true, attributes: true, attributeFilter: ['aria-current', 'class'] });
  new MutationObserver(syncDock).observe(body, { attributes: true, attributeFilter: ['class'] });
  syncDock();
  window.addEventListener('tikreader:localechange', () => {
    enhanceEmptyState();
  });
})();
