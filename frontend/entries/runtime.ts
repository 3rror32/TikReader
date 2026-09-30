import { OverlayTransport } from "../runtime/transport";

declare global {
  interface Window { TikReaderOverlay?: OverlayTransport; }
}

window.TikReaderOverlay ??= new OverlayTransport();
window.dispatchEvent(new CustomEvent("tikreader:runtime-ready", { detail: window.TikReaderOverlay }));
