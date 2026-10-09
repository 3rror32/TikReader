(() => {
  'use strict';

  const reduced = () => document.body.classList.contains('menu-motion-reduced')
    || matchMedia('(prefers-reduced-motion: reduce)').matches;

  function replay(node, className) {
    if (!node || reduced()) return;
    node.classList.remove(className);
    requestAnimationFrame(() => {
      node.classList.add(className);
      node.addEventListener('animationend', () => node.classList.remove(className), { once: true });
    });
  }

  function visibleView() {
    if (!document.body.classList.contains('config-view')) {
      return document.querySelector('.live-columns');
    }
    return [...document.querySelectorAll('.settings-view:not([hidden]), .studio-pane:not([hidden])')]
      .find(node => node.getClientRects().length) || document.querySelector('.config-content');
  }

  window.addEventListener('tikreader:navigation-change', () => replay(visibleView(), 'motion-view-enter'));

  const feed = document.getElementById('comment-feed');
  if (feed) {
    new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches('.comment-card')) replay(node, 'motion-comment-arrival');
        for (const card of node.querySelectorAll?.('.comment-card') || []) replay(card, 'motion-comment-arrival');
      }
    }).observe(feed, { childList: true, subtree: true });
  }

  for (const metric of document.querySelectorAll('.stat-value')) {
    let previous = metric.textContent;
    new MutationObserver(() => {
      if (metric.textContent === previous) return;
      previous = metric.textContent;
      replay(metric, 'motion-metric-update');
    }).observe(metric, { childList: true, characterData: true, subtree: true });
  }

  const stageObserver = new MutationObserver(records => {
    for (const record of records) replay(record.target, 'motion-stage-update');
  });
  for (const stage of document.querySelectorAll('.signal-stage')) {
    stageObserver.observe(stage, { attributes: true, attributeFilter: ['data-state'] });
  }

  document.addEventListener('toggle', event => {
    const details = event.target;
    if (!(details instanceof HTMLDetailsElement) || !details.open) return;
    replay(details, 'motion-details-open');
  }, true);

  requestAnimationFrame(() => document.documentElement.classList.add('motion-system-ready'));
})();
