/* Run before styles paint, including when this page opens on its own. */
(() => {
  const root = document.documentElement;
  const apply = skin => { root.dataset.skin = typeof skin === 'string' && /^[a-z][a-z0-9-]*$/.test(skin) ? skin : 'original'; };
  try { apply(localStorage.getItem('tikreader.skin')); } catch (_) { apply('original'); }
  if (window.parent !== window) {
    root.dataset.embedded = 'true';
    try { apply(window.parent.document.documentElement.dataset.skin); } catch (_) { /* Cross-origin hosts cannot supply a theme. */ }
  }
  addEventListener('message', event => {
    if (event.origin === location.origin && event.source === window.parent && event.data?.type === 'creator-theme') apply(event.data.skin);
  });
  addEventListener('storage', event => {
    if (event.key === 'tikreader.skin' || event.key === null) apply(event.newValue);
  });
})();
