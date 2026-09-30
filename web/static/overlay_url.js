/* LIVE Studio rejects bare loopback hosts; the fragment satisfies its URL validator.
   Keep editor previews on their original origin so postMessage continues to work. */
window.overlayUrl = function (path, options = {}) {
  const url = new URL(path, window.location.origin);
  if (options.canvasFormat === 'horizontal' || options.canvasFormat === 'vertical') {
    url.searchParams.set('canvas_format', options.canvasFormat);
  }
  if (['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
    url.hostname = 'localhost';
  }
  if (document.body?.dataset?.lanEnabled === 'true' && document.body.dataset.lanViewToken) {
    url.searchParams.set('access', document.body.dataset.lanViewToken);
  }
  url.hash = 'tikreader.local';
  return url.href;
};
