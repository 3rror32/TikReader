(() => {
  'use strict';

  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => media.matches
    || document.body.classList.contains('menu-motion-reduced')
    || document.documentElement.dataset.motionLevel === 'reduced';
  let preferenceRevision = 0;

  function steadyLiveTally() {
    // Presence owns the tally state; motion must not make a confirmed LIVE
    // signal blink away or bypass a changed accessibility preference.
    for (const dot of document.querySelectorAll('.session-live-dot')) {
      for (const animation of dot.getAnimations?.() || []) animation.cancel();
    }
  }

  function syncMotion() {
    steadyLiveTally();
    if (!reduced()) return;
    preferenceRevision++;
    for (const node of document.querySelectorAll('.motion-details-open')) {
      node.classList.remove('motion-details-open');
    }
    // CSS covers future effects; Web Animations already running need stopping.
    // Limit this to console chrome, not independent overlay documents.
    for (const animation of document.getAnimations?.() || []) {
      if (animation.effect?.target?.closest('.app, .app-sidebar, .mobile-command-dock')) {
        animation.cancel();
      }
    }
  }

  function replayDisclosure(node) {
    if (reduced()) return;
    const revision = preferenceRevision;
    node.classList.remove('motion-details-open');
    requestAnimationFrame(() => {
      if (reduced() || revision !== preferenceRevision || !node.open) return;
      node.classList.add('motion-details-open');
      node.addEventListener('animationend', () => node.classList.remove('motion-details-open'), { once: true });
    });
  }

  // Chat and telemetry remain readable at their final positions. Only a
  // deliberate disclosure gets a short effect; connection has its own orbit.
  document.addEventListener('toggle', event => {
    const details = event.target;
    if (!(details instanceof HTMLDetailsElement) || !details.open) return;
    replayDisclosure(details);
  }, true);

  media.addEventListener('change', syncMotion);
  new MutationObserver(syncMotion).observe(document.body, {
    attributes: true, attributeFilter: ['class', 'data-live-state'],
  });
  new MutationObserver(syncMotion).observe(document.documentElement, {
    attributes: true, attributeFilter: ['data-motion-level'],
  });
  syncMotion();
})();
