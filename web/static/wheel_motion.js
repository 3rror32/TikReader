(() => {
  const active = new Map();
  let audioContext = null,muted=false;

  function mute(on){muted=on;if(on){for(const animation of active.values())animation.cancel();audioContext?.close().catch(()=>{});audioContext=null;}}
  document.addEventListener('tikreader:audio-muted',e=>mute(e.detail));
  function unlockAudio() {
    if(muted||window.tikreaderAudioMuted)return;
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === 'suspended') audioContext.resume();
    } catch (_) {}
  }

  function rouletteClick(strength = 1) {
    if (muted || window.tikreaderAudioMuted || !audioContext || audioContext.state !== 'running') return;
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(1050 + strength * 380, now);
    oscillator.frequency.exponentialRampToValueAtTime(420, now + .026);
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime(.025 + strength * .035, now + .002);
    gain.gain.exponentialRampToValueAtTime(.0001, now + .035);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + .04);
  }

  // Integral of smoothstep: continuous acceleration, cruise and loss of momentum.
  const smoothstepArea = x => x * x * x - .5 * x * x * x * x;
  function physicalProgress(t) {
    const acceleration = .17;
    const cruise = .34;
    const braking = 1 - acceleration - cruise;
    const totalArea = acceleration * .5 + cruise + braking * .5;
    if (t <= acceleration) {
      const x = t / acceleration;
      return acceleration * smoothstepArea(x) / totalArea;
    }
    if (t <= acceleration + cruise) {
      return (acceleration * .5 + t - acceleration) / totalArea;
    }
    const x = (t - acceleration - cruise) / braking;
    return (acceleration * .5 + cruise + braking * (x - smoothstepArea(x))) / totalArea;
  }

  function kickPointer(pointer, intensity) {
    if (!pointer) return;
    pointer.style.setProperty('--pointer-kick', `${Math.round(8 + intensity * 10)}deg`);
    pointer.classList.remove('is-ticking');
    void pointer.offsetWidth;
    pointer.classList.add('is-ticking');
  }

  function spin({ disc, pointer, startAngle, endAngle, duration, segments = 6, sound = true }) {
    if(muted||window.tikreaderAudioMuted)return Promise.resolve(false);
    if (sound) unlockAudio();
    active.get(disc)?.cancel();
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const seconds = reduced ? Math.min(.8, duration) : Math.max(.4, duration);
    const start = Number(startAngle) || 0;
    const end = Number(endAngle) || start;
    const delta = end - start;
    const step = 360 / Math.max(1, Number(segments) || 1);
    let frame = 0;
    let cancelled = false;
    let lastSlot = Math.floor(start / step);
    let lastClickAt = 0;
    const startedAt = performance.now();

    disc.style.transition = 'none';
    disc.style.willChange = 'transform';
    disc.style.transform = `rotate(${start}deg)`;
    disc.classList.add('is-spinning');

    let finish;
    const promise = new Promise(resolve => {
      finish=resolve;
      const draw = now => {
        if (cancelled) return resolve(false);
        const t = Math.min(1, (now - startedAt) / (seconds * 1000));
        const progress = physicalProgress(t);
        const angle = start + delta * progress;
        disc.style.transform = `rotate(${angle}deg)`;
        const slot = Math.floor(angle / step);
        if (slot !== lastSlot && now - lastClickAt > 22) {
          const velocity = t < .17 ? t / .17 : t > .51 ? (1 - t) / .49 : 1;
          kickPointer(pointer, Math.max(.15, velocity));
          if (sound) rouletteClick(Math.max(.15, velocity));
          lastSlot = slot;
          lastClickAt = now;
        }
        if (t < 1) frame = requestAnimationFrame(draw);
        else {
          disc.style.transform = `rotate(${end}deg)`;
          disc.style.willChange = '';
          disc.classList.remove('is-spinning');
          pointer?.classList.remove('is-ticking');
          active.delete(disc);
          resolve(true);
        }
      };
      frame = requestAnimationFrame(draw);
    });

    active.set(disc, { cancel() { cancelled = true; cancelAnimationFrame(frame); disc.classList.remove('is-spinning');disc.style.willChange='';pointer?.classList.remove('is-ticking');active.delete(disc);finish(false); } });
    return promise;
  }

  window.addEventListener('pointerdown', unlockAudio, { once: true, capture: true });
  window.WheelMotion = { spin, unlockAudio, mute };
})();
