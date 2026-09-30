/* Local UI localization. Spanish source strings remain stable application identifiers. */
window.I18n = (() => {
  'use strict';
  const DEFAULT = 'es-419', KEY = 'tikreader.locale';
  const locales = ['es-419', 'en', 'fr'];
  const catalogs = window.TikReaderTranslations || {};
  const originals = new WeakMap();
  const attributes = ['title', 'placeholder', 'aria-label'];
  // Viewer content, credentials, saved names and editable values are never translated.
  const excluded = 'script,style,textarea,code,pre,svg,[translate="no"],[data-i18n-ignore],'
    + '[contenteditable],.comment-user,.comment-text,.comment-meta,.chat-badge,.participant-chip>b,'
    + '.participant-chip>span,.live-queue-row>span,.queue-row>p,#gift-rows td:nth-child(-n+2),'
    + '#ranking-list,#history-preview,#history-session,#profile-select option:not([value=""]),#tts-voice option,'
    + '#quick-list button:first-child,#marker-list,#question-list article p,#prepared-list article,'
    + '#announcement,#highlight,#gift,.user,.message,#poll,#effect,#alerts,.alert-caption,'
    + '.overlay-wheel-disc,.overlay-wheel-result,.overlay-wheel>strong,.points-overlay>strong';
  const normalize = value => String(value).replace(/\s+/g, ' ').trim();
  const valid = value => locales.includes(value) ? value : DEFAULT;
  let locale = DEFAULT;
  try { locale = valid(localStorage.getItem(KEY)); } catch (_) { /* Private browsing. */ }
  function t(source, values = {}) {
    const key = normalize(source);
    const translated = (locale === DEFAULT ? source : catalogs[locale]?.[key]) ?? source;
    return translated.replace(/\{(\w+)\}/g, (match, name) => Object.hasOwn(values, name) ? String(values[name]) : match);
  }
  function translate(source, element) {
    if (locale === DEFAULT) return source;
    const key = normalize(source), entry = catalogs[locale]?.[key];
    if (entry !== undefined) return source.replace(source.trim(), entry);
    if (key.startsWith('Información: ')) return t('Información: {label}', {label: t(key.slice(13))});
    // Only numeric UI status patterns; arbitrary messages and user names are not matched.
    for (const [pattern, template] of [
      [/^(\d+) lecturas omitidas$/, '{count} lecturas omitidas'],
      [/^(\d+) observadas$/, '{count} observadas'],
      [/^Cola de lectura · (\d+)$/, 'Cola de lectura · {count}'],
      [/^Pendientes (\d+)$/, 'Pendientes {count}'],
      [/^Último comentario hace (\d+) s$/, 'Último comentario hace {count} s'],
      [/^Última actividad hace (\d+) s · esperando comentarios$/, 'Última actividad hace {count} s · esperando comentarios'],
      [/^Próximo intento en (\d+) s$/, 'Próximo intento en {count} s'],
    ]) {
      const match = key.match(pattern);
      if (match) return t(template, {count: match[1]});
    }
    const voice = key.match(/^(Emisión silenciada|Voz en espera|Voz pausada|Leyendo|Voz activa|Voz apagada) · cola: (\d+)$/);
    if (voice) return `${t(voice[1])} · ${t('cola')}: ${voice[2]}`;
    if (element?.id === 'voice-visible') {
      const visible = key.match(/^(.+ · cola: \d+) · (.+)$/);
      if (visible) return `${translate(visible[1])} · ${visible[2]}`;
    }
    if (element?.closest('.stat-card')) {
      const stat = key.match(/^(Comentarios|Likes|Regalos|Espectadores): (?:(sin datos|[\d.,]+)\. )?(.+)$/);
      if (stat) return `${t(stat[1])}: ${stat[2] ? `${t(stat[2])}. ` : ''}${t(stat[3])}`;
    }
    return source;
  }
  function update(node, key, read, write) {
    const current = read();
    if (!current) return;
    let record = originals.get(node);
    if (!record) { record = {}; originals.set(node, record); }
    let state = record[key];
    if (!state || current !== state.rendered) state = {source: current};
    const rendered = translate(state.source, node.nodeType === 1 ? node : node.parentElement);
    record[key] = {...state, rendered};
    if (current !== rendered) write(rendered);
  }
  function scan(node) {
    const element = node.nodeType === 1 ? node : node.parentElement;
    if (!element || element.closest(excluded)) return;
    if (node.nodeType === 3) {
      // Implicit option values must remain the original value after localization.
      if (element.tagName === 'OPTION' && !element.hasAttribute('value')) element.value = element.textContent;
      update(node, 'text', () => node.nodeValue, value => { node.nodeValue = value; });
      return;
    }
    if (node.nodeType !== 1) return;
    for (const attr of attributes) update(node, attr, () => node.getAttribute(attr), value => node.setAttribute(attr, value));
    for (const child of node.childNodes) scan(child);
  }
  // Existing icon decorators depend on Spanish labels, even when the display changes.
  function sourceText(node) {
    if (node.nodeType === 3) {
      const state = originals.get(node)?.text;
      return state && node.nodeValue === state.rendered ? state.source : node.nodeValue;
    }
    return Array.from(node.childNodes || [], sourceText).join('');
  }
  function setLocale(next, persist = true) {
    locale = valid(next);
    document.documentElement.lang = locale;
    if (persist) { try { localStorage.setItem(KEY, locale); } catch (_) {} }
    if (document.body) scan(document.body);
    const title = document.querySelector('title');
    if (title) scan(title);
    document.querySelectorAll('[data-locale-select]').forEach(select => { select.value = locale; });
    document.querySelectorAll('[data-locale-select]').forEach(select => { select.setAttribute('aria-label', t('Idioma de la interfaz')); });
    window.dispatchEvent(new CustomEvent('tikreader:localechange', {detail: {locale}}));
  }
  function start() {
    const host = document.querySelector('.skin-settings') || document.querySelector('.app > header, body > main > header');
    if (host) {
      const label = document.createElement('label'); label.className = 'locale-picker';
      const caption = document.createElement('span'); caption.textContent = 'Idioma';
      const select = document.createElement('select'); select.setAttribute('data-locale-select', '');
      select.setAttribute('aria-label', 'Idioma de la interfaz'); select.setAttribute('translate', 'no');
      for (const [value, text] of [['es-419','Español (Latinoamérica)'],['en','English'],['fr','Français']]) {
        const option = document.createElement('option'); option.value = value; option.textContent = text; select.append(option);
      }
      select.onchange = () => setLocale(select.value);
      label.append(caption, select); host.append(label);
    }
    setLocale(locale, false);
    new MutationObserver(records => {
      const roots = new Set();
      for (const record of records) {
        if (record.type === 'childList') record.addedNodes.forEach(node => roots.add(node));
        else roots.add(record.target);
      }
      for (const node of roots) if (node.isConnected) scan(node);
    }).observe(document.documentElement, {subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: attributes});
  }
  document.documentElement.lang = locale;
  window.addEventListener('storage', event => { if (event.key === KEY || event.key === null) setLocale(event.newValue, false); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once: true});
  else start();
  return {t, setLocale, sourceText, confirm: source => window.confirm(t(source)), get locale() { return locale; }, locales: Object.freeze(locales)};
})();
