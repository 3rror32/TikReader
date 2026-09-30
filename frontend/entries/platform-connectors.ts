export {};

type Platform = "youtube" | "twitch" | "kick";
type CredentialRow = { platform: Platform; configured: boolean; nickname?: string; webhook_path?: string };
type CredentialSnapshot = { platforms: CredentialRow[]; storage: "windows-user" | "memory" };
type PlatformState = { platform: Platform; state: "disconnected" | "connecting" | "connected" | "error"; channel: string; error?: { title?: string } };
type PlatformSnapshot = { platforms: PlatformState[] };

declare global {
  interface Window {
    Shell?: { show: (section: string) => void; registerView?: (section: string, pane: HTMLElement) => HTMLElement | null };
    I18n?: { locale?: string; confirm?: (message: string) => boolean };
  }
  const socket: { connected: boolean; emit(event: string, data?: unknown): void; on(event: string, handler: (data: any) => void): void };
  function showLiveBadge(active: boolean): void;
  function setStatus(message: string, tone?: string): void;
  function hideError(): void;
  function showError(error: unknown): void;
}

const root = document.getElementById("platform-connectors");
if (root && typeof socket !== "undefined") {
  const platformRoot = root;
  const names: Record<Platform, string> = { youtube: "YouTube", twitch: "Twitch", kick: "Kick" };
  const configured: Record<Platform, boolean> = { youtube: false, twitch: false, kick: false };
  let lastSnapshot: PlatformSnapshot | null = null;
  const byId = <T extends HTMLElement>(id: string): T | null => document.getElementById(id) as T | null;

  const connectionFields = (platform: Platform): Record<string, string> => {
    if (platform === "youtube") return { video: byId<HTMLInputElement>("youtube-video")?.value.trim() || "" };
    return { channel: byId<HTMLInputElement>(`${platform}-channel`)?.value.trim() || "" };
  };

  async function credentialRequest(method = "GET", payload?: unknown): Promise<CredentialSnapshot> {
    const response = await fetch("/system/platform-credentials", {
      method, headers: { "Content-Type": "application/json" },
      body: payload === undefined ? undefined : JSON.stringify(payload)
    });
    const data = await response.json() as CredentialSnapshot & { error?: string };
    if (!response.ok) throw new Error(data.error || "No se pudo guardar la configuración.");
    return data;
  }

  function formStatus(platform: Platform, message: string, error = false): void {
    const output = byId(`${platform}-credentials-status`);
    if (!output) return;
    output.textContent = message;
    output.classList.toggle("is-error", error);
  }

  function renderCredentials(snapshot: CredentialSnapshot): void {
    for (const platform of Object.keys(configured) as Platform[]) {
      const item = snapshot.platforms.find(row => row.platform === platform);
      configured[platform] = Boolean(item?.configured);
      const state = document.querySelector<HTMLElement>(`[data-platform-config-state="${platform}"]`);
      if (state) {
        state.textContent = item?.configured ? "Configurado" : "Falta configurar";
        state.classList.toggle("is-ready", Boolean(item?.configured));
      }
      const remove = document.querySelector<HTMLButtonElement>(`[data-platform-delete="${platform}"]`);
      if (remove) remove.hidden = !item?.configured;
      const settings = platformRoot.querySelector<HTMLButtonElement>(`[data-platform-settings="${platform}"]`);
      if (settings) settings.textContent = item?.configured ? "Cambiar configuración" : `Configurar ${names[platform]}`;
      if (platform === "twitch" && item?.nickname) {
        const nickname = byId<HTMLInputElement>("twitch-nickname");
        if (nickname) nickname.value = item.nickname;
      }
      if (platform === "kick") {
        const path = byId<HTMLElement>("kick-webhook-path");
        const copy = byId<HTMLButtonElement>("kick-copy-webhook");
        if (path) path.textContent = item?.webhook_path || "Guarda Kick para generar la ruta segura del webhook.";
        if (copy) copy.hidden = !item?.webhook_path;
      }
    }
    const storage = byId("platform-storage-note");
    if (storage) storage.textContent = snapshot.storage === "windows-user"
      ? "Windows cifra las claves para este usuario. No aparecen en el historial, los diagnósticos ni el navegador."
      : "En este entorno las claves duran únicamente mientras TikReader permanece abierto.";
    if (lastSnapshot) render(lastSnapshot);
  }

  function render(snapshot: PlatformSnapshot): void {
    lastSnapshot = snapshot;
    let active = 0;
    const connectedNames: string[] = [];
    for (const item of snapshot.platforms) {
      const card = platformRoot.querySelector<HTMLElement>(`[data-platform-card="${item.platform}"]`);
      if (!card) continue;
      const busy = item.state === "connecting" || item.state === "connected";
      card.classList.toggle("is-connected", item.state === "connected");
      card.classList.toggle("is-connecting", item.state === "connecting");
      const connect = card.querySelector<HTMLButtonElement>("[data-platform-connect]");
      const stop = card.querySelector<HTMLButtonElement>("[data-platform-stop]");
      if (connect) connect.disabled = busy || !configured[item.platform];
      if (stop) stop.hidden = !busy;
      const status = byId(`${item.platform}-platform-status`);
      if (!status) continue;
      if (item.state === "connected") { status.textContent = `Conectado · ${item.channel || "en vivo"}`; active += 1; connectedNames.push(names[item.platform]); }
      else if (item.state === "connecting") { status.textContent = "Conectando…"; active += 1; }
      else if (item.state === "error") status.textContent = item.error?.title || "Error de conexión";
      else status.textContent = configured[item.platform] ? "Listo para conectar" : "Falta configurar";
    }
    const tiktokActive = getComputedStyle(byId("btn-stop") as HTMLElement).display !== "none";
    if (active) {
      showLiveBadge(true);
      if (!tiktokActive && connectedNames.length) setStatus(`🟢 Conectado a ${connectedNames.join(" + ")}`, "ok");
    } else if (!tiktokActive) showLiveBadge(false);
    platformRoot.dataset.active = String(active);
  }

  function openSettings(platform: Platform): void {
    window.Shell?.show("platform-integrations");
    requestAnimationFrame(() => document.querySelector<HTMLInputElement>(`[data-platform-config-card="${platform}"] input`)?.focus());
  }

  for (const button of platformRoot.querySelectorAll<HTMLButtonElement>("[data-platform-settings]")) {
    button.addEventListener("click", () => openSettings(button.dataset.platformSettings as Platform));
  }
  for (const button of platformRoot.querySelectorAll<HTMLButtonElement>("[data-platform-connect]")) {
    button.addEventListener("click", () => {
      const platform = button.dataset.platformConnect as Platform;
      if (!configured[platform]) { setStatus(`Configura ${names[platform]} antes de conectarlo.`, "err"); openSettings(platform); return; }
      if (!socket.connected) { setStatus("Sin conexión con el servidor.", "err"); return; }
      hideError(); setStatus(`Conectando ${names[platform]}…`);
      socket.emit("start_platform", { platform, config: connectionFields(platform) });
    });
  }
  for (const button of platformRoot.querySelectorAll<HTMLButtonElement>("[data-platform-stop]")) {
    button.addEventListener("click", () => socket.emit("stop_platform", { platform: button.dataset.platformStop }));
  }

  const bindForm = (platform: Platform, read: () => Record<string, string>, clear: () => void): void => {
    byId<HTMLFormElement>(`${platform}-credentials-form`)?.addEventListener("submit", async event => {
      event.preventDefault(); const credentials = read();
      if (Object.values(credentials).some(value => !value)) return formStatus(platform, "Completa todos los campos y pega una credencial nueva.", true);
      formStatus(platform, "Protegiendo el acceso…");
      try {
        await credentialRequest("POST", { platform, credentials }); clear();
        formStatus(platform, `${names[platform]} quedó configurado para este equipo.`);
        renderCredentials(await credentialRequest());
      } catch (error) { formStatus(platform, error instanceof Error ? error.message : String(error), true); }
    });
  };
  bindForm("youtube", () => ({ api_key: byId<HTMLInputElement>("youtube-api-key")?.value.trim() || "" }), () => { const input = byId<HTMLInputElement>("youtube-api-key"); if (input) input.value = ""; });
  bindForm("twitch", () => ({ nickname: byId<HTMLInputElement>("twitch-nickname")?.value.trim() || "", token: byId<HTMLInputElement>("twitch-token")?.value.trim() || "" }), () => { const input = byId<HTMLInputElement>("twitch-token"); if (input) input.value = ""; });
  bindForm("kick", () => ({ client_id: byId<HTMLInputElement>("kick-client-id")?.value.trim() || "", client_secret: byId<HTMLInputElement>("kick-client-secret")?.value.trim() || "" }), () => { const secret = byId<HTMLInputElement>("kick-client-secret"); if (secret) secret.value = ""; });

  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-platform-delete]")) {
    button.addEventListener("click", async () => {
      const platform = button.dataset.platformDelete as Platform;
      const message = `¿Eliminar la credencial guardada de ${names[platform]}?`;
      const accepted = window.I18n?.confirm ? window.I18n.confirm(message) : window.confirm(message);
      if (!accepted) return;
      try { renderCredentials(await credentialRequest("DELETE", { platform })); formStatus(platform, "Credencial eliminada."); }
      catch (error) { formStatus(platform, error instanceof Error ? error.message : String(error), true); }
    });
  }
  byId("kick-copy-webhook")?.addEventListener("click", async () => {
    const path = byId("kick-webhook-path")?.textContent || "";
    await navigator.clipboard.writeText(path); formStatus("kick", "Ruta copiada. Añade tu dominio HTTPS público delante.");
  });
  byId("platform-back-live")?.addEventListener("click", () => window.Shell?.show("live"));
  socket.on("platform_status", render);
  socket.on("platform_error", error => { setStatus(`❌ ${error?.title || "No se pudo conectar la plataforma"}`, "err"); showError(error); });
  void credentialRequest().then(renderCredentials).catch(error => {
    for (const platform of Object.keys(configured) as Platform[]) formStatus(platform, error instanceof Error ? error.message : String(error), true);
  });
  socket.emit("platform_status_request");
}
