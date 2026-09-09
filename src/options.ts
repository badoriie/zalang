import { PRESETS, presetToProfile, SHAPES } from "./providers/presets.js";
import { adapterFor, originPattern } from "./providers/index.js";
import { DEFAULT_HOTKEYS, migrateHotkeys } from "./hotkeys.js";
import type { Hotkey, Hotkeys, HotkeySettings, Profile } from "./types.js";

const $ = <T extends HTMLElement = HTMLElement>(sel: string): T => document.querySelector(sel) as T;

let profiles: Profile[] = [];
let siteContexts: Record<string, string> = {};
let hotkeys: HotkeySettings = { ...DEFAULT_HOTKEYS };

// -------------------------------------------------------------------- storage

async function load(): Promise<void> {
  const local = await chrome.storage.local.get(["profiles", "siteContexts"]);
  profiles = (local.profiles as Profile[]) ?? [];
  siteContexts = (local.siteContexts as Record<string, string>) ?? {};

  // Normally already done by background.ts's onInstalled — this is a
  // belt-and-suspenders catch-all for whatever state an install is in.
  await migrateHotkeys();

  const { hotkeys: synced } = await chrome.storage.sync.get("hotkeys");
  if (synced) hotkeys = { ...hotkeys, ...(synced as Partial<HotkeySettings>) };
}

const saveProfiles = () => chrome.storage.local.set({ profiles });
const saveContexts = () => chrome.storage.local.set({ siteContexts });
// chrome.storage.sync has a per-minute write quota that local never had;
// log and swallow rather than an unhandled rejection if it's ever hit.
const saveHotkeys = () =>
  chrome.storage.sync.set({ hotkeys }).catch((err: unknown) => console.warn("[zalang]", err));

// ---------------------------------------------------------------------- utils

const escapeHtml = (s: unknown): string =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );

/** Profile fields the card exposes as inputs. All string-valued. */
const EDITABLE_FIELDS = ["name", "shape", "baseUrl", "apiKey", "model", "jsonMode"] as const;
type EditableField = (typeof EDITABLE_FIELDS)[number];

function isEditableField(f: string | undefined): f is EditableField {
  return !!f && (EDITABLE_FIELDS as readonly string[]).includes(f);
}

async function ensurePermission(p: Profile): Promise<boolean> {
  try {
    return await chrome.permissions.contains({ origins: [originPattern(p.baseUrl)] });
  } catch {
    return false;
  }
}

// ------------------------------------------------------------------- profiles

function renderProfiles(): void {
  const host = $("#profiles");
  host.textContent = "";

  if (!profiles.length) {
    host.innerHTML = `<p class="muted">No provider yet. Pick one below and add it.</p>`;
    return;
  }

  profiles.forEach((p, i) => {
    const preset = PRESETS[p.preset as keyof typeof PRESETS];
    const card = document.createElement("div");
    card.className = `card${p.enabled ? "" : " off"}`;

    card.innerHTML = `
      <div class="head">
        <strong>${i + 1}. ${escapeHtml(p.name)}</strong>
        <span class="status"></span>
        <button data-act="up" ${i === 0 ? "disabled" : ""} title="Move up">↑</button>
        <button data-act="down" ${i === profiles.length - 1 ? "disabled" : ""} title="Move down">↓</button>
        <button data-act="toggle">${p.enabled ? "Disable" : "Enable"}</button>
        <button data-act="remove" class="danger">Remove</button>
      </div>
      <div class="row"><label>Name</label><input type="text" data-f="name" value="${escapeHtml(p.name)}" /></div>
      <div class="row"><label>Shape</label>
        <select data-f="shape">
          ${SHAPES.map((s) => `<option value="${s}"${p.shape === s ? " selected" : ""}>${s}</option>`).join("")}
        </select>
      </div>
      <div class="row"><label>Base URL</label><input type="text" data-f="baseUrl" value="${escapeHtml(p.baseUrl)}" placeholder="https://api.example.com" /></div>
      <div class="row"><label>API key</label><input type="password" data-f="apiKey" value="${escapeHtml(p.apiKey)}" placeholder="${preset?.needsKey === false ? "not needed" : "paste key"}" /></div>
      <div class="row"><label>Model</label>
        <input type="text" data-f="model" value="${escapeHtml(p.model)}" placeholder="pick or type a model id" list="models-${escapeHtml(p.id)}" />
        <datalist id="models-${escapeHtml(p.id)}"></datalist>
        <button data-act="fetch-models">Fetch list</button>
      </div>
      <div class="row"><label>JSON mode</label>
        <select data-f="jsonMode">
          <option value="schema"${p.jsonMode === "schema" ? " selected" : ""}>schema (strictest)</option>
          <option value="object"${p.jsonMode === "object" ? " selected" : ""}>json_object</option>
          <option value="none"${p.jsonMode === "none" ? " selected" : ""}>prompt only</option>
        </select>
        <button data-act="save" class="primary">Save &amp; grant access</button>
        <button data-act="test">Test</button>
      </div>
      ${preset && "keyHint" in preset ? `<div class="hint">${escapeHtml(preset.keyHint)}</div>` : ""}
    `;

    card.addEventListener("input", (e) => {
      const target = e.target as HTMLInputElement | HTMLSelectElement;
      const field = target.dataset.f;
      if (!isEditableField(field)) return;

      // Every editable field holds a string. `shape` and `jsonMode` are string
      // unions, and their inputs are <select>s that can only emit valid members,
      // so the widened assignment is safe at runtime.
      (p as unknown as Record<EditableField, string>)[field] = target.value.trim();
    });

    card.addEventListener("click", (e) => void onProfileAction(e, p, i, card));
    host.append(card);
  });
}

async function onProfileAction(e: Event, p: Profile, i: number, card: HTMLElement): Promise<void> {
  const action = (e.target as HTMLElement).dataset.act;
  if (!action) return;

  const status = card.querySelector(".status") as HTMLElement;
  const say = (msg: string, cls = "") => {
    status.className = `status ${cls}`;
    status.textContent = msg;
  };

  // chrome.permissions.request() needs a user gesture and throws when called
  // from a service worker. It must be the first thing in this handler — an
  // await before it can cost us the gesture.
  if (action === "save") {
    let granted: boolean;
    try {
      granted = await chrome.permissions.request({ origins: [originPattern(p.baseUrl)] });
    } catch (err) {
      say(err instanceof Error ? err.message : String(err), "err");
      return;
    }
    if (!granted) {
      say("Access denied — zalang can't call this endpoint.", "err");
      return;
    }
    await saveProfiles();
    say("Saved ✓", "ok");
    renderProfiles();
    return;
  }

  if (action === "remove") {
    profiles.splice(i, 1);
    await saveProfiles();
    renderProfiles();
    return;
  }

  if (action === "toggle") {
    p.enabled = !p.enabled;
    await saveProfiles();
    renderProfiles();
    return;
  }

  if (action === "up" || action === "down") {
    const j = action === "up" ? i - 1 : i + 1;
    [profiles[i], profiles[j]] = [profiles[j], profiles[i]];
    await saveProfiles();
    renderProfiles();
    return;
  }

  if (action === "fetch-models") {
    say("Fetching…");
    try {
      if (!(await ensurePermission(p))) return say("Save first to grant access.", "err");

      const models = await adapterFor(p).listModels(p);
      const list = card.querySelector("datalist") as HTMLDataListElement;
      list.innerHTML = models.map((m) => `<option value="${escapeHtml(m)}"></option>`).join("");

      say(`${models.length} models — open the model field`, "ok");
    } catch (err) {
      say(err instanceof Error ? err.message : String(err), "err");
    }
    return;
  }

  if (action === "test") {
    say("Testing…");
    try {
      if (!(await ensurePermission(p))) return say("Save first to grant access.", "err");

      const started = performance.now();
      const out = await adapterFor(p).complete(
        {
          system:
            'Reply with only this JSON: {"german":"Guten Tag","back_translation_fa":"روز بخیر","notes":[]}',
          user: "test",
          schema: null,
          maxTokens: 100,
          temperature: 0,
        },
        { ...p, jsonMode: "none" },
      );
      say(`OK · ${Math.round(performance.now() - started)}ms · ${out.slice(0, 40)}…`, "ok");
    } catch (err) {
      say(err instanceof Error ? err.message : String(err), "err");
    }
  }
}

// ------------------------------------------------------------------- contexts

function renderContexts(): void {
  const host = $("#contexts");
  host.textContent = "";

  const entries = Object.entries(siteContexts);
  if (!entries.length) {
    host.innerHTML = `<p class="muted">No site context yet.</p>`;
    return;
  }

  for (const [domain, value] of entries) {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="head"><strong>${escapeHtml(domain)}</strong>
        <button data-act="del" class="danger">Remove</button>
      </div>
      <textarea>${escapeHtml(value)}</textarea>`;

    card.querySelector("textarea")?.addEventListener("input", (e) => {
      siteContexts[domain] = (e.target as HTMLTextAreaElement).value;
      void saveContexts();
    });

    card.querySelector("[data-act=del]")?.addEventListener("click", () => {
      delete siteContexts[domain];
      void saveContexts();
      renderContexts();
    });

    host.append(card);
  }
}

// -------------------------------------------------------------------- hotkeys

function comboToString(c: Hotkey | undefined): string {
  if (!c) return "";
  const parts: string[] = [];
  if (c.ctrl) parts.push("Ctrl/Cmd");
  if (c.shift) parts.push("Shift");
  if (c.alt) parts.push("Alt");
  parts.push(c.key === " " ? "Space" : c.key);
  return parts.join(" + ");
}

function bindHotkeyInput(sel: string, name: keyof Hotkeys & keyof HotkeySettings): void {
  const input = $<HTMLInputElement>(sel);
  input.value = comboToString(hotkeys[name]);

  input.addEventListener("keydown", (e) => {
    e.preventDefault();
    // Holding the key down after the first press auto-repeats keydown; without
    // this a single capture can fire chrome.storage.sync writes fast enough to
    // hit its per-minute quota (unlike the local area this used to live in).
    if (e.repeat) return;
    if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return;

    hotkeys[name] = {
      key: e.key,
      ctrl: e.ctrlKey || e.metaKey,
      shift: e.shiftKey,
      alt: e.altKey,
    };
    input.value = comboToString(hotkeys[name]);
    void saveHotkeys();
  });
}

function bindBlockEnterCheckbox(sel: string): void {
  const input = $<HTMLInputElement>(sel);
  input.checked = hotkeys.blockEnter;

  input.addEventListener("change", () => {
    hotkeys.blockEnter = input.checked;
    void saveHotkeys();
  });
}

function resetHotkeys(): void {
  hotkeys = { ...DEFAULT_HOTKEYS };
  $<HTMLInputElement>("#hk-translate").value = comboToString(hotkeys.translate);
  $<HTMLInputElement>("#hk-explain").value = comboToString(hotkeys.explain);
  $<HTMLInputElement>("#hk-block-enter").checked = hotkeys.blockEnter;
  void saveHotkeys();
}

// ----------------------------------------------------------------------- init

await load();

$("#preset-select").innerHTML = Object.entries(PRESETS)
  .map(([k, v]) => `<option value="${k}">${escapeHtml(v.label)}</option>`)
  .join("");

$("#add").addEventListener("click", () => {
  profiles.push(presetToProfile($<HTMLSelectElement>("#preset-select").value));
  void saveProfiles();
  renderProfiles();
});

$("#ctx-add").addEventListener("click", () => {
  const domainInput = $<HTMLInputElement>("#ctx-domain");
  const valueInput = $<HTMLInputElement>("#ctx-value");

  const domain = domainInput.value.trim();
  if (!domain) return;

  siteContexts[domain] = valueInput.value.trim();
  void saveContexts();

  domainInput.value = "";
  valueInput.value = "";
  renderContexts();
});

bindHotkeyInput("#hk-translate", "translate");
bindHotkeyInput("#hk-explain", "explain");
bindBlockEnterCheckbox("#hk-block-enter");
$("#hk-reset").addEventListener("click", resetHotkeys);

renderProfiles();
renderContexts();
