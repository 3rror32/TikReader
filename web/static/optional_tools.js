// Optional tools register their final panes through OperatorViewRegistry.
window.OptionalTools = (() => {
  const assets = { minecraft: '/static/minecraft.js', 'game-hotkeys': '/static/game_hotkeys.js' };
  const loads = new Map();
  function load(key, pane) {
    if (!Object.hasOwn(assets, key)) return;
    if (loads.has(key)) return loads.get(key);
    pane.replaceChildren();
    pane.setAttribute('aria-busy', 'true');
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    status.textContent = 'Cargando herramienta…';
    pane.append(status);
    const script = document.createElement('script');
    script.src = assets[key];
    // Store before insertion: repeat navigation shares one request.
    const promise = new Promise(resolve => {
      script.onload = () => {
        pane.removeAttribute('aria-busy');
        if (!pane.isConnected) {
          resolve(true);
          return;
        }
        fail();
      };
      function fail() {
        script.remove();
        loads.delete(key);
        pane.removeAttribute('aria-busy');
        status.textContent = 'No se pudo cargar la herramienta.';
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.textContent = 'Reintentar';
        retry.onclick = () => load(key, pane);
        pane.append(retry);
        resolve(false);
      }
      script.onerror = fail;
    });
    loads.set(key, promise);
    document.head.append(script);
    return promise;
  }
  return { has: key => Object.hasOwn(assets, key), load };
})();
