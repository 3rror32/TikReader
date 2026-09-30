export {};

type Status = "ok" | "warn" | "fail";
type ReadinessCheck = {
  id: string;
  title: string;
  status: Status;
  detail: string;
  action: string;
  required: boolean;
};
type Readiness = {
  ready: boolean;
  checks: ReadinessCheck[];
  summary: Record<Status, number>;
  generated_at: string;
};
type ComponentRow = {
  id: string;
  name: string;
  description: string;
  installed: boolean;
  bytes: number;
  removable: boolean;
  bundled: boolean;
  action: string;
};
type Components = { components: ComponentRow[]; free_bytes: number; busy: boolean; scope: string };
type Production = { emergency: boolean };
type Interactive = { external: boolean };
type Hotkeys = { authorized: boolean; paused: boolean };
type Spotify = { connected: boolean };
type Catalog = { gifts: unknown[] };
type Studio = { connection: { connected: boolean } };
type LanAccess = { enabled: boolean; token: string; port: number; scope: string };

declare global {
  interface Window {
    Shell?: { show: (section: string) => void };
    I18n?: { locale?: string; confirm?: (message: string) => boolean };
  }
}

const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] => {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
};

async function request<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    cache: "no-store",
    headers: body === undefined ? { Accept: "application/json" } : { Accept: "application/json", "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(8000)
  });
  const payload = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || `No se pudo completar la operación (${response.status}).`);
  return payload;
}

const formatBytes = (bytes: number): string => {
  if (bytes < 1024 ** 2) return `${Math.max(0, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(0)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
};

const pane = node("section", undefined, "studio-pane control-room");
pane.dataset.section = "control-center";
const heading = node("div", undefined, "control-room-heading");
const headingCopy = node("div");
headingCopy.append(node("span", "CABINA · SEÑAL PREVIA", "control-room-eyebrow"), node("h2", "Centro de control"),
  node("p", "Comprueba el recorrido completo antes de abrir el directo. Nada se activa por entrar aquí."));
const refreshButton = node("button", "Revisar ahora", "control-room-refresh");
refreshButton.type = "button";
heading.append(headingCopy, refreshButton);

const signal = node("div", undefined, "signal-line");
signal.setAttribute("aria-live", "polite");
const readinessGrid = node("div", undefined, "readiness-grid control-readiness-grid");
const operations = node("div", undefined, "readiness-grid control-operations-grid");
const components = node("div", undefined, "component-grid");
const notices = node("div", undefined, "control-notices");
notices.setAttribute("aria-live", "polite");
const statusText = node("p", "Preparando revisión…", "control-room-status");
statusText.setAttribute("role", "status");
let noticeHistory: { text: string; at: number }[] = [];

const sectionTitle = (eyebrow: string, title: string, detail: string): HTMLElement => {
  const box = node("div", undefined, "control-section-heading");
  box.append(node("span", eyebrow, "control-room-eyebrow"), node("h3", title), node("p", detail));
  return box;
};

function button(label: string, action: () => void | Promise<void>, className = ""): HTMLButtonElement {
  const control = node("button", label, className);
  control.type = "button";
  control.onclick = () => { void Promise.resolve(action()).catch(error => notify(error instanceof Error ? error.message : String(error))); };
  return control;
}

function notify(text: string): void {
  const clean = String(text).trim();
  if (!clean) return;
  noticeHistory = [{ text: clean, at: Date.now() }, ...noticeHistory.filter(item => item.text !== clean)].slice(0, 30);
  notices.replaceChildren(...noticeHistory.map(item => node("p", `${new Date(item.at).toLocaleTimeString(window.I18n?.locale || "es-419", { hour12: true })} · ${item.text}`)));
}

function renderReadiness(payload: Readiness): void {
  signal.replaceChildren();
  const lead = node("div", payload.ready ? "LISTO" : "REVISAR", `signal-verdict is-${payload.ready ? "ok" : "fail"}`);
  const track = node("div", undefined, "signal-track");
  for (const check of payload.checks) {
    const mark = node("span", undefined, `signal-mark is-${check.status}`);
    mark.title = `${check.title}: ${check.detail}`;
    track.append(mark);
  }
  signal.append(lead, track, node("small", `${payload.summary.ok} correctos · ${payload.summary.warn} avisos · ${payload.summary.fail} bloqueos`));

  readinessGrid.replaceChildren(...payload.checks.map(check => {
    const card = node("article", undefined, `setting-card readiness-card is-${check.status}`);
    const title = node("h3");
    title.append(node("span", check.status === "ok" ? "OK" : check.status === "warn" ? "AVISO" : "BLOQUEO", "readiness-status"), document.createTextNode(check.title));
    card.append(title, node("p", check.detail));
    if (check.action) card.append(node("small", check.action, "readiness-action"));
    return card;
  }));
  statusText.textContent = payload.ready ? "Los requisitos principales están listos." : "Hay bloqueos que conviene resolver antes del directo.";
}

function renderOperations(values: [Production, Interactive, Hotkeys, Spotify, Catalog, Studio]): void {
  const [production, interactive, hotkeys, spotify, catalog, studio] = values;
  const rows: [string, string, string, string][] = [
    ["Transmisión", studio.connection.connected ? "LIVE conectado" : "Sin LIVE; el diseño local sigue disponible.", "Abrir transmisión", "live"],
    ["Catálogo de regalos", catalog.gifts.length ? `${catalog.gifts.length} regalos disponibles` : "Se completa al conectar un LIVE.", "Configurar regalos", "game-hotkeys"],
    ["Control del juego", hotkeys.authorized ? (hotkeys.paused ? "Teclas pausadas" : "Teclas autorizadas") : "Teclas desactivadas.", "Configurar juego", "game-hotkeys"],
    ["Emisión", production.emergency ? "Emisión silenciada; alertas y teclas bloqueadas." : "Emisión disponible.", "Escenas y privacidad", "production"],
    ["Spotify", spotify.connected ? "Spotify autorizado." : "Sin conectar; es opcional.", "Configurar Spotify", "spotify"],
    ["Streamer.bot", interactive.external ? "Conector autorizado." : "Conector desactivado; es opcional.", "Configurar conector", "streamerbot"]
  ];
  operations.replaceChildren(...rows.map(([title, detail, label, target]) => {
    const card = node("article", undefined, "setting-card operation-card");
    card.append(node("h3", title), node("p", detail), button(label, () => window.Shell?.show(target)));
    return card;
  }));
}

async function removeComponent(component: ComponentRow): Promise<void> {
  const phrase = component.id === "kokoro" ? "ELIMINAR KOKORO" : "ELIMINAR RVC";
  const entered = prompt(`Esta acción libera ${formatBytes(component.bytes)} y desactiva ${component.name}. Escribe ${phrase} para continuar.`);
  if (entered !== phrase) return;
  await request(`/system/components/${encodeURIComponent(component.id)}`, "DELETE", { confirmation: phrase });
  notify(`${component.name} eliminado. Puedes instalarlo nuevamente cuando lo necesites.`);
  await refresh();
}

function renderComponents(payload: Components): void {
  components.replaceChildren(...payload.components.map(component => {
    const card = node("article", undefined, "setting-card component-card");
    const meta = component.installed ? `${formatBytes(component.bytes)} · ${component.bundled ? "incluido" : "instalado"}` : "No instalado";
    card.append(node("span", meta, "component-size"), node("h3", component.name), node("p", component.description));
    const actions = node("div", undefined, "component-actions");
    if (component.action === "install-kokoro") actions.append(button("Instalar", async () => {
      await request("/system/voices/install", "POST", { confirm: true });
      notify("Instalación de Kokoro iniciada. TikReader mostrará su progreso en Voz.");
    }));
    if (component.action === "manage-models") actions.append(button("Administrar modelos", () => window.Shell?.show("custom-voice")));
    if (component.removable) actions.append(button("Liberar espacio", () => removeComponent(component), "component-remove"));
    if (actions.childElementCount) card.append(actions);
    return card;
  }));
  const free = node("p", `${formatBytes(payload.free_bytes)} disponibles en la unidad de datos. ${payload.scope}`, "component-free");
  components.append(free);
}

async function renderLan(): Promise<void> {
  const access = await request<LanAccess>("/system/lan-access");
  const existing = pane.querySelector(".lan-access-card");
  existing?.remove();
  if (!access.enabled) return;
  const card = node("article", undefined, "setting-card lan-access-card");
  const example = `http://IP-DE-ESTE-EQUIPO:${access.port}/widget/chat?access=${access.token}`;
  const code = node("code", example);
  card.append(node("h3", "Overlays protegidos en la red local"), node("p", "Las vistas abiertas desde otro dispositivo necesitan esta clave de solo lectura."), code,
    button("Copiar ejemplo protegido", async () => {
      await navigator.clipboard.writeText(example);
      notify("URL protegida copiada.");
    }));
  components.before(card);
}

let refreshing = false;
async function refresh(): Promise<void> {
  if (refreshing) return;
  refreshing = true;
  refreshButton.disabled = true;
  try {
    const [ready, componentData, production, interactive, hotkeys, spotify, catalog, studio] = await Promise.all([
      request<Readiness>("/system/readiness"), request<Components>("/system/components"),
      request<Production>("/production/state"), request<Interactive>("/interactivity"),
      request<Hotkeys>("/game-hotkeys"), request<Spotify>("/spotify/state"),
      request<Catalog>("/gift-catalog"), request<Studio>("/studio/state")
    ]);
    renderReadiness(ready);
    renderComponents(componentData);
    renderOperations([production, interactive, hotkeys, spotify, catalog, studio]);
    await renderLan();
  } catch (error) {
    statusText.textContent = error instanceof Error ? error.message : String(error);
  } finally {
    refreshing = false;
    refreshButton.disabled = false;
  }
}

refreshButton.onclick = () => { void refresh(); };
const controls = node("div", undefined, "tool-buttons pane-actions");
controls.append(
  button("Activar o apagar voz", () => document.getElementById("voice-toggle")?.click()),
  button("Control de voz y efectos", () => {
    document.getElementById("emergency-button")?.scrollIntoView({ block: "center" });
    document.getElementById("emergency-button")?.focus();
  }),
  button("Pausar o reanudar hotkeys", async () => {
    const current = await request<Hotkeys>("/game-hotkeys");
    await request("/game-hotkeys/pause", "POST", { paused: !current.paused });
    await refresh();
  })
);

pane.append(heading, signal, statusText,
  sectionTitle("01 · PREPARACIÓN", "Ruta de señal", "Requisitos del servicio, almacenamiento, historial y emisión."), readinessGrid,
  sectionTitle("02 · OPERACIÓN", "Herramientas conectadas", "Accesos rápidos; abrir esta pantalla no conecta servicios."), operations, controls,
  sectionTitle("03 · ESPACIO", "Componentes locales", "Instala solo lo que uses y recupera espacio sin tocar tu historial."), components,
  sectionTitle("04 · ACTIVIDAD", "Notificaciones recientes", "Mensajes operativos de esta sesión del panel."),
  button("Vaciar notificaciones", () => { noticeHistory = []; notices.replaceChildren(); }), notices);
document.querySelector(".app")?.append(pane);

new MutationObserver(records => {
  for (const record of records) {
    const target = record.target.nodeType === Node.TEXT_NODE ? record.target.parentElement : record.target as HTMLElement;
    if (target?.getAttribute?.("role") === "status" && !pane.contains(target)) notify(target.textContent || "");
  }
}).observe(document.body, { childList: true, characterData: true, subtree: true });

void refresh();
window.setInterval(() => { if (!pane.hidden && !document.hidden) void refresh(); }, 15000);
