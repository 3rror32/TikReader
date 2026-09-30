/* Local, optional visual engines. Each effect owns and releases its resources. */
window.OverlayStudio = (() => {
  const libraries = new Map(), active = new Map(), goals = new Map();
  const sources = {
    Motion: '/static/vendor/motion/motion.js',
    PIXI: '/static/vendor/pixi.js/pixi.min.js',
    Matter: '/static/vendor/matter-js/matter.min.js',
    lottie: '/static/vendor/lottie-web/lottie_light.min.js'
  };
  function load(name) {
    if (window[name]) return Promise.resolve(window[name]);
    if (!libraries.has(name)) libraries.set(name, new Promise((resolve, reject) => {
      const script = document.createElement('script'); script.src = sources[name];
      script.onload = () => window[name] ? resolve(window[name]) : reject(Error(name));
      script.onerror = () => reject(Error(name)); document.head.append(script);
    }));
    return libraries.get(name);
  }
  function reduced(settings = {}) {
    return settings.animation === 'none' || settings.motion === 'reduced' ||
      (settings.motion !== 'full' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  function scope(node) {
    const callbacks = []; let stopped = false;
    const stop = () => { if (stopped) return; stopped = true; callbacks.splice(0).forEach(fn => { try { fn(); } catch (_) {} }); active.delete(stop); };
    active.set(stop, node);
    return { alive: () => !stopped && node.isConnected, add(fn) { if (stopped) fn(); else callbacks.push(fn); }, stop };
  }
  new MutationObserver(() => { for (const [stop, node] of active) if (!node.isConnected) stop(); })
    .observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('pagehide', () => { for (const stop of [...active.keys()]) stop(); });
  const format = value => Math.round(value).toLocaleString('es-MX');

  function goal(box, { value, target, mode = 'goal', session, id, settings }) {
    box.classList.add('studio-goal');
    if (value == null || !Number.isFinite(value)) return;
    const key = JSON.stringify([session, id, target]), previous = goals.get(key);
    goals.set(key, value); if (goals.size > 80) goals.delete(goals.keys().next().value);
    const ratio = Math.max(0, Math.min(1, value / target)), complete = ratio === 1;
    box.dataset.complete = String(complete);
    const progress = box.querySelector('progress');
    const track = document.createElement('div'); track.className = 'studio-track'; track.setAttribute('aria-hidden', 'true');
    const fill = document.createElement('i'); fill.style.transform = `scaleX(${ratio})`; track.append(fill);
    if (progress) { progress.classList.add('studio-accessible-progress'); progress.after(track); }
    const note = document.createElement('div'); note.className = 'studio-goal-note';
    const label = document.createElement('span'); label.textContent = complete ? '¡Meta cumplida!' : 'Cada aporte cuenta';
    const percent = document.createElement('b'); percent.textContent = `${Math.floor(ratio * 100)}%`; note.append(label, percent);
    if (settings.show_details) box.append(note);
    const number = box.querySelector('.goal-number');
    const display = n => mode === 'countdown' ? Math.max(0, target - n) : n;
    if (number) number.textContent = format(display(value));
    if (reduced(settings)) return;
    const life = scope(box);
    load('Motion').then(Motion => {
      if (!life.alive()) return;
      box.classList.add('studio-motion');
      const start = previous == null ? ratio : Math.max(0, Math.min(1, previous / target));
      life.add(() => fill.style.transform = `scaleX(${ratio})`);
      const bar = Motion.animate(fill, { scaleX: [start, ratio] }, { duration: .75, ease: [.22, 1, .36, 1] }); life.add(() => bar.stop());
      if (number && previous != null && previous !== value) {
        const counter = Motion.animate(display(previous), display(value), { duration: .65, onUpdate: n => number.textContent = format(n) });
        life.add(() => counter.stop());
      }
      if (previous == null) {
        const entrance = Motion.animate(box, { opacity: [0, 1], y: [10, 0] }, { duration: .45 }); life.add(() => entrance.stop());
      }
    }).catch(() => {});
    if (complete && previous != null && previous < target) badge(box, life);
  }
  function gift(box, settings) {
    if (reduced(settings)) return;
    const life = scope(box);
    load('Motion').then(Motion => {
      if (!life.alive()) return;
      box.classList.add('studio-motion');
      const entry = Motion.animate(box, { opacity: [0, 1], x: [22, 0] }, { duration: .48, ease: [.16, 1, .3, 1] });
      const icon = Motion.animate(box.querySelector('.gift-feed-visual'), { scale: [.8, 1.12, 1], rotate: [-7, 3, 0] }, { duration: .65 });
      life.add(() => entry.stop()); life.add(() => icon.stop());
    }).catch(() => {});
  }
  // Original vector medal, rendered by Lottie; no external animation assets.
  function medal() {
    const animated = (a, b) => ({ a: 1, k: [{ t: 0, s: a, e: b, o: { x: [.2], y: [0] }, i: { x: [.2], y: [1] } }, { t: 22, s: b }] });
    return { v: '5.13.0', fr: 30, ip: 0, op: 75, w: 160, h: 160, nm: 'TikReader • meta cumplida', ddd: 0, assets: [], layers: [{
      ddd: 0, ind: 1, ty: 4, nm: 'Medalla', sr: 1,
      ks: { o: { a: 0, k: 100 }, r: animated([-35], [0]), p: { a: 0, k: [80, 80, 0] }, a: { a: 0, k: [0, 0, 0] }, s: animated([20, 20, 100], [100, 100, 100]) },
      shapes: [{ ty: 'el', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [116, 116] }, d: 1 },
        { ty: 'st', c: { a: 0, k: [1, .82, .42, 1] }, o: { a: 0, k: 100 }, w: { a: 0, k: 3 }, lc: 2, lj: 2 },
        { ty: 'sh', ks: { a: 0, k: { i: [[0,0],[0,0],[0,0]], o: [[0,0],[0,0],[0,0]], v: [[-24,0],[-6,19],[28,-20]], c: false } } },
        { ty: 'st', c: { a: 0, k: [1, .9, .67, 1] }, o: { a: 0, k: 100 }, w: { a: 0, k: 8 }, lc: 2, lj: 2 }], ip: 0, op: 75, st: 0, bm: 0 }] };
  }
  function badge(node, life) {
    load('lottie').then(lottie => {
      if (!life.alive()) return;
      const host = document.createElement('span'); host.className = 'studio-medal'; host.setAttribute('aria-hidden', 'true'); node.append(host);
      const animation = lottie.loadAnimation({ container: host, renderer: 'svg', loop: false, autoplay: true, animationData: medal() });
      life.add(() => { animation.destroy(); host.remove(); });
    }).catch(() => {});
  }
  function effect(scene, key, settings) {
    if (!['coins', 'celebration', 'hearts', 'welcome'].includes(key) || reduced(settings)) return () => {};
    const life = scope(scene);
    load('Motion').then(Motion => {
      if (!life.alive()) return;
      for (const [index, child] of [...scene.querySelectorAll('.effect-caption > small,.effect-caption > span,.effect-detail')].entries()) {
        const animation = Motion.animate(child, { opacity: [0, 1], y: [12, 0] }, { duration: .5, delay: index * .1 }); life.add(() => animation.stop());
      }
    }).catch(() => {});
    if (key === 'celebration') badge(scene.querySelector('.effect-emblem'), life);
    // Frequent likes share the compositor-driven heart scene. Avoid creating a
    // second WebGL renderer (and its 30 FPS ticker) for every burst.
    if (key === 'hearts') return life.stop;
    Promise.all([load('PIXI'), key === 'coins' ? load('Matter') : Promise.resolve(null)]).then(async ([PIXI, Matter]) => {
      if (!life.alive()) return;
      const app = new PIXI.Application();
      await app.init({ width: Math.max(1, scene.clientWidth), height: Math.max(1, scene.clientHeight), backgroundAlpha: 0, antialias: true, resolution: Math.min(devicePixelRatio || 1, 1.5), autoDensity: true, preference: 'webgl' });
      if (!life.alive()) { app.destroy(true, { children: true }); return; }
      life.add(() => app.destroy(true, { children: true }));
      app.canvas.className = 'studio-particles'; app.canvas.setAttribute('aria-hidden', 'true'); scene.prepend(app.canvas); scene.classList.add('studio-pixi');
      life.add(() => scene.classList.remove('studio-pixi'));
      const w = app.screen.width, h = app.screen.height, particles = [], colors = key === 'coins' ? [0xffd36a, 0xffe9ac, 0xe7a433] : key === 'hearts' ? [0xff5b87, 0xff9db9, 0xffd6e3] : [0xffd36a, 0x8be6da, 0xf7f4ec];
      const engine = Matter ? Matter.Engine.create({ gravity: { x: 0, y: 1.1 } }) : null;
      if (engine) {
        Matter.Composite.add(engine.world, [Matter.Bodies.rectangle(w / 2, h + 18, w * 3, 40, { isStatic: true }), Matter.Bodies.rectangle(-20, h / 2, 40, h * 3, { isStatic: true }), Matter.Bodies.rectangle(w + 20, h / 2, 40, h * 3, { isStatic: true })]);
        life.add(() => { Matter.Composite.clear(engine.world, false); Matter.Engine.clear(engine); });
      }
      const count = w < 400 ? 28 : 56;
      for (let i = 0; i < count; i++) {
        const size = Math.max(4, Math.min(18, (Number(settings.size) || 48) * (.1 + Math.random() * .2)));
        const graphic = new PIXI.Graphics(), color = colors[i % colors.length];
        if (key === 'coins') graphic.circle(0, 0, size).fill(color).circle(0, 0, size * .7).stroke({ color: 0xa96d20, width: 1.5 });
        else if (key === 'hearts') graphic.moveTo(0,size).bezierCurveTo(-size*2,-size/3,-size,-size*1.5,0,-size/2).bezierCurveTo(size,-size*1.5,size*2,-size/3,0,size).fill(color);
        else graphic.roundRect(-size / 2, -size, size, size * 2, 2).fill(color);
        graphic.x = Math.random() * w; graphic.y = -Math.random() * h; app.stage.addChild(graphic);
        const body = engine ? Matter.Bodies.circle(w * (.3 + Math.random() * .4), -size - i * 24, size, { restitution: .62, friction: .12 }) : null;
        if (body) { Matter.Body.setVelocity(body, { x: (Math.random() - .5) * 5, y: 1 }); Matter.Composite.add(engine.world, body); }
        particles.push({ graphic, body, speed: 40 + Math.random() * 80, spin: (Math.random() - .5) * 2, phase: Math.random() * 6 });
      }
      let elapsed = 0; app.ticker.maxFPS = 30;
      app.ticker.add(ticker => {
        const dt = Math.min(ticker.deltaMS, 33.33); elapsed += dt / 1000;
        if (document.hidden) return;
        if (engine) Matter.Engine.update(engine, dt);
        for (const p of particles) {
          if (p.body) { p.graphic.position.set(p.body.position.x, p.body.position.y); p.graphic.rotation = p.body.angle; }
          else { p.graphic.y += p.speed * dt / 1000; p.graphic.x += Math.sin(elapsed + p.phase) * dt * .012; p.graphic.rotation += p.spin * dt / 1000; if (p.graphic.y > h + 24) p.graphic.y = -24; }
        }
      });
    }).catch(() => { /* CSS particles remain available when WebGL cannot start. */ });
    return life.stop;
  }
  return { goal, gift, effect };
})();
