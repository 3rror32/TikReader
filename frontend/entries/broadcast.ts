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
type Gift = { user: string; gift: string; count: number };
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
let lastGiftSignature = "";

function text(node: HTMLElement, value: unknown): void {
  node.textContent = String(value ?? "");
}

function renderGoal(name: "likes" | "gifts", value: number, target: number, known = true): void {
  const safeTarget = Math.max(1, Number(target) || 1);
  const safeValue = Math.max(0, Number(value) || 0);
  const label = element<HTMLElement>(`${name}-label`);
  const amount = element<HTMLElement>(`${name}-value`);
  const fill = element<HTMLElement>(`${name}-fill`);
  text(label, name === "likes" ? "Likes" : "Regalos");
  text(amount, `${known ? safeValue.toLocaleString("es-MX") : "—"} / ${safeTarget.toLocaleString("es-MX")}`);
  fill.style.transform = `scaleX(${known ? Math.min(1, safeValue / safeTarget) : 0})`;
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

  const latestGift = feed.gifts?.[0];
  gift.hidden = !latestGift;
  if (latestGift) {
    text(giftText, `🎁 ${latestGift.user} · ${latestGift.gift}`);
    text(giftCount, `×${latestGift.count}`);
    const giftSignature = JSON.stringify(latestGift);
    if (giftSignature !== lastGiftSignature) {
      lastGiftSignature = giftSignature;
      gift.getAnimations().forEach(animation => animation.cancel());
      gift.animate([
        { opacity: 0, transform: "translate3d(24px, 0, 0) scale(.97)" },
        { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)" }
      ], { duration: 480, easing: "cubic-bezier(.16,1,.3,1)", fill: "both" });
    }
  }

  goals.hidden = Boolean(production.scene && production.scene !== "talk");
  renderGoal("likes", studio.stats.likes, studio.like_goal, studio.stats.likes_known !== false);
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
  transport.onData(() => void refresh());
  transport.recovery(() => void refresh(), 5000);
  void refresh();
}
