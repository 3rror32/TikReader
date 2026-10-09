(() => {
  const sidebar = document.querySelector('.app-sidebar');
  const toggle = document.getElementById('menu-toggle');
  if (!sidebar || !toggle) return;
  const mobile = matchMedia('(max-width: 900px)');
  const icons = {
    live: 'M4 8v8m4-11v14m4-16v18m4-16v14m4-11v8',
    voice: 'M9 4a3 3 0 0 1 6 0v8a3 3 0 0 1-6 0V4m-3 7v1a6 6 0 0 0 12 0v-1m-6 7v4m-4 0h8',
    'microphone-captions': 'M7 5a3 3 0 0 1 6 0v5a3 3 0 0 1-6 0V5m-3 5a6 6 0 0 0 12 0m-6 6v3m-5 2h10m3-8h3m-3 4h3m-3 4h3',
    questions: 'M4 4h16v12H9l-5 4V4m5 4a3 3 0 0 1 6 0c0 2-3 2-3 4m0 2h.01',
    obs: 'M3 4h18v13H3V4m5 17h8m-4-4v4m-3-14 6 4-6 4V7',
    'overlay-gallery': 'M4 5h16v14H4V5m4 0v14m8-14v14M4 10h16',
    'overlay-animations': 'm12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7',
    'overlay-effects': 'M5 19c5 2 9-1 9-6 0-3-2-5-5-5 1-3 4-5 8-4 4 1 5 6 2 9-3 3-8 4-14 1',
    'overlay-tools': 'M4 7h16M7 4v6m10 2v8m-3-5h6M4 15h6m-3-3v6',
    'overlay-goals': 'M20 12a8 8 0 1 1-8-8m0 4a4 4 0 1 0 4 4m-4 0 9-9',
    'overlay-favorites': 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3',
    'overlay-custom': 'M4 4h16v16H4V4m4 0v4H4m16 4h-4v8m-8-5 3-3 3 3m-3-3v7',
    'overlay-my-animations': 'M3 7h18v14H3V7m0 0 17-5 1 5M8 6l-2-3m8 1-2-3m-2 10 6 3-6 3v-6',
    'control-center': 'M5 3v5m0 4v9m7-18v10m0 4v4m7-18v2m0 4v12M2 8h6v4H2V8m7 5h6v4H9v-4m7-8h6v4h-6V5',
    'fortune-wheel': 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18m0 0v9l7 3M12 12l-6 7',
    'point-drop': 'M12 3v10m-4-4 4 4 4-4M5 16h14v5H5v-5',
    'game-hotkeys': 'M3 6h18v13H3V6m3 4h1m3 0h1m3 0h1m3 0h.01M6 13h1m3 0h1m3 0h4M7 16h10',
    minecraft: 'M4 5l8-3 8 3v14l-8 3-8-3V5m0 0 8 3 8-3m-8 3v14',
    points: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18m3 6c-.5-1-1.5-1.5-3-1.5-2 0-3 1-3 2.2 0 3.3 6 1.4 6 4.6 0 1.2-1 2.2-3 2.2-1.5 0-2.7-.5-3.3-1.5M12 5v14',
    history: 'M3 5v5h5m-5 0a9 9 0 1 1 1 8m8-12v6l4 2',
    workspace: 'm9 3 6 0 1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1 1-3m3 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8',
    ranking: 'M8 3h8v8a4 4 0 0 1-8 0V3m0 2H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 3v6m-4 0h8',
    spotify: 'M9 18V5l11-2v13M9 8l11-2M9 18a3 3 0 1 1-3-3c1.7 0 3 1.3 3 3m11-2a3 3 0 1 1-3-3c1.7 0 3 1.3 3 3',
    'chat-poll': 'M4 20V10h4v10m4 0V4h4v16m4 0V8h3v12',
    streamerbot: 'M8 8V3m8 5V3M5 8h14v5a7 7 0 0 1-14 0V8m7 12v3',
    'sound-library': 'M4 9v6m4-9v12m4-15v18m4-15v12m4-9v6',
    'video-library': 'M3 4h18v16H3V4m6 4 7 4-7 4V8',
    interactive: 'm13 2-9 12h7l-1 8 10-13h-7l0-7',
    'custom-voice': 'M3 10v4m4-8v12m4-10v8m4-13v6m-3-3h6m1 6v8m-3-4h6',
    filters: 'M3 4h18l-7 8v7l-4 2v-9L3 4',
    alerts: 'M5 17h14l-2-3V9a5 5 0 0 0-10 0v5l-2 3m5 3h4',
    emergency: 'M7 5h4v14H7V5m6 0h4v14h-4V5',
    moderator: 'M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6l-9-4m-4 10 3 3 5-6',
    'animation-studio': 'M3 7h18v14H3V7m0 0 17-5 1 5M8 6l-2-3m8 1-2-3m-2 10 6 3-6 3v-6',
    diagnostics: 'M4 9a12 12 0 0 1 16 0M7 13a8 8 0 0 1 10 0m-7 4a3 3 0 0 1 4 0m-2 4h.01',
    preflight: 'M8 4H4v18h16V4h-4M8 2h8v5H8V2m-1 11 3 3 7-7',
    production: 'M3 4h18v12H3V4m5 17h8m-4-5v5m-5-12h4m-4 3h8',
    'obs-direct': 'M3 4h18v13H3V4m5 17h8m-4-4v4m-6-11h4m-2-2v4m6-4h4m-2-2v4',
    chatbot: 'M5 7h14v13H5V7m7-4v4m-1-4h2M2 11v5m20-5v5M8 11h1m6 0h1m-8 5h8',
    simulation: 'M7 3h10v3h3v15H4V6h3V3m0 3h10M9 10l6 4-6 4v-8',
    'event-diagnostics': 'M5 2h10l4 4v16H5V2m10 0v5h4M8 11h1m3 0h4m-8 4h1m3 0h4m-8 4h6',
    'creator-profiles': 'M3 4h18v16H3V4m6 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4m-4 9v-1a4 3 0 0 1 8 0v1m2-8h3m-3 4h3',
    'creator-calendar': 'M4 5h16v16H4V5m3-3v6m10-6v6M4 10h16m-12 4h1m3 0h1m3 0h1m-9 4h1m3 0h1',
    'creator-library': 'M3 4h4v17H3V4m4 3h5v14H7V7m8-4 5-1 3 18-5 1-3-18M3 8h4m0 3h5m5-4 4-1',
    'creator-scenes': 'M3 3h13v7M3 3v15h7M3 7h13m-5 11 8-8 3 3-8 8-4 1 1-4m6-6 3 3',
    'creator-community': 'M9 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6m-7 18v-3a7 6 0 0 1 14 0v3H2M17 4a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 5v3h-3',
    'creator-battles': 'M3 3l5 1 12 12-4 4L4 8 3 3m12 14 5-5M4 20l3-3m14-14-5 1-4 4m-4 4-4 4 4 4 4-4m-8-4 5 5m8 0 3 3',
    'creator-games': 'M5 3h14l2 2v14l-2 2H5l-2-2V5l2-2m2 4h.01m10 0h.01m-5 5h.01m-5 5h.01m10 0h.01',
    'creator-suite': 'M4 3h16v18H4V3m4 4h8m-8 5h3m3 0h2m-8 5h8',
    'platform-integrations': 'M7 7h-1a4 4 0 0 0 0 8h3m8-8h1a4 4 0 0 1 0 8h-3M8 12h8',
    'category-chat': 'M4 3h16v13H9l-5 4V3m4 6h.01m4 0h.01m4 0h.01',
    'category-scene': 'M3 8h18v13H3V8m0 0V3h18v5M7 3l3 5m4-5 3 5m-8 4 6 3-6 3v-6',
    'category-media': 'M3 7h12v12H3V7m12 4 6-3v10l-6-3M7 3v8m0 0a2 2 0 1 1-2-2',
    'category-games': 'M7 7h10c3 0 4 3 5 10 0 3-3 3-6-1H8c-3 4-6 4-6 1 1-7 2-10 5-10m0 3v5m-2-2h4m7-2h.01m3 3h.01',
    'category-automation': 'M9 2h6v6H9V2m3 6v5M5 13h14M5 13v3m14-3v3M2 16h6v6H2v-6m14 0h6v6h-6v-6',
    'category-tests': 'M9 2h6m-5 0v7L4 19q-1 3 2 3h12q3 0 2-3L14 9V2M7 15h10m-7 3h.01m4 2h.01',
    about: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20m0-11v6m0-10h.01',
  };
  function icon(path) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.classList.add('sidebar-icon');
    const line = document.createElementNS(svg.namespaceURI, 'path');
    line.setAttribute('d', path);
    svg.append(line);
    return svg;
  }
  sidebar.id = 'app-sidebar';
  toggle.setAttribute('aria-controls', sidebar.id);
  toggle.replaceChildren(icon('M4 6h16M4 12h16M4 18h16'));
  for (const summary of sidebar.querySelectorAll('[data-section-group] > summary')) {
    const label = summary.textContent.trim(), text = document.createElement('span');
    text.className = 'sidebar-label'; text.textContent = label;
    summary.setAttribute('aria-label', label); summary.replaceChildren(icon(icons[summary.parentElement.dataset.sectionGroup] || icons.workspace), text);
  }
  for (const button of sidebar.querySelectorAll('[data-section-nav]')) {
    const label = button.textContent.trim();
    const text = document.createElement('span');
    text.className = 'sidebar-label';
    text.textContent = label;
    button.setAttribute('aria-label', label);
    button.title = label;
    button.replaceChildren(icon(icons[button.dataset.sectionNav] || icons.workspace), text);
  }
  for (const id of ['emergency-button']) {
    const button = document.getElementById(id);
    if (button) { button.title = button.textContent; button.setAttribute('aria-label', button.textContent); }
  }
  const backdrop = document.createElement('div');
  backdrop.className = 'sidebar-backdrop';
  backdrop.setAttribute('aria-hidden', 'true');
  document.body.append(backdrop);
  const systemReducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const motionSelect = document.getElementById('motion-level-select');
  const motionStatus = document.getElementById('menu-motion-status');
  function storedMotionLevel() {
    try {
      const saved = localStorage.getItem('tikreader.menuMotion');
      if (saved === 'off') return 'reduced';
      if (saved === 'on' || !['reduced', 'subtle', 'expressive'].includes(saved)) return 'subtle';
      return saved;
    } catch (_) { return 'subtle'; }
  }
  function motionAllowed() { return storedMotionLevel() !== 'reduced' && !systemReducedMotion.matches; }
  function applyMotionPreference() {
    const selected = storedMotionLevel();
    const effective = systemReducedMotion.matches ? 'reduced' : selected;
    document.documentElement.dataset.motionLevel = effective;
    document.body.classList.toggle('menu-motion-reduced', effective === 'reduced');
    if (motionSelect) motionSelect.value = selected;
    if (motionStatus) {
      motionStatus.textContent = systemReducedMotion.matches
        ? 'Windows solicita movimiento reducido; TikReader lo respetará.'
        : selected === 'reduced' ? 'Movimiento reducido en toda la interfaz.'
          : selected === 'expressive' ? 'Movimiento más visible, sin animación decorativa constante.'
            : 'Transiciones breves y reacciones suaves.';
    }
  }
  if (motionSelect) motionSelect.addEventListener('change', () => {
    try { localStorage.setItem('tikreader.menuMotion', motionSelect.value); } catch (_) {}
    applyMotionPreference();
  });
  systemReducedMotion.addEventListener('change', applyMotionPreference);
  applyMotionPreference();
  let collapsed = false;
  try { collapsed = localStorage.getItem('tikreader.sidebarCollapsed') === 'true'; } catch (_) {}
  // Visibility belongs to destinations, not to whether a node is a disclosure.
  const basicDestinations = new Set([
    'live', 'voice', 'microphone-captions',
    'overlay-gallery', 'overlay-animations', 'overlay-effects', 'overlay-tools',
    'overlay-goals', 'overlay-favorites', 'overlay-custom', 'overlay-my-animations',
    'alerts', 'about', 'workspace',
  ]);
  for (const button of sidebar.querySelectorAll('[data-section-nav]')) {
    if (!basicDestinations.has(button.dataset.sectionNav)) button.dataset.advancedOnly = 'true';
  }
  for (const group of sidebar.querySelectorAll('.nav-group')) {
    if (![...group.querySelectorAll('[data-section-nav]')].some(button => basicDestinations.has(button.dataset.sectionNav))) {
      group.dataset.advancedOnly = 'true';
    }
  }
  for (const label of sidebar.querySelectorAll('.nav-section-label')) {
    const groups = [];
    for (let next = label.nextElementSibling; next && !next.classList.contains('nav-section-label') && !next.classList.contains('nav-tail-item'); next = next.nextElementSibling) groups.push(next);
    if (groups.length && groups.every(group => group.dataset.advancedOnly === 'true')) label.dataset.advancedOnly = 'true';
  }
  // Advanced sections start closed; everyday destinations remain direct links.
  const advancedSections = [];
  for (const label of [...sidebar.querySelectorAll('.nav-section-label[data-advanced-only]')]) {
    const section = document.createElement('details'); section.className = 'nav-advanced-section'; section.dataset.advancedOnly = 'true';
    const heading = document.createElement('summary'); heading.title = label.textContent;
    const text = document.createElement('span'); text.className = 'nav-category-label'; text.textContent = label.textContent;
    const current = document.createElement('span'); current.className = 'nav-current-label'; current.hidden = true;
    const copy = document.createElement('span'); copy.className = 'nav-category-copy'; copy.append(text, current);
    const content = document.createElement('div'); content.className = 'sidebar-disclosure-content';
    const categoryIcons={'Chat':'category-chat','Producción':'category-scene','Multimedia':'category-media','Juegos':'category-games','Interactividad':'category-automation','Diagnóstico':'category-tests'};
    heading.append(icon(icons[categoryIcons[label.textContent]] || icons.workspace), copy); section.append(heading, content);
    for (let next = label.nextElementSibling; next && !next.classList.contains('nav-section-label') && !next.classList.contains('nav-tail-item');) {
      const following = next.nextElementSibling; content.append(next); next = following;
    }
    label.replaceWith(section); advancedSections.push(section);
  }
  const navigation = sidebar.querySelector('nav');
  function syncAdvancedOpenState() {
    sidebar.classList.toggle('has-open-advanced', advancedSections.some(section => section.dataset.targetOpen === 'true'));
  }
  function revealAdvancedSection(section) {
    const navRect = navigation.getBoundingClientRect();
    const sectionRect = section.getBoundingClientRect();
    let offset = 0;
    if (sectionRect.height >= navRect.height) offset = sectionRect.top - navRect.top;
    else if (sectionRect.bottom > navRect.bottom) offset = sectionRect.bottom - navRect.bottom + 6;
    else if (sectionRect.top < navRect.top) offset = sectionRect.top - navRect.top - 6;
    if (Math.abs(offset) > 1) navigation.scrollBy({top:offset,behavior:motionAllowed()?'smooth':'auto'});
  }
  function enhanceDisclosure(details, content, beforeOpen) {
    const summary = details.querySelector(':scope > summary');
    if (!summary || !content) return;
    let animation = null;
    let targetOpen = details.open;
    const syncExpanded = () => {
      targetOpen = details.open;
      details.dataset.targetOpen = String(targetOpen);
      summary.setAttribute('aria-expanded', String(details.open));
      if (details.open) beforeOpen?.(details);
      syncAdvancedOpenState();
      if (details.open && details.classList.contains('nav-advanced-section') && !animation) requestAnimationFrame(() => revealAdvancedSection(details));
    };
    const clearAnimationStyles = () => {
      content.style.removeProperty('overflow');
      content.style.removeProperty('pointer-events');
      content.style.removeProperty('will-change');
    };
    syncExpanded();
    details.addEventListener('toggle', syncExpanded);
    summary.addEventListener('click', event => {
      const opening = !targetOpen;
      targetOpen = opening;
      details.dataset.targetOpen = String(targetOpen);
      if (opening) beforeOpen?.(details);
      syncAdvancedOpenState();
      if (!motionAllowed() || typeof content.animate !== 'function') return;
      event.preventDefault();
      if (animation) {
        const previous = animation;
        animation = null;
        previous.cancel();
        clearAnimationStyles();
      }
      if (opening) details.open = true;
      const height = Math.max(content.getBoundingClientRect().height, content.scrollHeight);
      const duration = Math.min(300, 180 + Math.sqrt(height) * 5);
      content.style.overflow = 'hidden';
      content.style.pointerEvents = 'none';
      content.style.willChange = 'height, opacity, transform, clip-path';
      const current = content.animate(
        opening
          ? [
              { height: '0px', opacity: 0, transform: 'translateY(-6px)', clipPath: 'inset(0 0 100% 0)' },
              { height: `${height}px`, opacity: 1, transform: 'translateY(0)', clipPath: 'inset(0)' },
            ]
          : [
              { height: `${height}px`, opacity: 1, transform: 'translateY(0)', clipPath: 'inset(0)' },
              { height: '0px', opacity: 0, transform: 'translateY(-6px)', clipPath: 'inset(0 0 100% 0)' },
            ],
        { duration, easing: 'cubic-bezier(.22,.72,.24,1)' },
      );
      animation = current;
      current.onfinish = () => {
        if (animation !== current) return;
        if (!opening) details.open = false;
        summary.setAttribute('aria-expanded', String(details.open));
        clearAnimationStyles();
        animation = null;
        if (opening && details.classList.contains('nav-advanced-section')) requestAnimationFrame(() => revealAdvancedSection(details));
      };
      current.oncancel = () => {
        if (animation !== current) return;
        clearAnimationStyles();
        animation = null;
      };
    });
  }
  function closeOtherAdvancedSections(current) {
    for (const section of advancedSections) {
      if (section === current || section.dataset.targetOpen !== 'true') continue;
      section.querySelector(':scope > summary')?.click();
    }
  }
  for (const section of advancedSections) enhanceDisclosure(section, section.querySelector(':scope > .sidebar-disclosure-content'), closeOtherAdvancedSections);
  for (const details of sidebar.querySelectorAll('.nav-group > details')) enhanceDisclosure(details, details.querySelector(':scope > .nav-submenu'));
  syncAdvancedOpenState();
  const searchBox = document.createElement('div'); searchBox.className = 'sidebar-search'; searchBox.dataset.advancedOnly = 'true';
  const searchToggle = document.createElement('button'); searchToggle.type = 'button'; searchToggle.className = 'sidebar-search-toggle'; searchToggle.setAttribute('aria-label', 'Buscar herramienta'); searchToggle.title = 'Buscar herramienta';
  searchToggle.append(icon('M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13m5 11 5 5'));
  const searchInput = document.createElement('input'); searchInput.type = 'search'; searchInput.id = 'sidebar-search-input'; searchInput.placeholder = 'Buscar herramienta…'; searchInput.autocomplete = 'off'; searchInput.setAttribute('aria-label', 'Buscar herramienta');
  const searchResults = document.createElement('div'); searchResults.className = 'sidebar-search-results'; searchResults.setAttribute('role', 'navigation'); searchResults.setAttribute('aria-label', 'Resultados de herramientas'); searchResults.hidden = true;
  const searchEmpty = document.createElement('p'); searchEmpty.className = 'sidebar-search-empty'; searchEmpty.textContent = 'No se encontraron herramientas.'; searchEmpty.hidden = true;
  searchBox.append(searchToggle, searchInput, searchResults, searchEmpty); navigation.before(searchBox);
  const searchableDestinations = [...sidebar.querySelectorAll('[data-section-nav]')];
  function normalizeSearch(value) { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }
  function destinationLabel(source) { return source.querySelector('.sidebar-label')?.textContent.trim() || source.getAttribute('aria-label') || source.textContent.trim(); }
  function destinationCategory(source) {
    const advanced = source.closest('.nav-advanced-section');
    if (advanced) return advanced.querySelector('.nav-category-label')?.textContent.trim() || '';
    const grouped = source.closest('[data-section-group]');
    if (grouped) return grouped.querySelector(':scope > summary .sidebar-label')?.textContent.trim() || 'Overlays';
    if (source.closest('.sidebar-utility')) return 'Accesos rápidos';
    return 'Directo';
  }
  function closeSearch({focusToggle = false} = {}) {
    searchInput.value = '';
    searchResults.replaceChildren();
    searchResults.hidden = true;
    searchEmpty.hidden = true;
    searchBox.classList.remove('has-query', 'is-popover');
    sidebar.classList.remove('is-searching', 'search-popover');
    if (focusToggle && document.body.classList.contains('sidebar-collapsed')) searchToggle.focus();
  }
  function renderSearch() {
    const query = normalizeSearch(searchInput.value);
    searchResults.replaceChildren();
    searchBox.classList.toggle('has-query', !!query);
    sidebar.classList.toggle('is-searching', !!query);
    searchResults.hidden = !query;
    searchEmpty.hidden = true;
    if (!query) return;
    const matches = searchableDestinations.map(source => {
      const label = destinationLabel(source), category = destinationCategory(source);
      const normalizedLabel = normalizeSearch(label), normalizedCategory = normalizeSearch(category);
      let score = 4;
      if (normalizedLabel.startsWith(query)) score = 0;
      else if (normalizedLabel.includes(query)) score = 1;
      else if (normalizedCategory.startsWith(query)) score = 2;
      else if (normalizedCategory.includes(query)) score = 3;
      return {source,label,category,score};
    }).filter(item => item.score < 4).sort((a,b) => a.score - b.score || a.label.localeCompare(b.label)).slice(0,10);
    for (const match of matches) {
      const result = document.createElement('button'); result.type = 'button'; result.className = 'sidebar-search-result';
      const resultIcon = match.source.querySelector('.sidebar-icon')?.cloneNode(true);
      const resultCopy = document.createElement('span'); resultCopy.className = 'sidebar-search-result-copy';
      const resultLabel = document.createElement('strong'); resultLabel.textContent = match.label;
      const resultCategory = document.createElement('small'); resultCategory.textContent = match.category;
      resultCopy.append(resultLabel, resultCategory); if (resultIcon) result.append(resultIcon); result.append(resultCopy);
      result.onclick = () => { match.source.click(); closeSearch(); };
      searchResults.append(result);
    }
    searchEmpty.hidden = matches.length > 0;
  }
  searchInput.addEventListener('input', renderSearch);
  searchInput.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeSearch({focusToggle:true}); }
    if (event.key === 'ArrowDown') { const first = searchResults.querySelector('button'); if (first) { event.preventDefault(); first.focus(); } }
  });
  searchResults.addEventListener('keydown', event => {
    if (!['ArrowDown','ArrowUp','Escape'].includes(event.key)) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeSearch({focusToggle:true}); return; }
    const items = [...searchResults.querySelectorAll('button')], index = items.indexOf(document.activeElement);
    if (!items.length) return;
    event.preventDefault(); items[(index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus();
  });
  searchToggle.onclick = () => {
    const popover = document.body.classList.contains('sidebar-collapsed') && !mobile.matches;
    searchBox.classList.toggle('is-popover', popover);
    sidebar.classList.toggle('search-popover', popover);
    searchInput.focus();
  };
  document.addEventListener('pointerdown', event => {
    if (searchBox.classList.contains('is-popover') && !searchBox.contains(event.target)) closeSearch();
  });
  function markActiveGroup() {
    for (const section of advancedSections) {
      const summary = section.querySelector(':scope > summary');
      const active = section.querySelector('[aria-current="page"]');
      const label = summary.querySelector('.nav-category-label').textContent;
      const current = summary.querySelector('.nav-current-label');
      const activeLabel = active?.querySelector('.sidebar-label')?.textContent.trim() || active?.textContent.trim() || '';
      current.textContent = activeLabel;
      current.hidden = !active;
      summary.setAttribute('aria-label', active ? `${label}. Página actual: ${activeLabel}` : label);
      section.classList.toggle('has-current-page', !!active);
    }
  }
  new MutationObserver(markActiveGroup).observe(sidebar, {subtree:true, attributes:true, attributeFilter:['aria-current']});
  markActiveGroup();
  const modeBox = document.createElement('div'); modeBox.className = 'interface-mode';
  const mode = document.createElement('button'); mode.type = 'button'; mode.id = 'interface-mode-toggle';
  const modeLabel = document.createElement('span'); modeLabel.className = 'interface-mode-label';
  const modeIcons = {
    basic: 'M4 4h6v6H4V4m10 0h6v6h-6V4M4 14h6v6H4v-6m10 0h6v6h-6v-6',
    advanced: 'M4 7h5m4 0h7M4 17h9m4 0h3M9 4v6m4 4v6'
  };
  const note = document.createElement('p'); note.className = 'interface-mode-status'; note.setAttribute('role', 'status');
  modeBox.append(mode, note); toggle.after(modeBox);
  mode.onclick = () => applyMode(mode.dataset.mode === 'basic' ? 'advanced' : 'basic', true);
  function readMode() {
    try { return JSON.parse(localStorage.getItem('tikreader.interfaceMode')) === 'advanced' ? 'advanced' : 'basic'; }
    catch (_) { return 'basic'; }
  }
  function applyMode(value, persist = false) {
    const next = value === 'advanced' ? 'advanced' : 'basic';
    if (next === 'basic') closeSearch();
    mode.dataset.mode = next;
    const label = next === 'basic' ? 'Básico' : 'Completo';
    modeLabel.textContent = label;
    mode.replaceChildren(icon(modeIcons[next]), modeLabel);
    mode.title = `Menú ${label} · cambiar a ${next === 'basic' ? 'Completo' : 'Básico'}`;
    mode.setAttribute('aria-label', `Menú ${label}. Cambiar a ${next === 'basic' ? 'Completo' : 'Básico'}`);
    mode.setAttribute('aria-pressed', String(next === 'advanced'));
    if (next === 'advanced') { advancedSections.forEach(section => { section.open = false; }); }
    const active = sidebar.querySelector('[data-section-nav].active');
    document.body.classList.toggle('basic-mode', next === 'basic');
    note.textContent = next === 'basic' ? 'Lo esencial para tu directo.' : 'Todas las herramientas disponibles.';
    if (persist) {
      try { localStorage.setItem('tikreader.interfaceMode', JSON.stringify(next)); }
      catch (_) { note.textContent += ' No se pudo guardar la preferencia.'; }
    }
  }
  window.addEventListener('tikreader:profile', () => applyMode(readMode()));
  applyMode(readMode());
  function sync() {
    const compact = !mobile.matches && collapsed;
    const open = mobile.matches ? document.body.classList.contains('menu-open') : !compact;
    document.body.classList.toggle('sidebar-collapsed', compact);
    sidebar.inert = mobile.matches && !open;
    backdrop.hidden = !mobile.matches || !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Contraer menú' : 'Expandir menú');
    toggle.title = open ? 'Contraer menú' : 'Expandir menú';
    if (!compact && typeof tooltip !== 'undefined') tooltip.hidden = true;
  }
  function closeMobile() {
    closeSearch();
    document.body.classList.remove('menu-open');
    sync();
    toggle.focus();
  }
  const tooltip = document.createElement('div');
  tooltip.className = 'sidebar-tooltip';
  tooltip.setAttribute('role', 'tooltip');
  tooltip.hidden = true;
  document.body.append(tooltip);
  function tooltipControl(target) {
    return target?.closest?.('[data-section-nav], summary') || null;
  }
  function showTooltip(event) {
    if (mobile.matches || !collapsed) return;
    const control = tooltipControl(event.target);
    if (!control || !sidebar.contains(control)) return;
    const label = control.getAttribute('aria-label') || control.title || control.textContent.trim();
    if (!label) return;
    tooltip.textContent = label;
    tooltip.hidden = false;
    const rect = control.getBoundingClientRect();
    const top = Math.max(8, Math.min(innerHeight - tooltip.offsetHeight - 8, rect.top + (rect.height - tooltip.offsetHeight) / 2));
    tooltip.style.left = `${rect.right + 10}px`;
    tooltip.style.top = `${top}px`;
  }
  function hideTooltip(event) {
    const from = tooltipControl(event.target);
    const to = tooltipControl(event.relatedTarget);
    if (from && from === to) return;
    tooltip.hidden = true;
  }
  sidebar.addEventListener('pointerover', showTooltip);
  sidebar.addEventListener('pointerout', hideTooltip);
  sidebar.addEventListener('focusin', showTooltip);
  sidebar.addEventListener('focusout', hideTooltip);
  toggle.onclick = () => {
    if (mobile.matches) document.body.classList.toggle('menu-open');
    else {
      collapsed = !collapsed;
      if (collapsed) closeSearch();
      try { localStorage.setItem('tikreader.sidebarCollapsed', String(collapsed)); } catch (_) {}
    }
    sync();
  };
  backdrop.onclick = closeMobile;
  sidebar.addEventListener('click', event => {
    if (event.target.closest('[data-section-nav]')) {
      sync();
      if (mobile.matches) toggle.focus();
    }
  });
  document.addEventListener('keydown', event => {
    if (!mobile.matches || !document.body.classList.contains('menu-open')) return;
    if (event.key === 'Escape') { event.preventDefault(); closeMobile(); }
    if (event.key === 'Tab') {
      const visible = [toggle, ...sidebar.querySelectorAll('button, summary, select')].filter(node => !node.disabled && node.getClientRects().length);
      const index = visible.indexOf(document.activeElement);
      const next = (index + (event.shiftKey ? -1 : 1) + visible.length) % visible.length;
      event.preventDefault();
      visible[next].focus();
    }
  });
  mobile.addEventListener('change', () => { document.body.classList.remove('menu-open'); sync(); });
  // Shell.show can also be called from controls outside the navigation.
  new MutationObserver(() => {
    const expected = mobile.matches ? document.body.classList.contains('menu-open') : !collapsed;
    if (toggle.getAttribute('aria-expanded') !== String(expected) || sidebar.inert !== (mobile.matches && !expected)) sync();
  }).observe(document.body, {attributes: true, attributeFilter: ['class'], subtree: false});
  sync();
})();
