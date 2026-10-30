(() => {
  const stage = document.getElementById('microphone-caption-stage');
  const text = document.getElementById('microphone-caption-text');
  let revision = -1;
  let hideTimer = 0;
  let renderedWords = [];
  let renderedInterim = false;
  let lastTranscriptAt = 0;
  let lastVisibleUntil = 0;
  let lastServerHadText = false;

  function commonPrefixLength(left, right) {
    const length = Math.min(left.length, right.length);
    let index = 0;
    while (index < length && left[index] === right[index]) index += 1;
    return index;
  }

  function revealSentence(value, animation, interim, replay = false, newUtterance = false) {
    const words = String(value).split(/\r?\n/).flatMap((line, index) => {
      const tokens = line.split(/\s+/).filter(Boolean);
      return index ? ['\n', ...tokens] : tokens;
    });
    // Finalization extends the current utterance; a later utterance starts afresh.
    const animateFrom = replay || (newUtterance && !renderedInterim) ? 0 : commonPrefixLength(renderedWords, words);
    let keepNodes = 0;
    for (let index = 0; index < animateFrom; index += 1) {
      keepNodes += words[index] === '\n' ? 1 : (index && words[index - 1] !== '\n' ? 2 : 1);
    }
    while (text.childNodes.length > keepNodes) text.removeChild(text.lastChild);
    text.classList.toggle('is-interim', interim);
    text.classList.toggle('is-visible', Boolean(value));
    const stagger = Math.min(70, Math.max(0, ((Number(stage.dataset.duration) || 5) * 1000 - 800) / Math.max(1, words.length - animateFrom - 1)));
    words.slice(animateFrom).forEach((word, offset) => {
      const index = animateFrom + offset;
      if (word === '\n') { text.append(document.createElement('br')); return; }
      if (index && words[index - 1] !== '\n') text.append(document.createTextNode(' '));
      const span = document.createElement('span');
      span.className = 'microphone-caption-word';
      span.textContent = word;
      span.style.setProperty('--word-length', String(Math.max(1, Array.from(word).length)));
      if (animation !== 'none') {
        span.classList.add('is-new');
        span.style.setProperty('--word-delay', `${offset * stagger}ms`);
      }
      text.append(span);
    });
    renderedWords = words;
    renderedInterim = interim;
  }

  function clearDisplay() {
    clearTimeout(hideTimer);
    text.replaceChildren();
    text.classList.remove('is-visible', 'is-interim');
    renderedWords = [];
    renderedInterim = false;
  }

  function render(state) {
    if (!state || typeof state !== 'object') return;
    const nextRevision = typeof state.revision === 'number' ? state.revision : revision;
    if (nextRevision < revision) return;
    const previousRevision = revision;
    const previousVisibleUntil = lastVisibleUntil;
    const previousHadText = lastServerHadText;
    const settings = state.settings || {};
    stage.dataset.position = settings.position || 'bottom';
    stage.dataset.font = settings.font_family || 'system';
    stage.dataset.animation = settings.animation || 'fade';
    stage.dataset.duration = String(Math.max(.8, Number(state.visible_until) * 1 - Date.now() / 1000 || Number(settings.duration) || 5));
    document.documentElement.style.setProperty('--caption-color', settings.text_color || '#ffffff');
    document.documentElement.style.setProperty('--caption-background', settings.background || '#101925');
    document.documentElement.style.setProperty('--caption-size', `${Number(settings.font_size) || 48}px`);
    text.classList.toggle('without-background', settings.show_background === false);
    text.dataset.style = settings.text_style || 'solid';
    text.dataset.shadow = settings.shadow || 'soft';

    const value = String(state.text || '').trim();
    const interim = Boolean(state.interim);
    const animation = settings.animation || 'fade';
    const visibleUntil = Number(state.visible_until || 0);
    const transcriptAt = Number(state.updated_at || 0);
    const explicitClear = !value && nextRevision > previousRevision && visibleUntil === 0;
    const mutedBeforeExpiry = !value && previousHadText && (renderedInterim || previousVisibleUntil * 1000 > Date.now() + 100);

    if (explicitClear || mutedBeforeExpiry) {
      clearDisplay();
    } else if (value) {
      const newUtterance = Boolean(transcriptAt && transcriptAt !== lastTranscriptAt);
      revealSentence(value, animation, interim, false, newUtterance);
      clearTimeout(hideTimer);
      if (!interim) {
        const remaining = visibleUntil * 1000 - Date.now();
        if (remaining > 0) hideTimer = setTimeout(clearDisplay, remaining + 40);
      }
    }

    revision = nextRevision;
    if (transcriptAt) lastTranscriptAt = transcriptAt;
    lastVisibleUntil = visibleUntil;
    lastServerHadText = Boolean(value);
  }

  async function poll() {
    try {
      const response = await fetch('/broadcast/microphone-captions', {cache: 'no-store'});
      if (response.ok) render(await response.json());
    } catch (_) {}
  }

  if (typeof io === 'function') {
    const socket = io();
    socket.on('microphone_caption', render);
  }
  poll();
  setInterval(poll, 1200);
})();
