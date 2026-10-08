import { OverlayTransport } from "../runtime/transport";

declare global {
  interface Window { TikReaderOverlay?: OverlayTransport; }
}

const params = new URLSearchParams(location.search);
const preview = params.has("preview") || params.has("editor");

if (!preview) {
  window.TikReaderOverlay ??= new OverlayTransport();
  window.dispatchEvent(new CustomEvent("tikreader:runtime-ready", { detail: window.TikReaderOverlay }));
}
