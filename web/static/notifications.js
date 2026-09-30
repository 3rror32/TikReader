/* Centro único para avisos transitorios de toda la cabina. */
window.Notifications = (() => {
  let container;
  let lastText = '';
  let lastAt = 0;

  function root() {
    if (container?.isConnected) return container;
    container = document.getElementById('notification-center') || document.createElement('div');
    container.id = 'notification-center';
    container.className = 'notification-center';
    container.setAttribute('aria-label', 'Notificaciones');
    container.setAttribute('aria-live', 'polite');
    if (!container.isConnected) document.body.append(container);
    return container;
  }

  function show(text, options = {}) {
    text = String(text || '').trim();
    if (!text) return null;
    const now = Date.now();
    if (!options.allowDuplicate && text === lastText && now - lastAt < 2500) return null;
    lastText = text; lastAt = now;

    const item = document.createElement('div');
    item.className = `app-notification ${options.type || 'info'}`;
    item.setAttribute('role', options.type === 'error' ? 'alert' : 'status');
    const message = document.createElement('span');
    message.textContent = text;
    const close = document.createElement('button');
    close.type = 'button'; close.textContent = '×';
    close.setAttribute('aria-label', 'Cerrar notificación');
    let timer;
    const dismiss = () => { clearTimeout(timer); item.remove(); };
    const schedule = () => {
      clearTimeout(timer);
      if (options.persistent !== true) timer = setTimeout(dismiss, options.duration || 10000);
    };
    close.onclick = dismiss;
    item.onmouseenter = item.onfocusin = () => clearTimeout(timer);
    item.onmouseleave = item.onfocusout = schedule;
    item.append(message);
    if (options.actionLabel && typeof options.action === 'function') {
      const action = document.createElement('button');
      action.type = 'button'; action.className = 'notification-action';
      action.textContent = options.actionLabel; action.onclick = options.action;
      item.append(action);
    }
    item.append(close);
    root().append(item);
    while (root().children.length > 4) root().firstElementChild.remove();
    schedule();
    return item;
  }

  return {show};
})();
