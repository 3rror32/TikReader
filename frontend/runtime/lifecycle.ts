export type Cleanup = () => void;

/** Owns timers, animation frames and renderers for one OBS browser source. */
export class OverlayLifecycle {
  private cleanups = new Set<Cleanup>();
  private pauseHandlers = new Set<(paused: boolean) => void>();
  private disposed = false;

  constructor() {
    document.addEventListener("visibilitychange", this.onVisibility);
    window.addEventListener("pagehide", this.dispose, { once: true });
  }

  get paused(): boolean {
    return document.hidden;
  }

  own(cleanup: Cleanup): Cleanup {
    if (this.disposed) cleanup();
    else this.cleanups.add(cleanup);
    return () => {
      if (!this.cleanups.delete(cleanup)) return;
      cleanup();
    };
  }

  onPause(handler: (paused: boolean) => void): Cleanup {
    this.pauseHandlers.add(handler);
    handler(this.paused);
    return this.own(() => this.pauseHandlers.delete(handler));
  }

  interval(callback: () => void, delay: number): Cleanup {
    let timer = 0;
    const stop = () => {
      window.clearInterval(timer);
      timer = 0;
    };
    const start = () => {
      stop();
      if (!this.paused) timer = window.setInterval(callback, delay);
    };
    const removePause = this.onPause(start);
    return this.own(() => {
      removePause();
      stop();
    });
  }

  timeout(callback: () => void, delay: number): Cleanup {
    let timer = 0;
    let startedAt = 0;
    let remaining = delay;
    const stop = () => {
      window.clearTimeout(timer);
      timer = 0;
    };
    const start = () => {
      stop();
      if (this.paused || remaining <= 0) return;
      startedAt = performance.now();
      timer = window.setTimeout(() => {
        timer = 0;
        remaining = 0;
        callback();
      }, remaining);
    };
    const removePause = this.onPause(paused => {
      if (paused && timer) remaining = Math.max(0, remaining - (performance.now() - startedAt));
      start();
    });
    return this.own(() => {
      removePause();
      stop();
    });
  }

  frame(callback: (time: number) => void): Cleanup {
    let frame = 0;
    const tick = (time: number) => {
      if (this.paused || this.disposed) return;
      callback(time);
      frame = requestAnimationFrame(tick);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };
    const removePause = this.onPause(paused => {
      stop();
      if (!paused) frame = requestAnimationFrame(tick);
    });
    return this.own(() => {
      removePause();
      stop();
    });
  }

  private onVisibility = (): void => {
    for (const handler of this.pauseHandlers) handler(this.paused);
  };

  dispose = (): void => {
    if (this.disposed) return;
    this.disposed = true;
    document.removeEventListener("visibilitychange", this.onVisibility);
    for (const cleanup of [...this.cleanups]) {
      try { cleanup(); } catch { /* Best-effort teardown during page close. */ }
    }
    this.cleanups.clear();
    this.pauseHandlers.clear();
  };
}
