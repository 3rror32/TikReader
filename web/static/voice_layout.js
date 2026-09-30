// Organize only the chat voice view, preserving the live controls and listeners.
(() => {
  const pane = document.querySelector('[data-pane="tools"]');
  if (!pane) return;
  const heading = pane.querySelector('h2');
  const audioNodes = [];
  for (const node of pane.children) {
    if (node === heading) break;
    audioNodes.push(node);
  }
  const audienceNote = pane.querySelector('#tts-allowed-users').closest('label').nextElementSibling;
  const queueNote = pane.querySelector('#tts-max-age').closest('label').nextElementSibling;
  const group = (title, folded = false) => {
    const section = document.createElement(folded ? 'details' : 'section');
    section.className = 'voice-option-group';
    const caption = document.createElement(folded ? 'summary' : 'h3');
    caption.textContent = title;
    section.append(caption);
    return section;
  };
  const move = (target, ids) => ids.forEach(id => {
    const node = pane.querySelector('#' + id);
    if (node) target.append(node.closest('label') || node);
  });
  const daily = group('Lectura del chat');
  daily.classList.add('voice-daily');
  daily.append(pane.querySelector('.voice-active-card'));
  move(daily, ['tts-enabled', 'tts-gifts-enabled', 'tts-read-name', 'tts-greetings-enabled', 'tts-state']);
  const audience = group('Quién se lee en voz alta');
  move(audience, ['tts-restrict', 'tts-audience', 'tts-allowed-users']);
  audience.append(audienceNote);
  const queue = group('Orden y espera');
  move(queue, ['tts-priority', 'priority-users', 'tts-max-age']);
  const saturation = pane.querySelector('#tts-cap')?.closest('article');
  if (saturation) {
    saturation.querySelector('h3')?.remove();
    queue.append(...saturation.children);
    saturation.remove();
  }
  queue.append(queueNote);
  const optional = group('Micrófono y traducción', true);
  optional.dataset.basicAdvanced = '';
  for (const id of ['mic-start', 'translation-source']) {
    const card = pane.querySelector('#' + id)?.closest('article');
    if (card) optional.append(card);
  }
  const audio = group('Salida de audio y diagnóstico', true);
  audio.dataset.basicAdvanced = '';
  for (const node of audioNodes) {
    if (node.tagName === 'DETAILS') node.open = false;
    audio.append(node);
  }
  const grid = document.createElement('div');
  grid.className = 'voice-options-grid';
  grid.append(audience, queue);
  heading.after(daily, grid, optional, audio);
  pane.classList.add('voice-organized');
})();
