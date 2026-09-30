import "./runtime";
import type { AnimationItem } from "lottie-web";
import type { Engine as MatterEngine, Body as MatterBody } from "matter-js";

type Settings = {
  animation?: string;
  motion?: string;
  show_details?: boolean;
  size?: number;
};
type GoalOptions = { value: number | null; target: number; mode?: string; session?: string; id?: string; settings: Settings };
type EffectKey = "coins" | "celebration" | "hearts" | "welcome";
type Cleanup = () => void;
type Scope = { alive: () => boolean; add: (cleanup: Cleanup) => void; stop: Cleanup };

const active = new Map<Cleanup, Node>();
const goals = new Map<string, number>();
const format = (value: number): string => Math.round(value).toLocaleString("es-MX");

function reduced(settings: Settings = {}): boolean {
  return settings.animation === "none" || settings.motion === "reduced" ||
    (settings.motion !== "full" && matchMedia("(prefers-reduced-motion: reduce)").matches);
}

function scope(node: Node): Scope {
  const cleanups: Cleanup[] = [];
  let stopped = false;
  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    for (const cleanup of cleanups.splice(0)) {
      try { cleanup(); } catch { /* Effect teardown must never block the queue. */ }
    }
    active.delete(stop);
  };
  active.set(stop, node);
  return {
    alive: () => !stopped && node.isConnected,
    add(cleanup) { if (stopped) cleanup(); else cleanups.push(cleanup); },
    stop
  };
}

new MutationObserver(() => {
  for (const [stop, node] of active) if (!node.isConnected) stop();
}).observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener("pagehide", () => { for (const stop of [...active.keys()]) stop(); }, { once: true });

async function animateGoal(box: HTMLElement, fill: HTMLElement, number: HTMLElement | null, startRatio: number, endRatio: number, previousValue: number | undefined, endValue: number, life: Scope): Promise<void> {
  const { gsap } = await import("gsap");
  if (!life.alive()) return;
  box.classList.add("studio-motion");
  const bar = gsap.fromTo(fill, { scaleX: startRatio }, { scaleX: endRatio, duration: .75, ease: "power3.out" });
  life.add(() => bar.kill());
  if (number && previousValue != null && previousValue !== endValue) {
    const state = { value: previousValue };
    const counter = gsap.to(state, {
      value: endValue, duration: .65, ease: "power2.out",
      onUpdate: () => { number.textContent = format(state.value); }
    });
    life.add(() => counter.kill());
  }
  if (previousValue == null) {
    const entrance = gsap.fromTo(box, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: .45, ease: "power2.out" });
    life.add(() => entrance.kill());
  }
}

function goal(box: HTMLElement, options: GoalOptions): void {
  const { value, target, mode = "goal", session, id, settings } = options;
  box.classList.add("studio-goal");
  if (value == null || !Number.isFinite(value)) return;
  const safeTarget = Math.max(1, Number(target) || 1);
  const key = JSON.stringify([session, id, safeTarget]);
  const previous = goals.get(key);
  goals.set(key, value);
  if (goals.size > 80) goals.delete(goals.keys().next().value as string);
  const ratio = Math.max(0, Math.min(1, value / safeTarget));
  const complete = ratio === 1;
  box.dataset.complete = String(complete);

  const progress = box.querySelector("progress");
  const track = document.createElement("div");
  track.className = "studio-track";
  track.setAttribute("aria-hidden", "true");
  const fill = document.createElement("i");
  fill.style.transform = `scaleX(${ratio})`;
  track.append(fill);
  if (progress) { progress.classList.add("studio-accessible-progress"); progress.after(track); }

  const note = document.createElement("div");
  note.className = "studio-goal-note";
  const label = document.createElement("span");
  label.textContent = complete ? "¡Meta cumplida!" : "Cada aporte cuenta";
  const percent = document.createElement("b");
  percent.textContent = `${Math.floor(ratio * 100)}%`;
  note.append(label, percent);
  if (settings.show_details) box.append(note);

  const number = box.querySelector<HTMLElement>(".goal-number");
  const display = (n: number): number => mode === "countdown" ? Math.max(0, safeTarget - n) : n;
  if (number) number.textContent = format(display(value));
  if (reduced(settings)) return;

  const life = scope(box);
  const startRatio = previous == null ? ratio : Math.max(0, Math.min(1, previous / safeTarget));
  void animateGoal(box, fill, number, startRatio, ratio, previous == null ? undefined : display(previous), display(value), life);
  if (complete && previous != null && previous < safeTarget) badge(box, life);
}

async function gift(box: HTMLElement, settings: Settings): Promise<void> {
  if (reduced(settings)) return;
  const life = scope(box);
  const { gsap } = await import("gsap");
  if (!life.alive()) return;
  box.classList.add("studio-motion");
  const timeline = gsap.timeline();
  timeline.fromTo(box, { autoAlpha: 0, x: 22 }, { autoAlpha: 1, x: 0, duration: .48, ease: "power3.out" })
    .fromTo(box.querySelector(".gift-feed-visual"), { scale: .8, rotate: -7 }, { scale: 1, rotate: 0, duration: .65, ease: "back.out(1.7)" }, 0);
  life.add(() => timeline.kill());
}

function medalData(): object {
  const animated = (from: number[], to: number[]) => ({ a: 1, k: [{ t: 0, s: from, e: to, o: { x: [.2], y: [0] }, i: { x: [.2], y: [1] } }, { t: 22, s: to }] });
  return { v: "5.13.0", fr: 30, ip: 0, op: 75, w: 160, h: 160, nm: "TikReader • meta cumplida", ddd: 0, assets: [], layers: [{
    ddd: 0, ind: 1, ty: 4, nm: "Medalla", sr: 1,
    ks: { o: { a: 0, k: 100 }, r: animated([-35], [0]), p: { a: 0, k: [80, 80, 0] }, a: { a: 0, k: [0, 0, 0] }, s: animated([20, 20, 100], [100, 100, 100]) },
    shapes: [{ ty: "el", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [116, 116] }, d: 1 },
      { ty: "st", c: { a: 0, k: [1, .82, .42, 1] }, o: { a: 0, k: 100 }, w: { a: 0, k: 3 }, lc: 2, lj: 2 },
      { ty: "sh", ks: { a: 0, k: { i: [[0,0],[0,0],[0,0]], o: [[0,0],[0,0],[0,0]], v: [[-24,0],[-6,19],[28,-20]], c: false } } },
      { ty: "st", c: { a: 0, k: [1, .9, .67, 1] }, o: { a: 0, k: 100 }, w: { a: 0, k: 8 }, lc: 2, lj: 2 }], ip: 0, op: 75, st: 0, bm: 0
  }] };
}

function badge(node: HTMLElement | null, life: Scope): void {
  if (!node) return;
  void import("lottie-web/build/player/lottie_light").then(module => {
    if (!life.alive()) return;
    const host = document.createElement("span");
    host.className = "studio-medal";
    host.setAttribute("aria-hidden", "true");
    node.append(host);
    const lottie = module.default;
    const animation: AnimationItem = lottie.loadAnimation({ container: host, renderer: "svg", loop: false, autoplay: true, animationData: medalData() });
    life.add(() => { animation.destroy(); host.remove(); });
  }).catch(() => undefined);
}

async function captionSequence(scene: HTMLElement, life: Scope): Promise<void> {
  const { gsap } = await import("gsap");
  if (!life.alive()) return;
  const targets = scene.querySelectorAll(".effect-caption > small,.effect-caption > span,.effect-detail");
  const timeline = gsap.timeline();
  timeline.fromTo(targets, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: .5, stagger: .1, ease: "power2.out" });
  life.add(() => timeline.kill());
}

async function particleBurst(scene: HTMLElement, key: Exclude<EffectKey, "coins" | "hearts">, life: Scope): Promise<void> {
  const [{ tsParticles }, { loadSlim }] = await Promise.all([import("@tsparticles/engine"), import("@tsparticles/slim")]);
  if (!life.alive()) return;
  await loadSlim(tsParticles);
  if (!life.alive()) return;
  const host = document.createElement("div");
  host.className = "studio-particles";
  host.setAttribute("aria-hidden", "true");
  scene.prepend(host);
  const colors = key === "celebration" ? ["#ffd36a", "#8be6da", "#f7f4ec"] : ["#8be6da", "#b8a1ff", "#ffffff"];
  const container = await tsParticles.load({ element: host, options: {
    fullScreen: { enable: false }, fpsLimit: 30, detectRetina: false,
    particles: {
      number: { value: scene.clientWidth < 400 ? 26 : 48, density: { enable: false } },
      color: { value: colors }, shape: { type: ["circle", "square"] },
      opacity: { value: { min: .45, max: 1 } }, size: { value: { min: 3, max: 9 } },
      rotate: { value: { min: 0, max: 360 }, animation: { enable: true, speed: 16 } },
      move: { enable: true, direction: "bottom", speed: { min: 2, max: 7 }, gravity: { enable: true, acceleration: 4 }, outModes: { default: "destroy" } },
      life: { duration: { value: 4 }, count: 1 }
    }
  } });
  if (!container || !life.alive()) { container?.destroy(); host.remove(); return; }
  scene.classList.add("studio-pixi");
  life.add(() => scene.classList.remove("studio-pixi"));
  life.add(() => { container.destroy(); host.remove(); });
  window.setTimeout(life.stop, 5500);
}

async function coinPhysics(scene: HTMLElement, settings: Settings, life: Scope): Promise<void> {
  const Matter = await import("matter-js");
  if (!life.alive()) return;
  const width = Math.max(1, scene.clientWidth);
  const height = Math.max(1, scene.clientHeight);
  const ratio = Math.min(devicePixelRatio || 1, 1.5);
  const canvas = document.createElement("canvas");
  canvas.className = "studio-particles";
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  canvas.setAttribute("aria-hidden", "true");
  scene.prepend(canvas);
  const context = canvas.getContext("2d");
  if (!context) { canvas.remove(); return; }
  scene.classList.add("studio-pixi");
  life.add(() => scene.classList.remove("studio-pixi"));
  context.scale(ratio, ratio);

  const engine: MatterEngine = Matter.Engine.create({ gravity: { x: 0, y: 1.05 } });
  const walls = [
    Matter.Bodies.rectangle(width / 2, height + 18, width * 3, 40, { isStatic: true }),
    Matter.Bodies.rectangle(-20, height / 2, 40, height * 3, { isStatic: true }),
    Matter.Bodies.rectangle(width + 20, height / 2, 40, height * 3, { isStatic: true })
  ];
  Matter.Composite.add(engine.world, walls);
  const count = width < 400 ? 24 : 44;
  const maxSize = Math.max(7, Math.min(18, (Number(settings.size) || 48) * .25));
  const coins: { body: MatterBody; radius: number; color: string }[] = [];
  const colors = ["#ffd36a", "#ffe9ac", "#e7a433"];
  for (let index = 0; index < count; index++) {
    const radius = maxSize * (.65 + Math.random() * .35);
    const body = Matter.Bodies.circle(width * (.2 + Math.random() * .6), -radius - index * 16, radius, { restitution: .66, friction: .11 });
    Matter.Body.setVelocity(body, { x: (Math.random() - .5) * 5, y: 1 });
    Matter.Composite.add(engine.world, body);
    coins.push({ body, radius, color: colors[index % colors.length] ?? colors[0]! });
  }

  let frame = 0;
  let previous = performance.now();
  let carry = 0;
  const physicsStep = 1000 / 60;
  const started = previous;
  const draw = (now: number): void => {
    if (!life.alive()) return;
    const elapsed = now - started;
    if (elapsed > 5600) { life.stop(); return; }
    const delta = document.hidden ? 0 : Math.min(33.3, now - previous);
    previous = now;
    carry += delta;
    while (carry >= physicsStep) {
      Matter.Engine.update(engine, physicsStep);
      carry -= physicsStep;
    }
    context.clearRect(0, 0, width, height);
    for (const coin of coins) {
      context.save();
      context.translate(coin.body.position.x, coin.body.position.y);
      context.rotate(coin.body.angle);
      context.fillStyle = coin.color;
      context.strokeStyle = "#a96d20";
      context.lineWidth = 1.5;
      context.beginPath(); context.arc(0, 0, coin.radius, 0, Math.PI * 2); context.fill(); context.stroke();
      context.beginPath(); context.arc(0, 0, coin.radius * .67, 0, Math.PI * 2); context.stroke();
      context.restore();
    }
    frame = requestAnimationFrame(draw);
  };
  frame = requestAnimationFrame(draw);
  life.add(() => {
    cancelAnimationFrame(frame);
    Matter.Composite.clear(engine.world, false);
    Matter.Engine.clear(engine);
    canvas.remove();
  });
}

function effect(scene: HTMLElement, key: EffectKey, settings: Settings): Cleanup {
  if (!["coins", "celebration", "hearts", "welcome"].includes(key) || reduced(settings)) return () => undefined;
  const life = scope(scene);
  void captionSequence(scene, life);
  if (key === "celebration") badge(scene.querySelector<HTMLElement>(".effect-emblem"), life);
  if (key === "coins") void coinPhysics(scene, settings, life).catch(() => undefined);
  else if (key !== "hearts") void particleBurst(scene, key, life).catch(() => undefined);
  return life.stop;
}

const studio = { goal, gift, effect };

declare global {
  interface Window { OverlayStudio?: typeof studio; }
}

window.OverlayStudio = studio;
window.dispatchEvent(new CustomEvent("tikreader:studio-ready", { detail: studio }));
