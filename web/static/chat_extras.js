/* TikTok badges and local voice controls. */
window.ChatExtras = (() => {
  function badges(parent, rows) {
    if (!Array.isArray(rows)) return;
    for (const row of rows.slice(0, 8)) {
      if (!row || typeof row !== 'object') continue;
      const badge = document.createElement('span');
      badge.className = 'chat-badge';
      badge.title = String(row.label || 'Insignia de TikTok').slice(0, 80);
      const text = typeof row.text === 'string' ? row.text.slice(0, 40) : '';
      try {
        const url = new URL(row.image_url);
        if (url.protocol === 'https:' && !url.username && !url.password) {
          const img = document.createElement('img');
          img.src = url.href; img.alt = text ? '' : badge.title;
          img.loading = 'lazy'; img.referrerPolicy = 'no-referrer';
          img.addEventListener('error', () => { img.remove(); if (!text) badge.remove(); }, {once:true});
          badge.append(img);
        }
      } catch (_) { /* Invalid art is omitted; supplied text can still be shown. */ }
      if (text) { const label = document.createElement('span'); label.textContent = text; badge.append(label); }
      if (badge.childNodes.length) parent.append(badge);
    }
  }
  function greeting(parent, user) {
    if (typeof user !== 'string' || !user.trim()) return;
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'chat-greet';
    button.textContent = '👋 Saludar';
    button.title = 'Saludo por voz local; no envía mensajes a TikTok';
    button.setAttribute('aria-label', `Saludar por voz a ${user}; no publica en TikTok`);
    button.addEventListener('click', () => {
      window.Studio?.speakManual(`¡Hola, ${user.replace(/^@/, '').slice(0, 80)}! Gracias por acompañarnos.`);
    });
    parent.append(button);
  }
  function bindAutoToggle(button, settingId, label, visibleLabel) {
    const setting=document.getElementById(settingId);
    const sync=()=>{
      button.textContent=visibleLabel;
      button.title=`${setting.checked?'Desactivar':'Activar'} ${label}`;
      button.setAttribute('aria-label',button.title);
      button.setAttribute('aria-pressed',String(setting.checked));
      button.classList.toggle('enabled',setting.checked);
    };
    button.addEventListener('click',()=>{setting.checked=!setting.checked;setting.dispatchEvent(new Event('change'));});
    setting.addEventListener('change',sync);
    new MutationObserver(sync).observe(document.getElementById('tts-state'),{childList:true,characterData:true,subtree:true});
    sync();
  }
  return {badges, greeting, bindAutoToggle};
})();
