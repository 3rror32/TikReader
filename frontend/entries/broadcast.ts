import "../styles/broadcast.css";
import { OverlayTransport } from "../runtime/transport";

type Connection = { connected?: boolean; connecting?: boolean; username?: string };
type Production = { emergency?: boolean; announcement?: string; scene?: string };
type Stats = { likes: number; gifts: number; likes_known?: boolean };
type StudioState = {
  session?: string;
  connection: Connection;
  production?: Production;
  stats: Stats;
  like_goal: number;
  gift_goal: number;
  highlight?: { user: string; comment: string } | null;
};
type Gift = { user: string; gift: string; count: number; timestamp?: string; image_url?: string; ongoing?: boolean };
type Comment = { user: string; comment: string };
type FeedState = { session?: string; gifts?: Gift[]; comments?: Comment[] };

const element = <T extends HTMLElement>(id: string): T => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Falta el elemento #${id}`);
  return node as T;
};

const preview = new URLSearchParams(location.search).has("preview");
const transport = preview ? null : (window.TikReaderOverlay ??= new OverlayTransport());
const status = element<HTMLElement>("status");
const statusText = element<HTMLElement>("status-text");
const announcement = element<HTMLElement>("announcement");
const highlight = element<HTMLElement>("highlight");
const gift = element<HTMLElement>("gift");
const giftText = element<HTMLElement>("gift-text");
const giftCount = element<HTMLElement>("gift-count");
const goals = element<HTMLElement>("goals");
const comments = element<HTMLElement>("comments");
let refreshing = false;
let queued = false;
let hasSnapshot = false;
let lastCommentSignature = "";
let giftSnapshotReady = false;
let activeGift: { key: string; item: Gift } | null = null;
const giftQueue: Gift[] = [];
const seenGifts = new Map<string, number>();
const giftTimers = new Set<number>();

function text(node: HTMLElement, value: unknown): void {
  node.textContent = String(value ?? "");
}

function renderGoal(name: "likes" | "gifts", value: number, target: number): void {
  const safeTarget = Math.max(1, Number(target) || 1);
  const safeValue = Math.max(0, Number(value) || 0);
  const label = element<HTMLElement>(`${name}-label`);
  const amount = element<HTMLElement>(`${name}-value`);
  const fill = element<HTMLElement>(`${name}-fill`);
  text(label, name === "likes" ? "Likes" : "Regalos");
  text(amount, `${safeValue.toLocaleString("es-MX")} / ${safeTarget.toLocaleString("es-MX")}`);
  fill.style.transform = `scaleX(${Math.min(1, safeValue / safeTarget)})`;
}

function giftKey(item: Gift): string {
  return JSON.stringify([item.timestamp ?? "", item.user, item.gift]);
}

function giftTimer(callback: () => void, delay: number): void {
  const timer = window.setTimeout(() => {
    giftTimers.delete(timer);
    callback();
  }, delay);
  giftTimers.add(timer);
}

function clearGiftTimers(): void {
  for (const timer of giftTimers) window.clearTimeout(timer);
  giftTimers.clear();
}

function paintGift(item: Gift, entering: boolean): void {
  text(giftText, `🎁 ${item.user} · ${item.gift}`);
  text(giftCount, `×${item.count}`);
  gift.setAttribute("aria-label", `${item.user} envió ${item.gift}, ${item.count}`);
  gift.hidden = false;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  gift.getAnimations().forEach(animation => animation.cancel());
  gift.animate(entering ? [
    { opacity: 0, transform: "translate3d(28px, 0, 0) scale(.96)" },
    { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)" }
  ] : [
    { transform: "scale(1)" },
    { transform: "scale(1.035)" },
    { transform: "scale(1)" }
  ], { duration: entering ? 480 : 260, easing: "cubic-bezier(.16,1,.3,1)", fill: "both" });
}

function scheduleGiftExit(): void {
  giftTimer(() => {
    const finish = () => {
      gift.hidden = true;
      activeGift = null;
      playNextGift();
    };
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) finish();
    else {
      gift.animate([
        { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)" },
        { opacity: 0, transform: "translate3d(18px, -4px, 0) scale(.98)" }
      ], { duration: 260, easing: "ease-in", fill: "forwards" }).finished.then(finish, finish);
    }
  }, 5200);
}

function playNextGift(): void {
  clearGiftTimers();
  const item = giftQueue.shift();
  if (!item) {
    activeGift = null;
    gift.hidden = true;
    return;
  }
  activeGift = { key: giftKey(item), item };
  paintGift(item, true);
  scheduleGiftExit();
}

function enqueueGift(item: Gift): void {
  const key = giftKey(item);
  if (activeGift?.key === key) {
    clearGiftTimers();
    activeGift.item = item;
    paintGift(item, false);
    scheduleGiftExit();
    return;
  }
  const queued = giftQueue.findIndex(candidate => giftKey(candidate) === key);
  if (queued >= 0) giftQueue[queued] = item;
  else giftQueue.push(item);
  if (giftQueue.length > 8) giftQueue.splice(0, giftQueue.length - 8);
  if (!activeGift) playNextGift();
}

function syncGifts(items: Gift[]): void {
  if (!giftSnapshotReady) {
    for (const item of items) seenGifts.set(giftKey(item), Number(item.count) || 1);
    giftSnapshotReady = true;
    if (items[0]) enqueueGift(items[0]);
    return;
  }
  for (const item of [...items].reverse()) {
    const key = giftKey(item);
    const count = Number(item.count) || 1;
    const previous = seenGifts.get(key);
    if (previous == null || count > previous) enqueueGift(item);
    seenGifts.set(key, count);
  }
  while (seenGifts.size > 120) seenGifts.delete(seenGifts.keys().next().value as string);
}

function render(studio: StudioState, feed: FeedState): void {
  const production = studio.production ?? {};
  document.body.style.visibility = production.emergency ? "hidden" : "visible";
  if (production.emergency) return;

  const online = Boolean(studio.connection.connected);
  status.dataset.online = String(online);
  text(statusText, online ? `En vivo · @${studio.connection.username ?? ""}` : studio.connection.connecting ? "Reconectando…" : "TikReader sin conexión al live");
  if (production.scene && production.scene !== "talk") {
    text(statusText, ({ start: "Comenzamos pronto", pause: "Volvemos en un momento", end: "Gracias por acompañarnos" } as Record<string, string>)[production.scene] ?? "");
  }

  announcement.hidden = !production.announcement;
  text(announcement, production.announcement);
  highlight.hidden = !studio.highlight;
  text(highlight, studio.highlight ? `📌 ${studio.highlight.user}: ${studio.highlight.comment}` : "");

  syncGifts(feed.gifts ?? []);

  goals.hidden = Boolean(production.scene && production.scene !== "talk");
  renderGoal("likes", studio.stats.likes, studio.like_goal);
  renderGoal("gifts", studio.stats.gifts, studio.gift_goal);

  const recent = (feed.comments ?? []).slice(-5).reverse();
  const signature = JSON.stringify(recent);
  if (signature !== lastCommentSignature) {
    lastCommentSignature = signature;
    comments.replaceChildren(...recent.map(comment => {
      const card = document.createElement("article");
      card.className = "broadcast-card comment";
      const user = document.createElement("div");
      user.className = "comment-user";
      text(user, comment.user);
      const message = document.createElement("div");
      message.className = "comment-text";
      text(message, comment.comment);
      card.append(user, message);
      return card;
    }));
  }
}

async function refresh(): Promise<void> {
  if (!transport) return;
  if (refreshing) { queued = true; return; }
  refreshing = true;
  try {
    const [studio, feed] = await Promise.all([
      transport.json<StudioState>("/broadcast/state"),
      transport.json<FeedState>("/broadcast/feed")
    ]);
    if (studio.session && feed.session && studio.session !== feed.session) throw new Error("La instantánea cambió de sesión");
    render(studio, feed);
    hasSnapshot = true;
  } catch {
    if (!hasSnapshot) document.body.style.visibility = "hidden";
    status.dataset.online = "false";
  } finally {
    refreshing = false;
    if (queued) { queued = false; void refresh(); }
  }
}

if (preview) {
  render({
    session: "preview",
    connection: { connected: true, username: "tu_canal" },
    production: { scene: "talk" },
    stats: { likes: 12_840, gifts: 18, likes_known: true },
    like_goal: 20_000,
    gift_goal: 50,
    highlight: null
  }, {
    session: "preview",
    gifts: [{ user: "TikReader", gift: "Rosa", count: 18 }],
    comments: []
  });
} else if (transport) {
  transport.lifecycle.onPause(paused => {
    if (!paused) return;
    clearGiftTimers();
    giftQueue.length = 0;
    activeGift = null;
    gift.hidden = true;
  });
  transport.onData(() => void refresh());
  transport.recovery(() => void refresh(), 5000);
  void refresh();
}
