import { io, type Socket } from "socket.io-client";
import { OverlayLifecycle, type Cleanup } from "./lifecycle";

const LIVE_EVENTS = [
  "connected", "disconnected", "reconnecting", "new_comment", "stats_update",
  "gift_history", "session_summary", "participants_update", "tiktok_error"
] as const;

export class OverlayTransport extends EventTarget {
  readonly lifecycle = new OverlayLifecycle();
  private socket: Socket;
  private refreshQueued = false;

  constructor() {
    super();
    this.socket = io({
      path: "/socket.io",
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
      timeout: 5000
    });
    for (const event of LIVE_EVENTS) {
      this.socket.on(event, payload => this.queueData(event, payload));
    }
    this.socket.on("connect", () => this.dispatchEvent(new CustomEvent("connection", { detail: true })));
    this.socket.on("disconnect", () => this.dispatchEvent(new CustomEvent("connection", { detail: false })));
    this.lifecycle.own(() => this.socket.close());
  }

  onData(handler: (event: CustomEvent) => void): Cleanup {
    const listener = handler as EventListener;
    this.addEventListener("data", listener);
    return this.lifecycle.own(() => this.removeEventListener("data", listener));
  }

  recovery(callback: () => void, milliseconds = 5000): Cleanup {
    return this.lifecycle.interval(callback, milliseconds);
  }

  async json<T>(url: string, timeout = 4500): Promise<T> {
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(timeout),
      headers: { Accept: "application/json" }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
    return response.json() as Promise<T>;
  }

  private queueData(type: string, payload: unknown): void {
    if (this.refreshQueued) return;
    this.refreshQueued = true;
    queueMicrotask(() => {
      this.refreshQueued = false;
      this.dispatchEvent(new CustomEvent("data", { detail: { type, payload } }));
    });
  }
}
