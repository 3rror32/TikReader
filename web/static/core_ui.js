/* ── Socket.IO ────────────────────────────────────────────── */
const socket = io({reconnection: true, reconnectionDelay: 1000, reconnectionDelayMax: 10000});
socket.on('simulation_state', data => {window.SimulationUI?.apply(data);window.SimulationUI?.refresh();});
socket.on('production_state', data => window.ProductionUI?.state(data));

let autoScroll = true;
let commentCount = 0;
const MAX_COMMENTS = 200;   // evitar demasiados nodos en DOM
let feedSession = null;
const seenComments = new Set();
let syncingFeed = false;
let syncCursor = 0;
let historySession = null;
let giftVersion = -1;
let statsRevision = -1;
let syncTimer;
const statTimers = new Map();
let stopIntent = null;

function receiveComment(data, live = true) {
  if (data.session !== feedSession) {
    feedSession = data.session;
    syncCursor = 0;
    giftVersion = -1;
    statsRevision = -1;
    seenComments.clear();
    clearFeed();
  }
  if (seenComments.has(data.id)) return;
  seenComments.add(data.id);
  if (seenComments.size > 1000) seenComments.delete(seenComments.values().next().value);
  if (!window.Studio || Studio.ingest(data, live)) addComment(data, live);
}

function receiveHistory(snapshot, incremental = false) {
  const readNew = incremental && snapshot.session === historySession;
  if (snapshot.session !== feedSession) {
    feedSession = snapshot.session;
    syncCursor = 0;
    giftVersion = -1;
    statsRevision = -1;
    seenComments.clear();
    clearFeed();
  }
  snapshot.comments.forEach(data => receiveComment(data, readNew));
  if (snapshot.cursor !== undefined || snapshot.comments.length) historySession = snapshot.session;
  syncCursor = Math.max(syncCursor, snapshot.cursor || 0);
  if (snapshot.stats) applyStats(snapshot.stats);
  if (snapshot.gifts) receiveGifts(snapshot);
  if (snapshot.participants) window.Participants?.render(snapshot.participants);
}

function applyStats(data) {
  if (data.session && data.session !== feedSession) receiveHistory({session: data.session, comments: []});
  if (data.revision < statsRevision) return;
  statsRevision = data.revision ?? statsRevision;
  animateStat('stat-comments', data.comments);
  // Each session starts at zero. TikTok may report the room total a little
  // later; when it does, the following snapshot replaces this value.
  animateStat('stat-likes', Number(data.likes) || 0);
  animateStat('stat-gifts', data.gifts);
  // No viewer report is not proof of an empty room; confirmed zero is numeric.
  const viewersKnown = Number.isFinite(data.viewers) && data.viewers >= 0 && (data.viewers_known || data.viewers > 0);
  animateStat('stat-viewers', viewersKnown ? data.viewers : '—');
  window.LivePresence?.stats(data);
}

function receiveGifts(snapshot) {
  if (snapshot.session !== feedSession) receiveHistory({session: snapshot.session, comments: []});
  if (snapshot.gift_version <= giftVersion) return;
  giftVersion = snapshot.gift_version;
  // Ranking/activity scores are not proof that a gift was sent. Older builds
  // exposed those inferred rows with `summary`; never show them as donations.
  const gifts = (snapshot.gifts || []).filter(gift => !gift.summary);
  const verifiedSnapshot = {...snapshot, gifts};
  if (window.Studio) Studio.gifts(verifiedSnapshot);
  const rows = document.getElementById('gift-rows');
  rows.replaceChildren();
  for (const gift of gifts) {
    const row = document.createElement('tr');
    const quantity = `×${Number(gift.count)}<small style="display:block;color:var(--text-muted)">${gift.diamonds == null ? '◇ sin dato' : `${Number(gift.diamonds)} ◇`}</small>`;
    row.innerHTML = `<td style="padding:10px 6px">${escapeHtml(gift.user)}</td>
      <td style="padding:10px 6px">${escapeHtml(gift.gift)}</td>
      <td style="padding:10px 6px">${quantity}</td>
      <td style="padding:10px 6px;white-space:nowrap">${escapeHtml(formatCommentTime(gift.timestamp))}</td>`;
    if (gift.image_url) {
      try {
        const url = new URL(gift.image_url);
        if (url.protocol === 'https:' && !url.username) {
          const img = document.createElement('img');
          img.alt = gift.gift; img.src = url.href; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer';
          img.style.cssText = 'width:28px;height:28px;object-fit:contain;vertical-align:middle;margin-right:6px';
          img.addEventListener('error', () => img.remove(), {once:true});
          row.children[1].prepend(img);
        }
      } catch (_) {}
    }
    if (gift.avatar_url) {
      try {const url=new URL(gift.avatar_url);if(url.protocol==='https:'&&!url.username){const img=document.createElement('img');img.src=url.href;img.alt=`Foto de ${gift.user}`;img.style.cssText='width:28px;height:28px;border-radius:50%;display:block;margin-bottom:5px';img.referrerPolicy='no-referrer';img.addEventListener('error',()=>img.remove(),{once:true});row.children[0].prepend(img);}}catch(_){}
    }
    rows.appendChild(row);
  }
  document.getElementById('gift-table').hidden = !gifts.length;
  document.getElementById('gift-empty').hidden = !!gifts.length;
}

async function syncFeed() {
  if (syncingFeed) return;
  syncingFeed = true;
  const sessionAtStart = feedSession;
  try {
    const query = new URLSearchParams({session: feedSession || '', after: String(syncCursor), gifts_version: String(giftVersion)});
    const response = await fetch(`/feed?${query}`, {cache: 'no-store', signal: AbortSignal.timeout(5000)});
    if (!response.ok) return;
    const snapshot = await response.json();
    // Ignore an HTTP response from before a live switch via Socket.IO.
    if (sessionAtStart !== feedSession && snapshot.session !== feedSession) return;
    receiveHistory(snapshot, true);
  } catch (_) {
    // Socket.IO reports connection errors; the next sync retries recovery.
  } finally {
    syncingFeed = false;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncFeed, document.hidden ? 15000 : 3000);
  }
}

// WebSocket is immediate; HTTP recovers gaps without reloading the page.
syncTimer = setTimeout(syncFeed, 3000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) syncFeed();
});

/* ── Helpers ─────────────────────────────────────────────── */
function setStatus(msg, type = '') {
  const el = document.getElementById('status-bar');
  el.textContent = msg;
  el.className = type;
  el.dataset.errorKind = '';
}

function animateStat(id, value) {
  const el = document.getElementById(id);
  const text = typeof value === 'number'
    ? value.toLocaleString((window.I18n?.locale || 'es-419'))
    : value;
  if (el.textContent === String(text)) return;
  el.textContent = text;
  el.style.color = 'var(--teal)';
  clearTimeout(statTimers.get(id));
  statTimers.set(id, setTimeout(() => { el.style.color = ''; statTimers.delete(id); }, 400));
}

function showLiveBadge(visible) {
  document.getElementById('live-badge').classList.toggle('visible', visible);
}

function setConnectionState(state) {
  const button = document.getElementById('btn-connect');
  const transitioning = state === 'connecting' || state === 'disconnecting';
  const simulated = document.body.classList.contains('simulation-active');
  const labels = {disconnected: 'Conectar', connecting: 'Conectando…', connected: 'Desconectar', disconnecting: 'Desconectando…'};
  button.dataset.connectionState = state;
  button.dataset.connected = String(state === 'connected');
  button.classList.toggle('is-connecting', state === 'connecting');
  button.classList.toggle('is-disconnecting', state === 'disconnecting');
  button.setAttribute('aria-busy', String(transitioning));
  button.setAttribute('aria-disabled', String(transitioning || simulated));
  button.querySelector('.connect-button__label').textContent = labels[state];
  button.querySelector('.connect-button__icon').dataset.state = state;
  button.disabled = simulated;
  document.getElementById('btn-stop').style.display = state === 'disconnected' ? 'none' : 'inline-flex';
  const cancel = document.getElementById('btn-stop');
  const pending = state === 'connecting';
  const restoreFocus = !pending && document.activeElement === cancel;
  cancel.dataset.pendingCancel = String(pending);
  cancel.setAttribute('aria-hidden', String(!pending));
  cancel.tabIndex = pending ? 0 : -1;
  cancel.disabled = !pending;
  cancel.textContent = 'Cancelar conexión';
  if (restoreFocus) button.focus();
}

function setButtons(connected) {
  if (!connected) stopIntent = null;
  setConnectionState(connected ? 'connected' : 'disconnected');
}

function showToast(msg) {
  if (window.Notifications) { window.Notifications.show(msg, {type: 'success'}); return; }
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.getElementById('toast-container').appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

/* ── Comment rendering ───────────────────────────────────── */
const AVATAR_COLORS = [
  'linear-gradient(135deg,#ff2d55,#9b51e0)',
  'linear-gradient(135deg,#00f5d4,#9b51e0)',
  'linear-gradient(135deg,#ffd166,#ff2d55)',
  'linear-gradient(135deg,#9b51e0,#00f5d4)',
  'linear-gradient(135deg,#ff6b6b,#ffd166)',
];

function getAvatarGrad(user) {
  let h = 0;
  for (const c of user) h = (h * 31 + c.charCodeAt(0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[Math.abs(h)];
}

function formatCommentTime(timestamp) {
  const match = /^(\d{1,2}):(\d{2}):(\d{2})$/.exec(timestamp || '');
  if (!match) return timestamp || '';
  const hour = Number(match[1]);
  return `${hour % 12 || 12}:${match[2]}:${match[3]} ${hour >= 12 ? 'PM' : 'AM'}`;
}

function addComment({ user, emoji, comment, timestamp, sequence, avatar_url, badges, id, session, answered, platform_label, kind }, live = false) {
  const isFollow = kind === 'follow';
  if (!isFollow) commentCount++;

  // Remove empty state
  const es = document.getElementById('empty-state');
  if (es) es.remove();

  const feed = document.getElementById('comment-feed');

  const readingPosition = window.ChatNavigation?.capture();

  const card = document.createElement('div');
  card.className = isFollow ? 'comment-card follow-activity' : 'comment-card';
  card.dataset.sequence = sequence || 0;
  card.innerHTML = `
    <div class="avatar" style="background:${getAvatarGrad(user)}">${escapeHtml(emoji || '💬')}</div>
    <div class="comment-body">
      <div class="comment-user">${escapeHtml(user)}</div>
      <div class="comment-text">${escapeHtml(comment)}</div>
      <div class="comment-meta">${escapeHtml(formatCommentTime(timestamp))}</div>
    </div>`;

  if (platform_label) {
    const chip = document.createElement('span');
    chip.className = 'platform-chip';
    chip.textContent = platform_label;
    card.querySelector('.comment-user').prepend(chip);
  }

  if (!isFollow && window.ChatExtras) {
    window.ChatExtras.badges(card.querySelector('.comment-user'), badges);
    window.ChatExtras.greeting(card.querySelector('.comment-body'), user);
  }
  if (avatar_url) {
    try {
      const url = new URL(avatar_url);
      if (url.protocol === 'https:' && !url.username) {
        const avatar = card.querySelector('.avatar');
        const photo = document.createElement('img');
        photo.alt = `Foto de ${user}`;
        photo.referrerPolicy = 'no-referrer';
        photo.loading = 'lazy';
        photo.decoding = 'async';
        photo.addEventListener('error', () => { avatar.textContent = emoji || '💬'; }, {once: true});
        photo.src = url.href;
        avatar.replaceChildren(photo);
      }
    } catch (_) { /* Keep the fallback avatar for invalid URLs. */ }
  }

  if (!isFollow && window.Studio) Studio.decorate(card, {user, comment, id, session, answered});

  // Recovery may arrive after a newer WebSocket event; preserve its order.
  const first = feed.firstElementChild;
  const next = first && Number(first.dataset.sequence) < Number(card.dataset.sequence)
    ? first : Array.from(feed.children).find(node =>
        Number(node.dataset.sequence) < Number(card.dataset.sequence));
  feed.insertBefore(card, next || null);
  while (feed.children.length > MAX_COMMENTS) feed.removeChild(feed.lastChild);

  if (autoScroll) feed.scrollTop = 0;
  window.ChatNavigation?.inserted(readingPosition, live);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

/* ── Controls ────────────────────────────────────────────── */
function startLive() {
  const button = document.getElementById('btn-connect');
  const state = button.dataset.connectionState || 'disconnected';
  if (state === 'connected') { stopLive(); return; }
  if (state !== 'disconnected' || button.disabled || document.body.classList.contains('simulation-active')) return;
  if (!socket.connected) { setStatus('Sin conexión con el servidor.', 'err'); return; }
  hideError();
  const u = document.getElementById('username-input').value.trim().replace(/^@/, '');
  if (!u) { setStatus('⚠️ Ingresa un nombre de usuario.', 'err'); return; }
  setStatus(`Conectando a @${u}…`);
  stopIntent = null;
  setConnectionState('connecting');
  socket.emit('start_live', { username: u });
}


function stopLive() {
  const state = document.getElementById('btn-connect').dataset.connectionState;
  if (!socket.connected || stopIntent || !['connected', 'connecting'].includes(state)) return;
  stopIntent = state === 'connecting' ? 'cancelled' : 'offline';
  window.LivePresence?.requestStop();
  setConnectionState('disconnecting');
  setStatus('Desconectando…');
  socket.emit('stop_live');
}

function clearFeed() {
  window.ChatNavigation?.reset();
  const feed = document.getElementById('comment-feed');
  feed.innerHTML = '';
  commentCount = 0;
  // Re-add empty state
  const es = document.createElement('div');
  es.id = 'empty-state';
  es.innerHTML = '<p>Conecta un LIVE para ver comentarios.</p>';
  feed.appendChild(es);
}

function toggleAutoScroll() {
  if (window.ChatNavigation) { window.ChatNavigation.follow(!autoScroll); return; }
  autoScroll = !autoScroll;
  const btn = document.getElementById('btn-autoscroll');
  btn.textContent = autoScroll ? '↑ Auto' : '⏸ Manual';
  if (autoScroll) document.getElementById('comment-feed').scrollTop = 0;
  btn.style.color = autoScroll ? 'var(--teal)' : 'var(--gold)';
  btn.style.borderColor = autoScroll ? 'var(--teal)' : 'var(--gold)';
}

const COMMENT_FONT_SIZE_KEY = 'tikreader.commentFontSize';
const COMMENT_FONT_SIZE_MIN = 12;
const COMMENT_FONT_SIZE_MAX = 24;
const COMMENT_FONT_SIZE_DEFAULT = 15;
let commentFontSize = COMMENT_FONT_SIZE_DEFAULT;

function clampCommentFontSize(value) {
  return Math.min(COMMENT_FONT_SIZE_MAX, Math.max(COMMENT_FONT_SIZE_MIN, value));
}

function savedCommentFontSize() {
  try {
    const saved = localStorage.getItem(COMMENT_FONT_SIZE_KEY);
    if (saved === null || !/^-?\d+$/.test(saved.trim())) return COMMENT_FONT_SIZE_DEFAULT;
    return clampCommentFontSize(Number(saved));
  } catch (_) { return COMMENT_FONT_SIZE_DEFAULT; }
}

function applyCommentFontSize(announce = false) {
  const feed = document.getElementById('comment-feed');
  const decrease = document.getElementById('btn-comment-font-decrease');
  const increase = document.getElementById('btn-comment-font-increase');
  const status = document.getElementById('comment-font-size-status');
  if (!feed || !decrease || !increase || !status) return;
  feed.style.setProperty('--chat-font', `${commentFontSize}px`);
  feed.dataset.commentFontSize = String(commentFontSize);
  decrease.disabled = commentFontSize <= COMMENT_FONT_SIZE_MIN;
  increase.disabled = commentFontSize >= COMMENT_FONT_SIZE_MAX;
  if (announce || !status.textContent) status.textContent = `Tamaño del texto de comentarios: ${commentFontSize} px.`;
}

function adjustCommentFontSize(change) {
  commentFontSize = clampCommentFontSize(commentFontSize + change);
  try { localStorage.setItem(COMMENT_FONT_SIZE_KEY, String(commentFontSize)); }
  catch (_) { /* The current page still reflects the selected size without storage access. */ }
  applyCommentFontSize(true);
}

commentFontSize = savedCommentFontSize();
applyCommentFontSize();
document.getElementById('btn-comment-font-decrease')?.addEventListener('click', () => adjustCommentFontSize(-1));
document.getElementById('btn-comment-font-increase')?.addEventListener('click', () => adjustCommentFontSize(1));

/* ── Enter key ───────────────────────────────────────────── */
document.getElementById('username-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') startLive();
});

/* ── Error panel helpers ─────────────────────────────────── */
function showError({ code, title, detail, suggestion }) {
  document.getElementById('err-title').textContent      = title      || 'Error';
  document.getElementById('err-detail').textContent     = detail     || '';
  document.getElementById('err-suggestion').textContent = suggestion ? '💡 ' + suggestion : '';
  const panel = document.getElementById('error-panel');
  panel.dataset.code = code || '';
  panel.classList.add('visible');
  document.getElementById('status-bar').dataset.errorKind = 'classified';
  document.getElementById('error-recovery').textContent = code === 'INVALID_USERNAME' ? 'Revisar usuario' : 'Reintentar conexión';
  const announcement = document.getElementById('connection-error-announcement');
  const message = [title || 'Error', detail, suggestion].filter(Boolean)
    .map(text => window.I18n?.t?.(text) || text).join('. ');
  if (announcement.textContent !== message) announcement.textContent = message;
}

function hideError() {
  document.getElementById('error-panel').classList.remove('visible');
  document.getElementById('connection-error-announcement').textContent = '';
}

function recoverConnection() {
  if (document.getElementById('error-panel').dataset.code === 'INVALID_USERNAME') {
    const input = document.getElementById('username-input');
    input.focus(); input.select();
  } else startLive();
}

/* ── Socket events ───────────────────────────────────────── */
socket.on('connect_error', () => {
  setStatus('No se pudo conectar al servidor. Comprueba que siga ejecutándose.', 'err');
  setButtons(false);
  window.OperatorBoot?.backendLost();
});

socket.on('connect', () => {
  syncFeed();
  window.OperatorBoot?.backendReady();
});

socket.on('reconnecting', ({username, attempt, delay, maximum}) => {
  if (stopIntent) return;
  hideError();
  showLiveBadge(false);
  setConnectionState('connecting');
  setStatus(`⏳ Reconectando a @${username}: intento ${attempt}/${maximum} en ${delay} s…`);
});

socket.on('disconnect', () => {
  setStatus('🔌 Desconectado del servidor.', 'err');
  showLiveBadge(false);
  setButtons(false);
  window.OperatorBoot?.backendLost();
});

socket.on('connecting', ({ username }) => {
  if (stopIntent) return;
  hideError();
  setConnectionState('connecting');
  setStatus(`⏳ Conectando al live de @${username}…`);
});

socket.on('connected', ({ username }) => {
  if (stopIntent) return;
  hideError();
  setStatus(`🟢 Conectado a @${username}`, 'ok');
  showLiveBadge(true);
  setButtons(true);
  window.OperatorBoot?.tiktokLive();
});

socket.on('disconnected', ({ reason }) => {
  window.OperatorBoot?.tiktokOffline();
  if (reason === 'Cerrando conexión') { setStatus('Cerrando conexión…'); return; }
  if (document.getElementById('status-bar').dataset.errorKind !== 'classified') {
    if (stopIntent === 'cancelled' || document.body.dataset.liveState === 'cancelled') setStatus('Conexión cancelada.');
    else if (reason === 'Detenido por el usuario') setStatus('Desconectado.');
    else setStatus(`🔴 Desconectado: ${reason}`, 'err');
  }
  showLiveBadge(false);
  setButtons(false);
});

// Error genérico de socket (fallback)
socket.on('error', ({ message }) => {
  setStatus(`❌ ${message}`, 'err');
  showLiveBadge(false);
  setButtons(false);
});

// Error clasificado de TikTok
socket.on('tiktok_error', (err) => {
  window.OperatorBoot?.tiktokOffline();
  setStatus(`❌ ${err.title}`, 'err');
  showLiveBadge(false);
  setButtons(false);          // re-habilita Conectar
  showError(err);
});

socket.on('new_comment', (data) => {
  receiveComment(data);
});
socket.on('comment_history', receiveHistory);
socket.on('participants_update', data => window.Participants?.render(data));

socket.on('gift_history', receiveGifts);

socket.on('stats_update', applyStats);

socket.on('status', (s) => {
  // Counter snapshots arrive through stats_update and HTTP recovery.
  const button = document.getElementById('btn-connect');
  if (stopIntent && button.dataset.connectionState === 'disconnecting' && (s.connected || s.connecting)) return;
  if (s.connected || s.connecting) {
    setStatus(s.connected ? `🟢 Conectado a @${s.username}` : s.retry_in
      ? `⏳ Reconectando a @${s.username}: intento ${s.retry_count}…`
      : `Conectando a @${s.username}…`);
    showLiveBadge(s.connected);
    if (s.connected) setButtons(true);
    else setConnectionState('connecting');
  } else {
    const stopped = stopIntent;
    showLiveBadge(false);
    setButtons(false);
    if (stopped === 'cancelled') setStatus('Conexión cancelada.');
    else if (stopped === 'offline') setStatus('Desconectado.');
    else if (!['failed','cancelled','offline'].includes(document.body.dataset.liveState)) {
      setStatus('Conectado al servidor. Ingresa un usuario para iniciar.');
    }
  }
});
window.LivePresence?.attach(socket);
window.LiveExperience?.attach(socket);
window.ChatNavigation?.attach(value => { autoScroll = value; });
