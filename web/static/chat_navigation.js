window.ChatNavigation = (() => {
  const feed = document.getElementById('comment-feed');
  const auto = document.getElementById('btn-autoscroll');
  const button = document.createElement('button');
  button.type = 'button'; button.id = 'chat-new-messages'; button.hidden = true;
  button.className = 'feed-btn';
  auto.before(button);
  let following = true, unread = 0, sync = () => {}, adjusting = false;
  function paint() {
    button.hidden = !unread;
    button.textContent = `↑ ${unread} nuevo${unread === 1 ? '' : 's'}`;
    button.setAttribute('aria-label', `Volver a los mensajes recientes: ${unread} nuevos`);
    auto.textContent = following ? '↑ Auto' : '⏸ Manual';
    auto.setAttribute('aria-pressed', String(following));
    auto.style.color = following ? 'var(--teal)' : 'var(--gold)';
    auto.style.borderColor = auto.style.color;
  }
  function follow(value) {
    following = value; sync(value);
    if (value) { unread = 0; feed.scrollTop = 0; }
    paint();
  }
  button.onclick = () => follow(true);
  feed.addEventListener('scroll', () => {
    if (adjusting) return;
    if (feed.scrollTop > 32 && following) follow(false);
    else if (feed.scrollTop <= 2 && !following) follow(true);
  }, {passive:true});
  function capture() {
    if (following) return null;
    const top = feed.getBoundingClientRect().top;
    const anchor = [...feed.children].find(card => card.getBoundingClientRect().bottom > top);
    return {anchor, offset:anchor?.getBoundingClientRect().top, scroll:feed.scrollTop};
  }
  function inserted(position, live) {
    if (following) { feed.scrollTop = 0; return; }
    adjusting = true;
    if (position?.anchor?.isConnected) {
      feed.scrollTop += position.anchor.getBoundingClientRect().top - position.offset;
    } else if (position) {
      feed.scrollTop = position.scroll;
    }
    if (live) unread++;
    paint();
    requestAnimationFrame(() => { adjusting = false; });
  }
  paint();
  return {capture, inserted, follow, reset:() => follow(true), attach:callback => {sync=callback;sync(following);}};
})();
