(() => {
  const root = document.getElementById('platform-connectors');
  if (!root || typeof socket === 'undefined') return;
  const names = {youtube: 'YouTube', twitch: 'Twitch'};
  const credentials = {youtube: false, twitch: false};
  let lastSnapshot = null;

  function fields(platform) {
    if (platform === 'youtube') return {video: document.getElementById('youtube-video').value.trim()};
    return {channel: document.getElementById('twitch-channel').value.trim()};
  }

  async function credentialRequest(method = 'GET', payload) {
    const options = {method, headers: {'Content-Type': 'application/json'}};
    if (payload) options.body = JSON.stringify(payload);
    const response = await fetch('/system/platform-credentials', options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'No se pudo guardar la configuración.');
    return data;
  }

  function setFormStatus(platform, message, error = false) {
    const node = document.getElementById(`${platform}-credentials-status`);
    if (!node) return;
    node.textContent = message;
    node.classList.toggle('is-error', error);
  }

  function renderCredentials(snapshot) {
    const platforms = snapshot?.platforms || [];
    for (const platform of Object.keys(credentials)) {
      const item = platforms.find(row => row.platform === platform) || {configured: false};
      credentials[platform] = Boolean(item.configured);
      const state = document.querySelector(`[data-platform-config-state="${platform}"]`);
      if (state) {
        state.textContent = item.configured ? 'Configurado' : 'Falta configurar';
        state.classList.toggle('is-ready', Boolean(item.configured));
      }
      const remove = document.querySelector(`[data-platform-delete="${platform}"]`);
      if (remove) remove.hidden = !item.configured;
      const settings = root.querySelector(`[data-platform-settings="${platform}"]`);
      if (settings) settings.textContent = item.configured ? 'Cambiar configuración' : `Configurar ${names[platform]}`;
      if (platform === 'twitch' && item.nickname) document.getElementById('twitch-nickname').value = item.nickname;
    }
    const storage = document.getElementById('platform-storage-note');
    if (storage) storage.textContent = snapshot?.storage === 'windows-user'
      ? 'Windows cifra las claves para este usuario. No aparecen en el historial, los diagnósticos ni el navegador.'
      : 'En este entorno las claves duran únicamente mientras TikReader permanece abierto.';
    if (lastSnapshot) render(lastSnapshot);
  }

  function render(snapshot) {
    lastSnapshot = snapshot;
    const platforms = snapshot?.platforms || [];
    let active = 0;
    const connectedNames = [];
    for (const item of platforms) {
      const card = root.querySelector(`[data-platform-card="${item.platform}"]`);
      if (!card) continue;
      const busy = item.state === 'connecting' || item.state === 'connected';
      card.classList.toggle('is-connected', item.state === 'connected');
      card.classList.toggle('is-connecting', item.state === 'connecting');
      card.querySelector('[data-platform-connect]').disabled = busy || !credentials[item.platform];
      card.querySelector('[data-platform-stop]').hidden = !busy;
      const status = document.getElementById(`${item.platform}-platform-status`);
      if (item.state === 'connected') {
        status.textContent = `Conectado · ${item.channel || 'en vivo'}`;
        active += 1;
        connectedNames.push(names[item.platform]);
      } else if (item.state === 'connecting') {
        status.textContent = 'Conectando…';
        active += 1;
      } else if (item.state === 'error') {
        status.textContent = item.error?.title || 'Error de conexión';
      } else {
        status.textContent = credentials[item.platform] ? 'Listo para conectar' : 'Falta configurar';
      }
    }
    const tiktokActive = getComputedStyle(document.getElementById('btn-stop')).display !== 'none';
    if (active) {
      showLiveBadge(true);
      if (!tiktokActive && connectedNames.length) setStatus(`🟢 Conectado a ${connectedNames.join(' + ')}`, 'ok');
    } else if (!tiktokActive) {
      showLiveBadge(false);
    }
    root.dataset.active = String(active);
  }

  function openSettings(platform) {
    window.Shell?.show('platform-integrations');
    requestAnimationFrame(() => document.querySelector(`[data-platform-config-card="${platform}"] input`)?.focus());
  }

  for (const button of root.querySelectorAll('[data-platform-settings]')) {
    button.addEventListener('click', () => openSettings(button.dataset.platformSettings));
  }

  for (const button of root.querySelectorAll('[data-platform-connect]')) {
    button.addEventListener('click', () => {
      const platform = button.dataset.platformConnect;
      if (!credentials[platform]) {
        setStatus(`Configura ${names[platform]} antes de conectarlo.`, 'err');
        openSettings(platform);
        return;
      }
      if (!socket.connected) {
        setStatus('Sin conexión con el servidor.', 'err');
        return;
      }
      hideError();
      setStatus(`Conectando ${names[platform]}…`);
      socket.emit('start_platform', {platform, config: fields(platform)});
    });
  }

  for (const button of root.querySelectorAll('[data-platform-stop]')) {
    button.addEventListener('click', () => socket.emit('stop_platform', {platform: button.dataset.platformStop}));
  }

  const youtubeForm = document.getElementById('youtube-credentials-form');
  youtubeForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const input = document.getElementById('youtube-api-key');
    const apiKey = input.value.trim();
    if (!apiKey) return setFormStatus('youtube', 'Pega una clave nueva para guardarla.', true);
    setFormStatus('youtube', 'Protegiendo la clave…');
    try {
      await credentialRequest('POST', {platform: 'youtube', credentials: {api_key: apiKey}});
      input.value = '';
      setFormStatus('youtube', 'YouTube quedó configurado para este equipo.');
      renderCredentials(await credentialRequest());
    } catch (error) {
      setFormStatus('youtube', error.message, true);
    }
  });

  const twitchForm = document.getElementById('twitch-credentials-form');
  twitchForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const nickname = document.getElementById('twitch-nickname').value.trim();
    const input = document.getElementById('twitch-token');
    const token = input.value.trim();
    if (!nickname || !token) return setFormStatus('twitch', 'Completa el usuario y pega un token nuevo.', true);
    setFormStatus('twitch', 'Protegiendo el acceso…');
    try {
      await credentialRequest('POST', {platform: 'twitch', credentials: {nickname, token}});
      input.value = '';
      setFormStatus('twitch', 'Twitch quedó configurado para este equipo.');
      renderCredentials(await credentialRequest());
    } catch (error) {
      setFormStatus('twitch', error.message, true);
    }
  });

  for (const button of document.querySelectorAll('[data-platform-delete]')) {
    button.addEventListener('click', async () => {
      const platform = button.dataset.platformDelete;
      const ask = window.I18n?.confirm || window.confirm;
      if (!ask(`¿Eliminar la credencial guardada de ${names[platform]}?`)) return;
      setFormStatus(platform, 'Eliminando credencial…');
      try {
        const snapshot = await credentialRequest('DELETE', {platform});
        if (platform === 'twitch') document.getElementById('twitch-nickname').value = '';
        setFormStatus(platform, 'Credencial eliminada.');
        renderCredentials(snapshot);
      } catch (error) {
        setFormStatus(platform, error.message, true);
      }
    });
  }

  document.getElementById('platform-back-live')?.addEventListener('click', () => window.Shell?.show('live'));
  socket.on('platform_status', render);
  socket.on('platform_error', error => {
    setStatus(`❌ ${error.title || 'No se pudo conectar la plataforma'}`, 'err');
    showError(error);
  });
  credentialRequest().then(renderCredentials).catch(error => {
    for (const platform of Object.keys(credentials)) setFormStatus(platform, error.message, true);
  });
  socket.emit('platform_status_request');
})();
