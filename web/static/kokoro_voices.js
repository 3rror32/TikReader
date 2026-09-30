window.KokoroVoices = (() => {
  const $ = id => document.getElementById(id);
  let voices = [], ready = false, selected = 'ef_dora';
  try {const saved = JSON.parse(localStorage.getItem('tikreader.voiceCharacter') || 'null');
    if (saved?.engine === 'kokoro') selected = saved.voice;
  } catch (_) {}
  function current() {return voices.find(v => v.id === selected);}
  function refresh() {document.dispatchEvent(new CustomEvent('kokoro:updated'));}
  async function load() {
    try {
      const response = await fetch('/local-tts', {cache: 'no-store'});
      if (!response.ok) throw Error();
      const data = await response.json();
      voices = data.voices; ready = data.ready;
      const list = $('kokoro-voices'); list.replaceChildren();
      const groups = new Map();
      for (const voice of voices) {
        if (!groups.has(voice.language)) {
          const section = document.createElement('section'), heading = document.createElement('h4');
          heading.textContent = voice.language; section.append(heading);
          const rows = document.createElement('div'); rows.className = 'voice-character-list';
          section.append(rows); list.append(section); groups.set(voice.language, rows);
        }
        const row = document.createElement('div'); row.className = 'voice-character';
        const label = document.createElement('label'), radio = document.createElement('input');
        radio.type = 'radio'; radio.name = 'kokoro-voice'; radio.value = voice.id;
        radio.checked = voice.id === selected; radio.disabled = !ready;
        const copy = document.createElement('span'), name = document.createElement('b'), note = document.createElement('small');
        name.textContent = voice.name; name.translate = false; note.textContent = voice.gender;
        copy.append(name, note); label.append(radio, copy); row.append(label);
        radio.onchange = () => {selected = voice.id; refresh();};
        groups.get(voice.language).append(row);
      }
      $('kokoro-status').textContent = ready ? `${voices.length} voces instaladas · audio generado en este equipo.` : 'Kokoro es opcional. Puedes instalarlo desde Configuración → Datos y voces adicionales.';
    } catch (_) {$('kokoro-status').textContent = 'No se pudo consultar Kokoro. Reinicia TikReader si acabas de instalarlo.';}
    refresh();
  }
  load();
  return {current, reload: load, ready: () => ready && !!current()};
})();
