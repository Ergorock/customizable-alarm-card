/**
 * Customizable Alarm Card
 * Carte Lovelace de pilotage d'une alarme (alarm_control_panel) :
 * état en grand format, modes d'armement illustrés, infos (batteries, mode privé…),
 * aperçu caméra optionnel, pavé de code, et éditeur visuel complet.
 */

const CARD_VERSION = "1.0.0";

const STATE_INFO = {
  disarmed: { label: "Désarmée", icon: "mdi:shield-off-outline", color: [67, 160, 71] },
  armed_home: { label: "Armée · présence", icon: "mdi:shield-home", color: [30, 136, 229] },
  armed_away: { label: "Armée · absent", icon: "mdi:shield-lock", color: [240, 140, 30] },
  armed_night: { label: "Armée · nuit", icon: "mdi:shield-moon", color: [220, 75, 75] },
  armed_vacation: { label: "Armée · vacances", icon: "mdi:shield-airplane", color: [142, 36, 170] },
  armed_custom_bypass: { label: "Armée · personnalisé", icon: "mdi:security", color: [0, 137, 123] },
  arming: { label: "Armement en cours…", icon: "mdi:shield-sync", color: [235, 190, 40] },
  pending: { label: "Délai d'entrée…", icon: "mdi:shield-alert-outline", color: [235, 190, 40] },
  disarming: { label: "Désarmement…", icon: "mdi:shield-sync", color: [235, 190, 40] },
  triggered: { label: "Alarme déclenchée !", icon: "mdi:bell-ring", color: [230, 20, 20] },
  unavailable: { label: "Indisponible", icon: "mdi:shield-remove-outline", color: [117, 117, 140] },
  unknown: { label: "Inconnu", icon: "mdi:shield-outline", color: [117, 117, 140] },
};

const MODE_STATES = [
  "disarmed",
  "armed_home",
  "armed_away",
  "armed_night",
  "armed_vacation",
  "armed_custom_bypass",
];

const SERVICE_FOR_STATE = {
  disarmed: "alarm_disarm",
  armed_home: "alarm_arm_home",
  armed_away: "alarm_arm_away",
  armed_night: "alarm_arm_night",
  armed_vacation: "alarm_arm_vacation",
  armed_custom_bypass: "alarm_arm_custom_bypass",
};

const TRANSITION_STATES = ["arming", "pending", "disarming"];
const TOGGLE_DOMAINS = ["switch", "input_boolean", "light", "fan", "siren"];

const DEFAULTS = {
  name: "Alarme",
  columns: 3,
  tile_height: 150,
  glass: true,
  show_last_change: true,
  camera_refresh: 10,
};

const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** Accepte [r,g,b], "#rrggbb" ou "r,g,b" et renvoie [r,g,b]. */
function toRgb(value, fallback) {
  if (Array.isArray(value) && value.length === 3) return value.map(Number);
  if (typeof value === "string") {
    const hex = value.trim().match(/^#?([0-9a-f]{6})$/i);
    if (hex) {
      const n = parseInt(hex[1], 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    const parts = value.split(",").map((p) => Number(p.trim()));
    if (parts.length === 3 && parts.every((p) => !isNaN(p))) return parts;
  }
  return fallback;
}

const darken = (rgb, f = 0.72) => rgb.map((c) => Math.round(c * f));
const rgbVar = (rgb) => rgb.join(", ");

function batteryIcon(level) {
  if (isNaN(level)) return "mdi:battery-unknown";
  if (level >= 95) return "mdi:battery";
  if (level < 5) return "mdi:battery-outline";
  return `mdi:battery-${Math.max(10, Math.round(level / 10) * 10)}`;
}

function formatSince(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return `depuis ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `depuis hier ${time}`;
  return `depuis le ${d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} ${time}`;
}

const STYLES = `
  :host { display: block; }
  ha-card {
    position: relative;
    overflow: hidden;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    border-radius: var(--ha-card-border-radius, 18px);
  }
  ha-card.glass {
    background: rgba(255, 255, 255, 0.14);
    backdrop-filter: blur(18px) saturate(160%);
    -webkit-backdrop-filter: blur(18px) saturate(160%);
    border: 1px solid rgba(255, 255, 255, 0.3);
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.15);
  }

  /* ---------- Bandeau d'état ---------- */
  .hero {
    position: relative;
    overflow: hidden;
    border-radius: 16px;
    padding: 18px;
    color: #fff;
    cursor: pointer;
    background: linear-gradient(135deg, rgba(var(--accent), 0.92), rgba(var(--accent-dark), 0.92));
    box-shadow: 0 8px 24px rgba(var(--accent), 0.35);
    transition: background 1s ease, box-shadow 1s ease;
  }
  .triggered .hero { animation: flash 1s ease-in-out infinite; }
  .bg-icon {
    position: absolute;
    right: -18px;
    bottom: -28px;
    --mdc-icon-size: 150px;
    opacity: 0.12;
    pointer-events: none;
  }
  .hero-main { display: flex; align-items: center; gap: 16px; position: relative; }
  .shield {
    position: relative;
    flex: 0 0 auto;
    width: 64px;
    height: 64px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: rgba(255, 255, 255, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.35);
  }
  .shield ha-icon { --mdc-icon-size: 34px; }
  .armed .shield::after, .transition .shield::after, .triggered .shield::after {
    content: "";
    position: absolute;
    inset: -6px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.6);
    animation: pulse 2.4s ease-out infinite;
  }
  .transition .shield::after { animation-duration: 1.1s; }
  .triggered .shield::after { animation-duration: 0.7s; }
  .hero-text { min-width: 0; }
  .title { font-size: 13px; opacity: 0.85; text-transform: uppercase; letter-spacing: 0.08em; }
  .state { font-size: 24px; font-weight: 600; line-height: 1.2; margin-top: 2px; }
  .since { font-size: 12px; opacity: 0.8; margin-top: 4px; }

  .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; position: relative; }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px 6px 8px;
    border-radius: 999px;
    font-size: 13px;
    color: #fff;
    background: rgba(255, 255, 255, 0.18);
    border: 1px solid rgba(255, 255, 255, 0.28);
    cursor: pointer;
    font-family: inherit;
    transition: background 0.2s ease, transform 0.1s ease;
  }
  .chip:active { transform: scale(0.96); }
  .chip ha-icon { --mdc-icon-size: 18px; }
  .chip .chip-name { opacity: 0.85; }
  .chip .chip-value { font-weight: 600; }
  .chip.on { background: rgba(255, 255, 255, 0.92); color: rgb(var(--accent-dark)); }
  .chip.low ha-icon { color: #ffd2d2; }
  .chip.low { background: rgba(120, 0, 0, 0.35); }

  /* ---------- Caméra ---------- */
  .camera {
    position: relative;
    border-radius: 16px;
    overflow: hidden;
    aspect-ratio: 16 / 9;
    background: rgba(0, 0, 0, 0.35);
    cursor: pointer;
  }
  .camera img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .camera .cam-label {
    position: absolute;
    left: 10px;
    top: 10px;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 12px;
    color: #fff;
    background: rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(6px);
  }
  .live-dot { width: 8px; height: 8px; border-radius: 50%; background: #ff4d4d; animation: blink 1.6s infinite; }
  .camera.private img { filter: blur(12px) brightness(0.5); }
  .camera .private-msg {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    color: #fff;
    font-size: 14px;
    gap: 4px;
    text-align: center;
  }
  .camera .private-msg ha-icon { --mdc-icon-size: 36px; display: block; margin: 0 auto 6px; }

  /* ---------- Modes ---------- */
  .modes { display: grid; grid-template-columns: repeat(var(--cols), minmax(0, 1fr)); gap: 12px; }
  .mode {
    position: relative;
    overflow: hidden;
    height: var(--tile-h);
    border-radius: 16px;
    border: none;
    padding: 0;
    cursor: pointer;
    color: #fff;
    font-family: inherit;
    text-align: left;
    background: linear-gradient(160deg, rgba(var(--mc), 0.95), rgba(var(--mc-dark), 0.95));
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
    transition: transform 0.15s ease, box-shadow 0.3s ease;
    -webkit-tap-highlight-color: transparent;
  }
  .mode:active { transform: scale(0.97); }
  .mode .img {
    position: absolute;
    inset: 0;
    background-size: cover;
    background-position: center;
    transition: transform 0.6s ease, filter 0.4s ease;
    filter: brightness(0.6) saturate(0.9);
  }
  .mode.active .img { filter: brightness(0.75) saturate(1.1); transform: scale(1.05); }
  .mode .shade {
    position: absolute;
    inset: 0;
    background: linear-gradient(to top, rgba(var(--mc-dark), 0.95) 0%, rgba(var(--mc), 0.55) 45%, transparent 85%);
  }
  .mode:not(.has-img) .shade { background: radial-gradient(circle at 80% 10%, rgba(255, 255, 255, 0.18), transparent 60%); }
  .mode-icon {
    position: absolute;
    top: 12px;
    left: 12px;
    --mdc-icon-size: 22px;
    width: 40px;
    height: 40px;
    display: grid;
    place-items: center;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.2);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
  }
  .mode-text { position: absolute; left: 14px; right: 14px; bottom: 12px; }
  .mode-name { font-size: 16px; font-weight: 600; text-shadow: 0 1px 6px rgba(0, 0, 0, 0.5); }
  .mode-label { font-size: 12px; opacity: 0.8; margin-top: 2px; text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5); }
  .mode.active { box-shadow: 0 0 0 3px #fff, 0 8px 26px rgba(var(--mc), 0.65); }
  .mode.inactive-dim:not(.active) { opacity: 0.92; }
  .badge {
    position: absolute;
    top: 12px;
    right: 12px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px 4px 6px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    background: #fff;
    color: rgb(var(--mc-dark));
  }
  .badge ha-icon { --mdc-icon-size: 16px; }
  .spinner {
    position: absolute;
    top: 14px;
    right: 14px;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 3px solid rgba(255, 255, 255, 0.35);
    border-top-color: #fff;
    animation: spin 0.8s linear infinite;
  }
  .confirm {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    padding: 12px;
    text-align: center;
    font-size: 14px;
    font-weight: 600;
    background: rgba(var(--mc-dark), 0.82);
    backdrop-filter: blur(4px);
    animation: fade 0.2s ease;
  }
  .mode[disabled] { cursor: not-allowed; filter: grayscale(0.7); opacity: 0.6; }

  /* ---------- Pavé de code ---------- */
  .keypad-overlay {
    position: absolute;
    inset: 0;
    z-index: 5;
    display: grid;
    place-items: center;
    background: rgba(0, 0, 0, 0.55);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    animation: fade 0.2s ease;
  }
  .keypad { width: min(280px, 90%); color: #fff; text-align: center; }
  .keypad-title { font-size: 15px; font-weight: 600; margin-bottom: 10px; }
  .dots { display: flex; justify-content: center; gap: 10px; min-height: 16px; margin-bottom: 16px; }
  .dot { width: 12px; height: 12px; border-radius: 50%; background: #fff; }
  .keys { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .key {
    height: 52px;
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.25);
    background: rgba(255, 255, 255, 0.14);
    color: #fff;
    font-size: 20px;
    font-family: inherit;
    cursor: pointer;
  }
  .key:active { background: rgba(255, 255, 255, 0.3); }
  .key.ok { background: rgba(var(--accent), 0.9); }
  .key ha-icon { --mdc-icon-size: 22px; }

  .warning { padding: 12px; color: var(--error-color, #db4437); }

  @keyframes pulse { 0% { transform: scale(0.9); opacity: 1; } 100% { transform: scale(1.35); opacity: 0; } }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes blink { 50% { opacity: 0.25; } }
  @keyframes fade { from { opacity: 0; } to { opacity: 1; } }
  @keyframes flash { 50% { filter: brightness(1.35); } }

  ha-card { container-type: inline-size; }
  @container (max-width: 520px) {
    .modes { grid-template-columns: repeat(min(var(--cols), 2), minmax(0, 1fr)); }
    .state { font-size: 20px; }
  }
`;

class CustomizableAlarmCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement("customizable-alarm-card-editor");
  }

  static getStubConfig(hass) {
    const entity = Object.keys(hass?.states || {}).find((e) => e.startsWith("alarm_control_panel.")) || "";
    return {
      entity,
      name: "Alarme",
      modes: [
        { name: "Désactiver", label: "Désarmement", state: "disarmed", icon: "mdi:shield-off-outline" },
        { name: "Nuit", label: "Armement partiel", state: "armed_night", icon: "mdi:shield-moon" },
        { name: "Absent", label: "Armement total", state: "armed_away", icon: "mdi:shield-lock" },
      ],
      info: [],
    };
  }

  setConfig(config) {
    if (!config || !config.entity) {
      throw new Error("Veuillez choisir une entité d'alarme (alarm_control_panel).");
    }
    this._config = { ...DEFAULTS, ...config };
    if (!this.shadowRoot) {
      this.attachShadow({ mode: "open" });
      this.shadowRoot.addEventListener("click", (ev) => this._onClick(ev));
    }
    this._sig = null;
    this._render();
    if (this.isConnected) this._startCamera();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._pending && this._config) {
      const state = hass.states[this._config.entity]?.state;
      const target = this._config.modes?.[this._pending.index]?.state;
      if (state === target || state === "triggered") this._pending = null;
    }
    const sig = this._signature();
    if (sig !== this._sig) {
      this._sig = sig;
      this._render();
    }
  }

  connectedCallback() {
    this._startCamera();
  }

  disconnectedCallback() {
    clearInterval(this._camTimer);
    this._camTimer = null;
  }

  getCardSize() {
    const modes = (this._config?.modes || []).length;
    const rows = Math.ceil(modes / (this._config?.columns || 3));
    return 3 + rows * 3 + (this._config?.camera_entity ? 4 : 0);
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6 };
  }

  // ---------- Données ----------

  _relevantEntities() {
    const c = this._config;
    return [
      c.entity,
      c.history_entity,
      c.camera_entity,
      c.privacy_entity,
      ...(c.info || []).map((i) => i.entity),
      ...(c.modes || []).map((m) => m.entity),
    ].filter(Boolean);
  }

  _signature() {
    if (!this._hass || !this._config) return null;
    return JSON.stringify([
      this._relevantEntities().map((e) => {
        const s = this._hass.states[e];
        return s ? [s.state, s.last_changed, s.attributes] : null;
      }),
      this._pending,
      this._confirmIdx,
      this._keypad,
    ]);
  }

  _stateColor(state) {
    const fallback = (STATE_INFO[state] || STATE_INFO.unknown).color;
    return toRgb(this._config.state_colors?.[state], fallback);
  }

  _changedBy() {
    const st = this._hass.states[this._config.entity];
    if (st?.attributes.changed_by) return st.attributes.changed_by;
    const h = this._config.history_entity && this._hass.states[this._config.history_entity];
    return h?.attributes?.user || null;
  }

  // ---------- Rendu ----------

  _render() {
    if (!this.shadowRoot || !this._config) return;
    const c = this._config;
    const hass = this._hass;
    if (!hass) {
      this.shadowRoot.innerHTML = `<style>${STYLES}</style><ha-card class="${c.glass ? "glass" : ""}"></ha-card>`;
      return;
    }
    const st = hass.states[c.entity];
    if (!st) {
      this.shadowRoot.innerHTML = `<style>${STYLES}</style><ha-card><div class="warning">Entité introuvable : ${esc(c.entity)}</div></ha-card>`;
      return;
    }

    const state = st.state;
    const info = STATE_INFO[state] || STATE_INFO.unknown;
    const accent = this._stateColor(state);
    const classes = [
      c.glass ? "glass" : "",
      state.startsWith("armed") ? "armed" : "",
      TRANSITION_STATES.includes(state) ? "transition" : "",
      state === "triggered" ? "triggered" : "",
    ].join(" ");

    let since = "";
    if (c.show_last_change !== false) {
      const by = this._changedBy();
      since = formatSince(st.last_changed) + (by ? ` · par ${by}` : "");
    }

    const chips = (c.info || []).map((item, i) => this._renderChip(item, i)).join("");
    const modes = (c.modes || []).map((m, i) => this._renderMode(m, i, state)).join("");

    this.shadowRoot.innerHTML = `
      <style>${STYLES}</style>
      <ha-card class="${classes}" style="--accent: ${rgbVar(accent)}; --accent-dark: ${rgbVar(darken(accent))}; --cols: ${Number(c.columns) || 3}; --tile-h: ${Number(c.tile_height) || 150}px;">
        <div class="hero" data-action="more-info" data-entity="${esc(c.entity)}">
          <ha-icon class="bg-icon" icon="${info.icon}"></ha-icon>
          <div class="hero-main">
            <div class="shield"><ha-icon icon="${info.icon}"></ha-icon></div>
            <div class="hero-text">
              <div class="title">${esc(c.name || st.attributes.friendly_name)}</div>
              <div class="state">${esc(info.label)}</div>
              ${since ? `<div class="since">${esc(since)}</div>` : ""}
            </div>
          </div>
          ${chips ? `<div class="chips">${chips}</div>` : ""}
        </div>
        ${this._renderCamera()}
        ${modes ? `<div class="modes">${modes}</div>` : ""}
        ${this._keypad ? this._renderKeypad() : ""}
      </ha-card>
    `;
    this._updateCameraImage();
  }

  _renderChip(item, index) {
    const st = this._hass.states[item.entity];
    if (!st) {
      return `<button class="chip"><ha-icon icon="mdi:alert-circle-outline"></ha-icon><span class="chip-value">${esc(item.entity)} ?</span></button>`;
    }
    const domain = item.entity.split(".")[0];
    const name = item.name ?? st.attributes.friendly_name ?? item.entity;
    let icon = item.icon || st.attributes.icon;
    let value;
    let cls = "";
    let action = "more-info";

    if (TOGGLE_DOMAINS.includes(domain)) {
      const on = st.state === "on";
      icon = icon || (on ? "mdi:toggle-switch" : "mdi:toggle-switch-off-outline");
      value = on ? "Activé" : "Désactivé";
      cls = on ? "on" : "";
      action = "toggle";
    } else if (st.attributes.device_class === "battery" && !isNaN(parseFloat(st.state))) {
      const level = parseFloat(st.state);
      icon = item.icon || batteryIcon(level);
      value = `${Math.round(level)} %`;
      cls = level < (item.low_threshold ?? 20) ? "low" : "";
    } else {
      icon = icon || "mdi:information-outline";
      value = this._hass.formatEntityState
        ? this._hass.formatEntityState(st)
        : `${st.state}${st.attributes.unit_of_measurement ? " " + st.attributes.unit_of_measurement : ""}`;
    }

    return `
      <button class="chip ${cls}" data-action="${action}" data-entity="${esc(item.entity)}" data-index="${index}">
        <ha-icon icon="${esc(icon)}"></ha-icon>
        ${name ? `<span class="chip-name">${esc(name)}</span>` : ""}
        <span class="chip-value">${esc(value)}</span>
      </button>`;
  }

  _renderMode(mode, index, alarmState) {
    const color = toRgb(mode.color, this._stateColor(mode.state));
    const active = mode.state && mode.state === alarmState;
    const pending = this._pending?.index === index && !active;
    const confirming = this._confirmIdx === index;
    const icon = mode.icon || (STATE_INFO[mode.state] || STATE_INFO.unknown).icon;
    const disabled = ["unavailable", "unknown"].includes(alarmState) && !mode.entity;
    const img = mode.image ? String(mode.image).replace(/['"()\\]/g, (ch) => "%" + ch.charCodeAt(0).toString(16).toUpperCase()) : "";

    return `
      <button class="mode ${active ? "active" : ""} ${img ? "has-img" : ""}" data-action="mode" data-index="${index}"
        style="--mc: ${rgbVar(color)}; --mc-dark: ${rgbVar(darken(color, 0.6))};" ${disabled ? "disabled" : ""}>
        ${img ? `<div class="img" style="background-image: url('${img}')"></div>` : ""}
        <div class="shade"></div>
        <div class="mode-icon"><ha-icon icon="${esc(icon)}"></ha-icon></div>
        ${active ? `<div class="badge"><ha-icon icon="mdi:check-circle"></ha-icon>Actif</div>` : ""}
        ${pending ? `<div class="spinner"></div>` : ""}
        <div class="mode-text">
          <div class="mode-name">${esc(mode.name || (STATE_INFO[mode.state] || {}).label || "Mode")}</div>
          ${mode.label ? `<div class="mode-label">${esc(mode.label)}</div>` : ""}
        </div>
        ${confirming ? `<div class="confirm">Touchez à nouveau pour confirmer</div>` : ""}
      </button>`;
  }

  _renderCamera() {
    const c = this._config;
    if (!c.camera_entity) return "";
    const cam = this._hass.states[c.camera_entity];
    if (!cam) return "";
    const priv = c.privacy_entity && this._hass.states[c.privacy_entity]?.state === "on";
    return `
      <div class="camera ${priv ? "private" : ""}" data-action="more-info" data-entity="${esc(c.camera_entity)}">
        <img alt="" onerror="this.style.visibility='hidden'" onload="this.style.visibility='visible'" />
        <div class="cam-label">${priv ? "" : `<span class="live-dot"></span>`}${esc(c.camera_name || cam.attributes.friendly_name)}</div>
        ${priv ? `<div class="private-msg"><div><ha-icon icon="mdi:eye-off-outline"></ha-icon>Mode privé activé</div></div>` : ""}
      </div>`;
  }

  _renderKeypad() {
    const len = (this._code || "").length;
    const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "ok"]
      .map((k) => {
        if (k === "clear") return `<button class="key" data-action="key" data-key="clear"><ha-icon icon="mdi:backspace-outline"></ha-icon></button>`;
        if (k === "ok") return `<button class="key ok" data-action="key" data-key="ok"><ha-icon icon="mdi:check"></ha-icon></button>`;
        return `<button class="key" data-action="key" data-key="${k}">${k}</button>`;
      })
      .join("");
    const mode = this._config.modes[this._keypad.index];
    return `
      <div class="keypad-overlay" data-action="keypad-bg">
        <div class="keypad">
          <div class="keypad-title">Code pour « ${esc(mode?.name || "")} »</div>
          <div class="dots">${'<span class="dot"></span>'.repeat(len)}</div>
          <div class="keys">${keys}</div>
          <button class="key" style="width:100%;margin-top:10px;font-size:14px" data-action="key" data-key="cancel">Annuler</button>
        </div>
      </div>`;
  }

  // ---------- Caméra ----------

  _startCamera() {
    clearInterval(this._camTimer);
    const secs = Number(this._config?.camera_refresh) || 10;
    this._camTimer = setInterval(() => this._updateCameraImage(), secs * 1000);
  }

  _updateCameraImage() {
    const img = this.shadowRoot?.querySelector(".camera img");
    const cam = this._config?.camera_entity && this._hass?.states[this._config.camera_entity];
    if (!img || !cam?.attributes.entity_picture) return;
    const url = cam.attributes.entity_picture;
    img.src = `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`;
  }

  // ---------- Interactions ----------

  _onClick(ev) {
    const el = ev.composedPath().find((n) => n.dataset && n.dataset.action);
    if (!el) return;
    ev.stopPropagation();
    const { action, entity, index, key } = el.dataset;
    switch (action) {
      case "more-info":
        this._fire("hass-more-info", { entityId: entity });
        break;
      case "toggle":
        this._haptic("light");
        this._hass.callService("homeassistant", "toggle", { entity_id: entity });
        break;
      case "mode":
        this._onMode(Number(index));
        break;
      case "key":
        this._onKey(key);
        break;
      case "keypad-bg":
        if (ev.target === el) this._closeKeypad();
        break;
    }
  }

  _onMode(index) {
    const mode = this._config.modes[index];
    if (!mode) return;
    if (mode.confirm && this._confirmIdx !== index) {
      this._confirmIdx = index;
      clearTimeout(this._confirmTimer);
      this._confirmTimer = setTimeout(() => {
        this._confirmIdx = null;
        this._rerender();
      }, 3000);
      this._haptic("warning");
      this._rerender();
      return;
    }
    clearTimeout(this._confirmTimer);
    this._confirmIdx = null;

    if (!mode.entity && this._needsCode(mode)) {
      this._keypad = { index };
      this._code = "";
      this._rerender();
      return;
    }
    this._runMode(index);
  }

  _needsCode(mode) {
    const st = this._hass.states[this._config.entity];
    if (!st?.attributes.code_format) return false;
    return mode.state === "disarmed" || st.attributes.code_arm_required !== false;
  }

  async _runMode(index, code) {
    const mode = this._config.modes[index];
    this._haptic("success");
    this._pending = { index };
    clearTimeout(this._pendingTimer);
    this._pendingTimer = setTimeout(() => {
      this._pending = null;
      this._rerender();
    }, 30000);
    this._rerender();

    try {
      if (mode.entity) {
        const domain = mode.entity.split(".")[0];
        const call = {
          scene: ["scene", "turn_on"],
          script: ["script", "turn_on"],
          button: ["button", "press"],
          input_button: ["input_button", "press"],
          automation: ["automation", "trigger"],
        }[domain] || ["homeassistant", "turn_on"];
        await this._hass.callService(call[0], call[1], { entity_id: mode.entity });
      } else {
        const service = SERVICE_FOR_STATE[mode.state];
        if (!service) throw new Error(`Aucune action pour l'état ${mode.state}`);
        const data = { entity_id: this._config.entity };
        if (code) data.code = code;
        await this._hass.callService("alarm_control_panel", service, data);
      }
    } catch (err) {
      this._pending = null;
      this._rerender();
      this._fire("hass-notification", { message: `Alarme : ${err.message || err}` });
    }
  }

  _onKey(key) {
    if (!this._keypad) return;
    if (key === "cancel") return this._closeKeypad();
    if (key === "clear") this._code = (this._code || "").slice(0, -1);
    else if (key === "ok") {
      const { index } = this._keypad;
      const code = this._code;
      this._closeKeypad();
      this._runMode(index, code);
      return;
    } else if ((this._code || "").length < 12) this._code = (this._code || "") + key;
    this._haptic("light");
    this._rerender();
  }

  _closeKeypad() {
    this._keypad = null;
    this._code = "";
    this._rerender();
  }

  _rerender() {
    this._sig = this._signature();
    this._render();
  }

  _fire(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }

  _haptic(kind) {
    this._fire("haptic", kind);
  }
}

// =====================================================================
// Éditeur visuel
// =====================================================================

const LABELS = {
  entity: "Entité alarme",
  name: "Titre",
  history_entity: "Entité historique (optionnelle, pour « par … »)",
  camera_entity: "Caméra (optionnelle)",
  camera_name: "Nom affiché de la caméra",
  privacy_entity: "Interrupteur mode privé (floute la caméra)",
  camera_refresh: "Rafraîchissement caméra",
  columns: "Colonnes de modes",
  tile_height: "Hauteur des tuiles",
  glass: "Effet verre dépoli",
  show_last_change: "Afficher « depuis … par … »",
  state_colors: "Couleurs par état",
  label: "Sous-titre",
  state: "État d'alarme correspondant",
  icon: "Icône",
  image: "Image de fond (ex. /local/images/open.png)",
  color: "Couleur",
  confirm: "Demander une confirmation",
  low_threshold: "Seuil batterie faible (%)",
};

const STATE_OPTIONS = MODE_STATES.map((s) => ({ value: s, label: STATE_INFO[s].label }));

const GENERAL_SCHEMA = [
  { name: "entity", required: true, selector: { entity: { domain: "alarm_control_panel" } } },
  { name: "name", selector: { text: {} } },
  { name: "history_entity", selector: { entity: { domain: ["text", "sensor"] } } },
];

const CAMERA_SCHEMA = [
  { name: "camera_entity", selector: { entity: { domain: "camera" } } },
  {
    type: "grid",
    name: "",
    schema: [
      { name: "camera_name", selector: { text: {} } },
      { name: "camera_refresh", selector: { number: { min: 2, max: 120, mode: "box", unit_of_measurement: "s" } } },
    ],
  },
  { name: "privacy_entity", selector: { entity: { domain: ["switch", "input_boolean"] } } },
];

const LOOK_SCHEMA = [
  {
    type: "grid",
    name: "",
    schema: [
      { name: "columns", selector: { number: { min: 1, max: 6, mode: "box" } } },
      { name: "tile_height", selector: { number: { min: 70, max: 320, step: 10, mode: "slider", unit_of_measurement: "px" } } },
    ],
  },
  {
    type: "grid",
    name: "",
    schema: [
      { name: "glass", selector: { boolean: {} } },
      { name: "show_last_change", selector: { boolean: {} } },
    ],
  },
  {
    type: "expandable",
    name: "state_colors",
    title: "Couleurs par état",
    icon: "mdi:palette",
    schema: Object.keys(STATE_INFO)
      .filter((s) => s !== "unknown")
      .map((s) => ({ name: s, selector: { color_rgb: {} } })),
  },
];

const MODE_SCHEMA = [
  {
    type: "grid",
    name: "",
    schema: [
      { name: "name", selector: { text: {} } },
      { name: "label", selector: { text: {} } },
    ],
  },
  { name: "state", selector: { select: { mode: "dropdown", options: STATE_OPTIONS } } },
  {
    name: "entity",
    selector: { entity: { domain: ["scene", "script", "button", "input_button", "automation", "switch", "input_boolean"] } },
  },
  {
    type: "grid",
    name: "",
    schema: [
      { name: "icon", selector: { icon: {} } },
      { name: "color", selector: { color_rgb: {} } },
    ],
  },
  { name: "image", selector: { text: {} } },
  { name: "confirm", selector: { boolean: {} } },
];

const INFO_SCHEMA = [
  { name: "entity", required: true, selector: { entity: {} } },
  {
    type: "grid",
    name: "",
    schema: [
      { name: "name", selector: { text: {} } },
      { name: "icon", selector: { icon: {} } },
    ],
  },
  { name: "low_threshold", selector: { number: { min: 1, max: 100, mode: "box", unit_of_measurement: "%" } } },
];

const MODE_HELPERS = {
  entity:
    "Scène, script ou bouton à lancer. Laisser vide pour piloter directement l'alarme selon l'état choisi.",
  state: "La tuile s'affiche « Active » quand l'alarme est dans cet état.",
};

const EDITOR_STYLES = `
  :host { display: block; }
  .section { margin-bottom: 20px; }
  .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 15px;
    font-weight: 600;
    margin: 0 0 10px;
    color: var(--primary-text-color);
  }
  .section-title ha-icon { color: var(--primary-color); --mdc-icon-size: 20px; }
  .hint { font-size: 12px; color: var(--secondary-text-color); margin: -4px 0 10px; }
  .item {
    border: 1px solid var(--divider-color);
    border-radius: 12px;
    margin-bottom: 8px;
    overflow: hidden;
    background: var(--card-background-color);
  }
  .item-head {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 8px 8px 12px;
    cursor: pointer;
    user-select: none;
  }
  .swatch {
    width: 32px;
    height: 32px;
    border-radius: 9px;
    display: grid;
    place-items: center;
    color: #fff;
    flex: 0 0 auto;
    background-size: cover;
    background-position: center;
  }
  .swatch ha-icon { --mdc-icon-size: 18px; filter: drop-shadow(0 1px 2px rgba(0,0,0,.5)); }
  .item-title { flex: 1; min-width: 0; }
  .item-title .t { font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .item-title .s { font-size: 12px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .icon-btn {
    border: none;
    background: none;
    color: var(--secondary-text-color);
    width: 34px;
    height: 34px;
    border-radius: 50%;
    cursor: pointer;
    display: grid;
    place-items: center;
  }
  .icon-btn:hover { background: var(--secondary-background-color); color: var(--primary-text-color); }
  .icon-btn[disabled] { opacity: 0.3; pointer-events: none; }
  .icon-btn.del:hover { color: var(--error-color, #db4437); }
  .item-body { padding: 4px 12px 12px; border-top: 1px solid var(--divider-color); }
  .add {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1px dashed var(--primary-color);
    color: var(--primary-color);
    background: none;
    border-radius: 10px;
    padding: 8px 14px;
    cursor: pointer;
    font-family: inherit;
    font-size: 14px;
  }
  .add:hover { background: rgba(var(--rgb-primary-color, 3, 169, 244), 0.08); }
`;

class CustomizableAlarmCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._open = { modes: new Set(), info: new Set() };
  }

  setConfig(config) {
    const json = JSON.stringify(config);
    this._config = JSON.parse(json);
    if (this._rendered && json === this._lastSent) {
      this._refreshForms();
      return;
    }
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this.shadowRoot.querySelectorAll("ha-form").forEach((f) => (f.hass = hass));
  }

  connectedCallback() {
    this._ensureHaForm();
  }

  async _ensureHaForm() {
    if (customElements.get("ha-form")) return;
    try {
      const helpers = await window.loadCardHelpers();
      const card = await helpers.createCardElement({ type: "entities", entities: [] });
      await card.constructor.getConfigElement();
    } catch (e) {
      /* ha-form sera disponible plus tard */
    }
    await customElements.whenDefined("ha-form");
    this._render();
  }

  _emit(config) {
    this._config = config;
    this._lastSent = JSON.stringify(config);
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }

  _computeLabel = (schema) => LABELS[schema.name] ?? STATE_INFO[schema.name]?.label ?? schema.name;

  _clean(obj) {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v === "" || v === undefined || v === null) continue;
      if (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0) continue;
      out[k] = v;
    }
    return out;
  }

  /** Les couleurs peuvent être saisies en hex dans le YAML : on les convertit pour le sélecteur. */
  _formData(obj, colorKeys) {
    const data = { ...obj };
    for (const k of colorKeys) if (data[k] !== undefined) data[k] = toRgb(data[k], undefined);
    return data;
  }

  _lookData() {
    const c = this._config;
    const colors = {};
    for (const [k, v] of Object.entries(c.state_colors || {})) colors[k] = toRgb(v, undefined);
    return {
      columns: c.columns ?? DEFAULTS.columns,
      tile_height: c.tile_height ?? DEFAULTS.tile_height,
      glass: c.glass ?? DEFAULTS.glass,
      show_last_change: c.show_last_change ?? DEFAULTS.show_last_change,
      state_colors: colors,
    };
  }

  _makeForm(schema, data, onChange, helpers) {
    const form = document.createElement("ha-form");
    form.hass = this._hass;
    form.schema = schema;
    form.data = data;
    form.computeLabel = this._computeLabel;
    if (helpers) form.computeHelper = (s) => helpers[s.name];
    form.addEventListener("value-changed", (ev) => {
      ev.stopPropagation();
      onChange(ev.detail.value);
    });
    return form;
  }

  _refreshForms() {
    const c = this._config;
    const root = this.shadowRoot;
    const set = (id, data) => {
      const f = root.getElementById(id);
      if (f) f.data = data;
    };
    set("general", c);
    set("camera", c);
    set("look", this._lookData());
    (c.modes || []).forEach((m, i) => {
      set(`mode-${i}`, this._formData(m, ["color"]));
      this._updateModeHead(i);
    });
    (c.info || []).forEach((it, i) => {
      set(`info-${i}`, it);
      this._updateInfoHead(i);
    });
  }

  _render() {
    if (!this._config) return;
    this._rendered = true;
    const c = this._config;
    const root = this.shadowRoot;
    root.innerHTML = `
      <style>${EDITOR_STYLES}</style>
      <div class="section">
        <div class="section-title"><ha-icon icon="mdi:shield-home"></ha-icon>Général</div>
        <div id="general-slot"></div>
      </div>
      <div class="section">
        <div class="section-title"><ha-icon icon="mdi:view-grid"></ha-icon>Modes d'armement</div>
        <div class="hint">Chaque mode est une tuile cliquable. Touchez une ligne pour la déplier.</div>
        <div id="modes"></div>
        <button class="add" data-add="modes"><ha-icon icon="mdi:plus"></ha-icon>Ajouter un mode</button>
      </div>
      <div class="section">
        <div class="section-title"><ha-icon icon="mdi:information-outline"></ha-icon>Informations (pastilles)</div>
        <div class="hint">Batteries, interrupteurs (mode privé…), capteurs. Les interrupteurs se basculent d'un tap.</div>
        <div id="info"></div>
        <button class="add" data-add="info"><ha-icon icon="mdi:plus"></ha-icon>Ajouter une information</button>
      </div>
      <div class="section">
        <div class="section-title"><ha-icon icon="mdi:cctv"></ha-icon>Caméra</div>
        <div id="camera-slot"></div>
      </div>
      <div class="section">
        <div class="section-title"><ha-icon icon="mdi:palette-outline"></ha-icon>Apparence</div>
        <div id="look-slot"></div>
      </div>
    `;

    const general = this._makeForm(GENERAL_SCHEMA, c, (v) => this._emit(this._clean({ ...this._config, ...v })));
    general.id = "general";
    root.getElementById("general-slot").appendChild(general);

    const camera = this._makeForm(CAMERA_SCHEMA, c, (v) => this._emit(this._clean({ ...this._config, ...v })));
    camera.id = "camera";
    root.getElementById("camera-slot").appendChild(camera);

    const look = this._makeForm(LOOK_SCHEMA, this._lookData(), (v) => {
      const next = { ...this._config, ...v, state_colors: this._clean(v.state_colors || {}) };
      this._emit(this._clean(next));
    });
    look.id = "look";
    root.getElementById("look-slot").appendChild(look);

    this._renderList("modes");
    this._renderList("info");

    root.querySelectorAll("[data-add]").forEach((btn) =>
      btn.addEventListener("click", () => this._addItem(btn.dataset.add))
    );
  }

  _renderList(kind) {
    const container = this.shadowRoot.getElementById(kind);
    container.innerHTML = "";
    const items = this._config[kind] || [];
    items.forEach((item, i) => {
      const wrap = document.createElement("div");
      wrap.className = "item";
      const open = this._open[kind].has(i);
      wrap.innerHTML = `
        <div class="item-head">
          <div class="swatch"><ha-icon></ha-icon></div>
          <div class="item-title"><div class="t"></div><div class="s"></div></div>
          <button class="icon-btn" data-move="-1" title="Monter" ${i === 0 ? "disabled" : ""}><ha-icon icon="mdi:arrow-up"></ha-icon></button>
          <button class="icon-btn" data-move="1" title="Descendre" ${i === items.length - 1 ? "disabled" : ""}><ha-icon icon="mdi:arrow-down"></ha-icon></button>
          <button class="icon-btn del" data-del title="Supprimer"><ha-icon icon="mdi:delete-outline"></ha-icon></button>
          <ha-icon icon="${open ? "mdi:chevron-up" : "mdi:chevron-down"}" style="color: var(--secondary-text-color)"></ha-icon>
        </div>
      `;
      wrap.querySelector(".item-head").addEventListener("click", (ev) => {
        const btn = ev.composedPath().find((n) => n.classList && n.classList.contains("icon-btn"));
        if (btn) {
          ev.stopPropagation();
          if (btn.dataset.move) this._moveItem(kind, i, Number(btn.dataset.move));
          else if (btn.hasAttribute("data-del")) this._deleteItem(kind, i);
          return;
        }
        if (open) this._open[kind].delete(i);
        else this._open[kind].add(i);
        this._renderList(kind);
      });

      if (open) {
        const body = document.createElement("div");
        body.className = "item-body";
        const isMode = kind === "modes";
        const form = this._makeForm(
          isMode ? MODE_SCHEMA : INFO_SCHEMA,
          isMode ? this._formData(item, ["color"]) : item,
          (v) => {
            const list = [...(this._config[kind] || [])];
            list[i] = this._clean(v);
            this._emit({ ...this._config, [kind]: list });
            isMode ? this._updateModeHead(i) : this._updateInfoHead(i);
          },
          isMode ? MODE_HELPERS : null
        );
        form.id = `${isMode ? "mode" : "info"}-${i}`;
        body.appendChild(form);
        wrap.appendChild(body);
      }
      wrap.dataset.index = i;
      container.appendChild(wrap);
      kind === "modes" ? this._updateModeHead(i) : this._updateInfoHead(i);
    });
  }

  _itemEl(kind, i) {
    return this.shadowRoot.querySelector(`#${kind} .item[data-index="${i}"]`);
  }

  _updateModeHead(i) {
    const el = this._itemEl("modes", i);
    const m = (this._config.modes || [])[i];
    if (!el || !m) return;
    const info = STATE_INFO[m.state] || STATE_INFO.unknown;
    const color = toRgb(m.color, toRgb(this._config.state_colors?.[m.state], info.color));
    const swatch = el.querySelector(".swatch");
    swatch.style.backgroundColor = `rgb(${rgbVar(color)})`;
    swatch.style.backgroundImage = m.image
      ? `linear-gradient(rgba(${rgbVar(color)},.55), rgba(${rgbVar(color)},.55)), url("${m.image}")`
      : "";
    swatch.querySelector("ha-icon").setAttribute("icon", m.icon || info.icon);
    el.querySelector(".t").textContent = m.name || info.label;
    const target = m.entity ? (this._hass?.states[m.entity]?.attributes.friendly_name || m.entity) : "action directe sur l'alarme";
    el.querySelector(".s").textContent = `${m.state ? info.label : "—"} · ${target}`;
  }

  _updateInfoHead(i) {
    const el = this._itemEl("info", i);
    const it = (this._config.info || [])[i];
    if (!el || !it) return;
    const st = it.entity && this._hass?.states[it.entity];
    const swatch = el.querySelector(".swatch");
    swatch.style.backgroundColor = "var(--primary-color)";
    swatch.querySelector("ha-icon").setAttribute("icon", it.icon || st?.attributes.icon || "mdi:information-outline");
    el.querySelector(".t").textContent = it.name || st?.attributes.friendly_name || it.entity || "Nouvelle information";
    el.querySelector(".s").textContent = it.entity || "Choisissez une entité";
  }

  _addItem(kind) {
    const list = [...(this._config[kind] || [])];
    if (kind === "modes") {
      const used = new Set(list.map((m) => m.state));
      const state = MODE_STATES.find((s) => !used.has(s)) || "armed_away";
      list.push({ name: STATE_INFO[state].label, state, icon: STATE_INFO[state].icon });
    } else {
      list.push({ entity: "" });
    }
    this._open[kind].add(list.length - 1);
    this._emit({ ...this._config, [kind]: list });
    this._renderList(kind);
  }

  _deleteItem(kind, i) {
    const list = [...(this._config[kind] || [])];
    list.splice(i, 1);
    this._open[kind] = new Set([...this._open[kind]].filter((x) => x !== i).map((x) => (x > i ? x - 1 : x)));
    this._emit({ ...this._config, [kind]: list });
    this._renderList(kind);
  }

  _moveItem(kind, i, dir) {
    const list = [...(this._config[kind] || [])];
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    const open = this._open[kind];
    const wasI = open.has(i);
    const wasJ = open.has(j);
    open.delete(i);
    open.delete(j);
    if (wasI) open.add(j);
    if (wasJ) open.add(i);
    this._emit({ ...this._config, [kind]: list });
    this._renderList(kind);
  }
}

if (!customElements.get("customizable-alarm-card")) customElements.define("customizable-alarm-card", CustomizableAlarmCard);
if (!customElements.get("customizable-alarm-card-editor")) customElements.define("customizable-alarm-card-editor", CustomizableAlarmCardEditor);

window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c.type === "customizable-alarm-card")) {
  window.customCards.push({
    type: "customizable-alarm-card",
    name: "Customizable Alarm Card",
    description: "Pilotage de l'alarme : état, modes illustrés, batteries, mode privé et caméra.",
    preview: true,
    documentationURL: "https://github.com/Ergorock/customizable-alarm-card",
  });
}

console.info(`%c CUSTOMIZABLE-ALARM-CARD %c v${CARD_VERSION} `, "color:#fff;background:#e05050;border-radius:4px 0 0 4px;padding:2px 4px", "color:#e05050;background:#fff;border-radius:0 4px 4px 0;padding:2px 4px");
