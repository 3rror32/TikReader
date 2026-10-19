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
type Operations = {
  production: { emergency: boolean };
  streamerbot: { external: boolean };
  hotkeys: { authorized: boolean; paused: boolean };
  spotify: { connected: boolean };
  catalog: { count: number };
  connection: { connected: boolean; platforms: { platform: string; state: string }[] };
};
type LanAccess = { enabled: boolean; token: string; port: number; scope: string; fingerprint: string; readers: { address: string; last_seen: number }[] };
type Backups = { enabled: boolean; interval_hours: number; keep: number; last_at: number; last_file: string; last_error: string; last_attempt_at?: number; status_error?: string; scope?: string; next_at: number; starts_disabled: boolean };
type UpdateSafety = { version: string; installed: boolean; rollback_backups: number; method: string };
type Hotkeys = { authorized: boolean; paused: boolean };
type ControlSnapshot = { readiness: Readiness; components: Components; backups: Backups; lan: LanAccess; operations: Operations; update: UpdateSafety };

declare global {
  interface Window {
    Shell?: { show: (section: string) => void; registerView?: (section: string, pane: HTMLElement) => HTMLElement | null };
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
  if (bytes < 1024) return `${Math.max(0, Math.round(bytes))} B`;
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
const continuity = node("div", undefined, "continuity-grid");
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

function renderOperations(value: Operations): void {
  const { production, streamerbot, hotkeys, spotify, catalog, connection } = value;
  const external = connection.platforms.filter(item => item.state === "connected").map(item => item.platform).join(", ");
  const rows: [string, string, string, string][] = [
    ["Transmisión", connection.connected || external ? `LIVE activo${external ? ` · ${external}` : ""}` : "Sin LIVE; el diseño local sigue disponible.", "Abrir transmisión", "live"],
    ["Catálogo de regalos", catalog.count ? `${catalog.count} regalos disponibles` : "Se completa al conectar un LIVE.", "Configurar regalos", "game-hotkeys"],
    ["Control del juego", hotkeys.authorized ? (hotkeys.paused ? "Teclas pausadas" : "Teclas autorizadas") : "Teclas desactivadas.", "Configurar juego", "game-hotkeys"],
    ["Emisión", production.emergency ? "Emisión silenciada; alertas y teclas bloqueadas." : "Emisión disponible.", "Escenas y privacidad", "production"],
    ["Spotify", spotify.connected ? "Spotify autorizado." : "Sin conectar; es opcional.", "Configurar Spotify", "spotify"],
    ["Streamer.bot", streamerbot.external ? "Conector autorizado." : "Conector desactivado; es opcional.", "Configurar conector", "streamerbot"]
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
    if (component.action === "install-kokoro" && !payload.busy) actions.append(button("Instalar", async () => {
      await request("/system/voices/install", "POST", { confirm: true });
      notify("Instalación de Kokoro iniciada. TikReader mostrará su progreso en Voz.");
      await refresh();
    }));
    if (component.id === "kokoro" && payload.busy) actions.append(button("Detener descarga", async () => {
      await request("/system/voices/cancel", "POST", { confirm: true });
      notify("Deteniendo la descarga; el avance se conservará para continuar después.");
      await refresh();
    }, "component-remove"));
    if (component.action === "manage-models") actions.append(button("Administrar modelos", () => window.Shell?.show("custom-voice")));
    if (component.removable) actions.append(button("Liberar espacio", () => removeComponent(component), "component-remove"));
    if (actions.childElementCount) card.append(actions);
    return card;
  }));
  const free = node("p", `${formatBytes(payload.free_bytes)} disponibles en la unidad de datos. ${payload.scope}`, "component-free");
  components.append(free);
}

function renderLan(access: LanAccess): void {
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
    }), button("Renovar clave", async () => {
      const accepted = window.I18n?.confirm
        ? window.I18n.confirm("¿Renovar la clave? Las URLs remotas actuales dejarán de funcionar.")
        : window.confirm("¿Renovar la clave? Las URLs remotas actuales dejarán de funcionar.");
      if (!accepted) return;
      await request("/system/lan-access/rotate", "POST", { confirm: true });
      notify("Clave renovada. Vuelve a copiar las URLs remotas.");
      await refresh();
    }));
  components.before(card);
}

function renderContinuity(backups: Backups, update: UpdateSafety): void {
  const backupCard = node("article", undefined, "setting-card continuity-card");
  const toggleLabel = node("label", undefined, "backup-toggle");
  const toggle = node("input") as HTMLInputElement; toggle.type = "checkbox"; toggle.checked = backups.enabled;
  toggleLabel.append(toggle, document.createTextNode(" Activar respaldos automáticos"));
  const frequency = node("select") as HTMLSelectElement;
  for (const [value, label] of [["6", "Cada 6 horas"], ["12", "Cada 12 horas"], ["24", "Cada día"], ["72", "Cada 3 días"], ["168", "Cada semana"]] as const) {
    const option = node("option", label) as HTMLOptionElement; option.value = value; frequency.append(option);
  }
  frequency.value = String(backups.interval_hours);
  const keep = node("select") as HTMLSelectElement;
  for (const value of [3, 7, 14, 30]) { const option = node("option", `Conservar ${value}`) as HTMLOptionElement; option.value = String(value); keep.append(option); }
  keep.value = String(backups.keep);
  const detail = backups.last_at ? `Último respaldo correcto: ${new Date(backups.last_at * 1000).toLocaleString()}` : "Todavía no se ha creado un respaldo correcto.";
  const schedule = backups.enabled && backups.next_at ? `Próximo intento: ${new Date(backups.next_at * 1000).toLocaleString()}` : "Programación desactivada.";
  backupCard.append(node("h3", "Respaldos automáticos"), node("p", "Al activarlos, el primer respaldo se programa para la frecuencia elegida."),
    node("p", backups.scope || "Solo incluyen la base de datos del historial y sus ajustes guardados; no incluyen medios, modelos, credenciales ni archivos externos."), toggleLabel, frequency, keep,
    button("Guardar opción", async () => { await request("/history/automatic-backups", "POST", { enabled: toggle.checked, interval_hours: Number(frequency.value), keep: Number(keep.value) }); notify(toggle.checked ? "Respaldos automáticos activados." : "Respaldos automáticos desactivados."); await refresh(); }),
    button("Crear respaldo ahora", async () => { await request("/history/automatic-backups/run", "POST", {}); notify("Respaldo manual de la base de datos creado."); await refresh(); }), node("small", detail), node("p", schedule));
  if (backups.last_attempt_at) backupCard.append(node("small", `Último intento: ${new Date(backups.last_attempt_at * 1000).toLocaleString()}`));
  if (backups.last_error || backups.status_error) backupCard.append(node("p", [backups.last_error, backups.status_error].filter(Boolean).join(" · ")));
  backupCard.append(node("p", `Conservar ${backups.keep} se aplica después de un respaldo automático correcto; no elimina copias al guardar esta opción.`),
    button("Administrar respaldos", async () => { backupManagement.hidden = false; await listBackups(); }));
  const updateCard = node("article", undefined, "setting-card continuity-card");
  updateCard.append(node("h3", "Actualizaciones seguras"), node("p", `Versión ${update.version} · ${update.installed ? "usa el instalador verificado" : "acepta paquetes verificados"}.`),
    node("small", `${update.rollback_backups} respaldos de código disponibles para recuperación.`));
  continuity.replaceChildren(backupCard, updateCard, backupManagement);
}

type BackupFile = { id: string; name: string; kind: string; type: string; modified_at: number; bytes: number; selectable: boolean; reason: string };
type BackupPreview = { token: string; files: BackupFile[]; limited: boolean; max_selected: number; scope: string };
type BackupDeletion = { deleted: number; bytes: number; skipped: number; failures: { id: string; error: string }[] };
const backupManagement = node("article", undefined, "setting-card backup-management");
backupManagement.hidden = true;
const backupStatus = node("p");
backupStatus.setAttribute("role", "status");
const backupRows = node("tbody");
const backupTable = node("table");
const backupHead = node("tr");
for (const label of ["Seleccionar", "Archivo", "Tipo", "Última modificación", "Tamaño lógico", "Protección"]) backupHead.append(node("th", label));
const backupHeader = node("thead"); backupHeader.append(backupHead); backupTable.append(backupHeader, backupRows);
const backupScroll = node("div");
backupScroll.style.overflow = "auto"; backupScroll.style.maxHeight = "30rem"; backupScroll.tabIndex = 0;
backupScroll.setAttribute("role", "region"); backupScroll.setAttribute("aria-label", "Lista de respaldos y su protección"); backupScroll.append(backupTable);
const backupTotals = node("p", "0 respaldos seleccionados · 0 B");
backupTotals.setAttribute("aria-live", "polite");
const backupResults = node("div"); backupResults.setAttribute("aria-live", "polite");
const backupConfirmation = node("div"); backupConfirmation.hidden = true;
const backupConfirmationText = node("p");
let backupPreview: BackupPreview | null = null;
let backupBusy = false;
const backupSelected = new Set<string>();
function setBackupBusy(value: boolean): void {
  backupBusy = value; backupManagement.setAttribute("aria-busy", String(value));
  for (const control of backupManagement.querySelectorAll<HTMLInputElement | HTMLButtonElement>("input,button")) control.disabled = value;
  for (const checkbox of backupRows.querySelectorAll<HTMLInputElement>("input")) checkbox.disabled = value || !backupPreview?.files.find(row => row.id === checkbox.value)?.selectable;
  backupDelete.disabled = value || backupSelected.size === 0;
}
function selectedBackupSize(): number { return backupPreview?.files.filter(row => backupSelected.has(row.id)).reduce((sum, row) => sum + row.bytes, 0) || 0; }
function updateBackupTotals(): void {
  backupConfirmation.hidden = true;
  backupTotals.textContent = `${backupSelected.size} respaldos seleccionados · ${formatBytes(selectedBackupSize())}`;
  backupDelete.disabled = backupBusy || backupSelected.size === 0;
}
async function listBackups(): Promise<void> {
  if (backupBusy) return;
  setBackupBusy(true); backupPreview = null; backupSelected.clear(); updateBackupTotals();
  backupStatus.textContent = "Revisando respaldos reconocidos…";
  try {
    backupPreview = await request<BackupPreview>("/system/backup-cleanup");
    backupRows.replaceChildren(...backupPreview.files.map(file => {
      const row = node("tr");
      const selection = node("td"), checkbox = node("input"); checkbox.type = "checkbox"; checkbox.value = file.id;
      checkbox.setAttribute("aria-label", `Seleccionar ${file.name}`); checkbox.disabled = !file.selectable;
      checkbox.onchange = () => {
        if (checkbox.checked && backupSelected.size >= (backupPreview?.max_selected || 50)) { checkbox.checked = false; backupStatus.textContent = `Selecciona hasta ${backupPreview?.max_selected || 50} respaldos por operación.`; return; }
        if (checkbox.checked) backupSelected.add(file.id); else backupSelected.delete(file.id);
        updateBackupTotals();
      };
      selection.append(checkbox); const filename = node("td", file.name); filename.style.overflowWrap = "anywhere";
      row.append(selection, filename, node("td", file.type), node("td", new Date(file.modified_at * 1000).toLocaleString()), node("td", formatBytes(file.bytes)), node("td", file.reason || "Antiguo; disponible para seleccionar."));
      return row;
    }));
    backupStatus.textContent = `${backupPreview.files.length} respaldos reconocidos.${backupPreview.limited ? " Análisis incompleto: no se habilita ninguna eliminación." : " El más reciente de cada tipo y los archivos de menos de 24 horas permanecen protegidos."}`;
  } catch (error) {
    backupRows.replaceChildren(); backupStatus.textContent = error instanceof Error ? error.message : "No se pudo revisar la lista.";
  } finally { setBackupBusy(false); }
}
const backupRefresh = button("Actualizar lista de respaldos", listBackups);
const backupDelete = button("Eliminar selección", () => {
  if (!backupPreview || !backupSelected.size || backupBusy) return;
  backupConfirmationText.textContent = `¿Eliminar ${backupSelected.size} respaldos seleccionados (${formatBytes(selectedBackupSize())})? No se puede deshacer. Las copias protegidas se conservan.`;
  backupConfirmation.hidden = false;
});
const backupConfirm = button("Confirmar eliminación de respaldos", async () => {
  if (!backupPreview || !backupSelected.size || backupBusy) return;
  const token = backupPreview.token, selected = [...backupSelected], names = new Map(backupPreview.files.map(row => [row.id, row.name]));
  setBackupBusy(true); backupConfirmation.hidden = true;
  try {
    const result = await request<BackupDeletion>("/system/backup-cleanup", "POST", { confirm: true, token, selected });
    backupResults.replaceChildren(node("p", `Eliminados: ${result.deleted} respaldos · tamaño eliminado: ${formatBytes(result.bytes)}. Omitidos por cambios o protección: ${result.skipped}. Fallos: ${result.failures.length}.`),
      ...result.failures.map(item => node("p", `${names.get(item.id) || "Respaldo seleccionado"}: ${item.error}`)));
    setBackupBusy(false); await listBackups();
  } catch (error) {
    backupPreview = null; backupSelected.clear(); updateBackupTotals();
    backupStatus.textContent = error instanceof Error ? error.message : "No se pudo confirmar la eliminación.";
  } finally { setBackupBusy(false); }
});
backupConfirmation.append(backupConfirmationText, backupConfirm, button("Cancelar eliminación de respaldos", () => { backupConfirmation.hidden = true; }));
backupManagement.append(node("h3", "Administrar respaldos"), node("p", "Solo copias reconocidas en las carpetas administradas por TikReader. Tamaño lógico y fecha de última modificación; no se buscan exportaciones en otras carpetas."),
  backupRefresh, button("Cerrar lista de respaldos", () => { backupManagement.hidden = true; }), backupStatus, backupScroll, backupTotals, backupDelete, backupConfirmation, backupResults);

type CleanupPreview = { token: string; count: number; bytes: number; limited: boolean; scan_failures: number; scope: string };
type CleanupResult = { deleted: number; bytes: number; skipped: number; failures: { item: number; kind: string; error: string }[] };
const cleanupCard = node("article", undefined, "setting-card generated-cleanup-card");
const cleanupStatus = node("p", "Analiza los archivos antes de confirmar la limpieza.");
cleanupStatus.setAttribute("role", "status");
const cleanupResult = node("div");
cleanupResult.setAttribute("aria-live", "polite");
const cleanupConfirmation = node("div", undefined, "component-actions");
cleanupConfirmation.hidden = true;
let cleanupPreview: CleanupPreview | null = null;
let cleanupBusy = false;
const cleanupScan = button("Liberar espacio", async () => {
  if (cleanupBusy) return;
  cleanupResult.replaceChildren();
  await scanCleanup();
});
const cleanupConfirm = button("Confirmar limpieza", async () => {
  if (cleanupBusy || !cleanupPreview) return;
  setCleanupBusy(true);
  cleanupConfirmation.hidden = true;
  try {
    const result = await request<CleanupResult>("/system/generated-cleanup", "POST", { confirm: true, token: cleanupPreview.token });
    cleanupResult.replaceChildren(node("p", `Eliminados: ${result.deleted} archivos · tamaño eliminado: ${formatBytes(result.bytes)}. Omitidos por cambios o uso: ${result.skipped}. Fallos: ${result.failures.length}.`),
      ...result.failures.map(item => node("p", `Archivo ${item.item} (${item.kind === "audio" ? "audio temporal" : "caché"}): ${item.error}`)));
    cleanupPreview = null;
    await scanCleanup();
  } catch (error) {
    cleanupPreview = null;
    cleanupStatus.textContent = error instanceof Error ? error.message : "No se pudo completar la limpieza.";
  } finally { setCleanupBusy(false); }
});
const cleanupCancel = button("Cancelar limpieza", () => { cleanupPreview = null; cleanupConfirmation.hidden = true; cleanupStatus.textContent = "Limpieza cancelada; no se eliminó ningún archivo."; });
function setCleanupBusy(value: boolean): void {
  cleanupBusy = value;
  cleanupScan.disabled = value;
  cleanupConfirm.disabled = value;
  cleanupCancel.disabled = value;
  cleanupCard.setAttribute("aria-busy", String(value));
}
async function scanCleanup(): Promise<void> {
  setCleanupBusy(true);
  cleanupConfirmation.hidden = true;
  cleanupStatus.textContent = "Analizando caché y audio temporal…";
  try {
    cleanupPreview = await request<CleanupPreview>("/system/generated-cleanup");
    cleanupStatus.textContent = `${cleanupPreview.count} archivos · ${formatBytes(cleanupPreview.bytes)} recuperables.${cleanupPreview.limited ? " Análisis parcial; vuelve a analizar después para revisar más archivos." : ""}${cleanupPreview.scan_failures ? ` No se pudieron revisar ${cleanupPreview.scan_failures} ubicaciones.` : ""}`;
    cleanupConfirmation.hidden = cleanupPreview.count === 0;
  } catch (error) {
    cleanupPreview = null;
    cleanupStatus.textContent = error instanceof Error ? error.message : "No se pudieron analizar los archivos.";
  } finally { setCleanupBusy(false); }
}
cleanupConfirmation.append(node("p", "¿Eliminar los archivos recuperables de este análisis? Esta acción no se puede deshacer."), cleanupConfirm, cleanupCancel);
cleanupCard.append(node("h3", "Caché y audio temporal"), node("p", "Solo caché Python y audio generado de más de 24 horas. Se conservan archivos activos, medios, modelos, historial, ajustes, respaldos y descargas."), cleanupScan, cleanupStatus, cleanupConfirmation, cleanupResult);

let refreshing = false;
async function refresh(): Promise<void> {
  if (refreshing) return;
  refreshing = true;
  refreshButton.disabled = true;
  try {
    const snapshot = await request<ControlSnapshot>("/system/control-center");
    renderReadiness(snapshot.readiness);
    renderComponents(snapshot.components);
    renderOperations(snapshot.operations);
    renderLan(snapshot.lan);
    renderContinuity(snapshot.backups, snapshot.update);
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
  sectionTitle("03 · ESPACIO", "Componentes locales", "Instala solo lo que uses y recupera espacio sin tocar tu historial."), components, cleanupCard,
  sectionTitle("04 · CONTINUIDAD", "Respaldos y actualizaciones", "Estas opciones permanecen bajo tu control."), continuity,
  sectionTitle("05 · ACTIVIDAD", "Notificaciones recientes", "Mensajes operativos de esta sesión del panel."),
  button("Vaciar notificaciones", () => { noticeHistory = []; notices.replaceChildren(); }), notices);
pane.hidden = true;
const mount = (): void => {
  if (window.Shell?.registerView) window.Shell.registerView("control-center", pane);
  else document.querySelector(".config-content")?.append(pane);
};
mount();

new MutationObserver(records => {
  for (const record of records) {
    const target = record.target.nodeType === Node.TEXT_NODE ? record.target.parentElement : record.target as HTMLElement;
    if (target?.getAttribute?.("role") === "status" && !pane.contains(target)) notify(target.textContent || "");
  }
}).observe(document.body, { childList: true, characterData: true, subtree: true });

let loaded = false;
window.addEventListener("tikreader:navigation-change", event => {
  const detail = (event as CustomEvent<{ key?: string }>).detail;
  if (detail?.key !== "control-center") return;
  loaded = true;
  void refresh();
});
window.setInterval(() => { if (loaded && !pane.hidden && !document.hidden) void refresh(); }, 30000);
