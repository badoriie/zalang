// Runs in every frame of every page. Owns the hotkeys and the compose/explain
// flows. Never sends a message for you — it only rewrites the box.

import type { Editable } from "./editable.js";
import { getActiveEditable, isEditable, readText, writeText } from "./editable.js";
import * as overlay from "./overlay.js";
import type { Anchor } from "./overlay.js";
import type { Hotkey, Hotkeys, Message, Refinement, Reply, AnnotatedResult } from "../types.js";

const DEFAULT_KEYS: Hotkeys = {
  translate: { key: "Enter", ctrl: true, shift: false, alt: false },
  explain: { key: " ", ctrl: true, shift: true, alt: false },
};

let keys: Hotkeys = DEFAULT_KEYS;

void chrome.storage.local.get("hotkeys").then(({ hotkeys }) => {
  if (hotkeys) keys = { ...DEFAULT_KEYS, ...(hotkeys as Partial<Hotkeys>) };
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.hotkeys?.newValue) {
    keys = { ...DEFAULT_KEYS, ...(changes.hotkeys.newValue as Partial<Hotkeys>) };
  }
});

/** The open compose result, so Esc can undo and refine knows what to rework. */
let pending: { el: Editable; original: string } | null = null;

const domain = location.hostname || "unknown";

function matches(e: KeyboardEvent, combo: Hotkey | undefined): boolean {
  if (!combo) return false;
  const ctrl = e.ctrlKey || e.metaKey; // treat Cmd as Ctrl on macOS

  return (
    e.key.toLowerCase() === combo.key.toLowerCase() &&
    ctrl === !!combo.ctrl &&
    e.shiftKey === !!combo.shift &&
    e.altKey === !!combo.alt
  );
}

function send(msg: Message): Promise<Reply<AnnotatedResult> | undefined> {
  return new Promise((resolve) => chrome.runtime.sendMessage(msg, resolve));
}

// --------------------------------------------------------------- compose flow

async function compose(refine: Refinement | null): Promise<void> {
  // A refinement reworks the message we already have; a fresh translate always
  // re-reads the field, so a pasted replacement can't be translated as the
  // previous message.
  let el: Editable | null;
  let original: string;

  if (refine && pending) {
    ({ el, original } = pending);
  } else {
    el = getActiveEditable();
    if (!el) return;
    original = readText(el).trim();
  }
  if (!el || !original) return;

  pending = { el, original };
  overlay.loading(el, refine ? "در حال بازنویسی…" : "در حال ترجمه…");

  const res = await send({ type: "translate", text: original, domain, refine });

  if (!res?.ok) {
    overlay.error(el, res?.error ?? "No response from zalang.");
    return;
  }

  writeText(el, res.data.german);
  overlay.result(el, res.data);
}

// --------------------------------------------------------------- explain flow

function anchorForSelection(): Anchor {
  const sel = window.getSelection();
  // overlay.position() only needs getBoundingClientRect(), which a Range has.
  return sel?.rangeCount ? sel.getRangeAt(0) : getActiveEditable();
}

async function explain(text?: string): Promise<void> {
  const selected = (text ?? window.getSelection()?.toString() ?? "").trim();
  if (!selected) return;

  const anchor = anchorForSelection();
  overlay.loading(anchor, "در حال ترجمه…");

  const res = await send({ type: "explain", text: selected, domain });

  if (!res?.ok) overlay.error(anchor, res?.error ?? "No response from zalang.");
  else overlay.explained(anchor, res.data);
}

// ------------------------------------------------------------------- undo/esc

function undo(): void {
  if (pending?.el) {
    writeText(pending.el, pending.original);
    pending.el.focus();
  }
  pending = null;
  overlay.hide();
}

// -------------------------------------------------------------------- wiring

overlay.onAction((action) => {
  if (action === "settings") {
    void send({ type: "openOptions" });
    return;
  }
  void compose(action);
});

document.addEventListener(
  "keydown",
  (e) => {
    if (e.isComposing) return;

    if (matches(e, keys.translate)) {
      const el = getActiveEditable();
      if (!el || !readText(el).trim()) return;
      e.preventDefault();
      e.stopPropagation();
      void compose(null);
      return;
    }

    if (matches(e, keys.explain)) {
      if (!window.getSelection()?.toString().trim()) return;
      e.preventDefault();
      e.stopPropagation();
      void explain();
      return;
    }

    if (e.key === "Escape" && pending) {
      e.preventDefault();
      e.stopPropagation();
      undo();
      return;
    }

    // Typing again after a result means the user has moved on — drop the undo
    // buffer so a later Esc doesn't resurrect stale text, but leave the panel.
    if (pending && e.key.length === 1) pending = null;
  },
  true, // capture, so chat widgets can't swallow the key first
);

// Sending clears the undo buffer.
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.ctrlKey && !e.metaKey && !e.shiftKey && pending) {
    pending = null;
    overlay.hide();
  }
});

// Click away to dismiss — but never on the panel itself, or the refine buttons
// would be removed before their click event fired.
document.addEventListener("mousedown", (e) => {
  if (overlay.owns(e.target) || e.target === pending?.el) return;
  overlay.hide();
});

// Pre-warm the service worker. MV3 workers idle out after ~30s and the cold
// start is real perceived latency — by the time you finish typing, it's awake.
let lastPing = 0;
document.addEventListener("focusin", () => {
  if (!isEditable(document.activeElement)) return;

  const now = Date.now();
  if (now - lastPing < 20_000) return;

  lastPing = now;
  void send({ type: "ping" });
});

chrome.runtime.onMessage.addListener((msg: { type?: string; text?: string }) => {
  if (msg?.type === "explain-selection") void explain(msg.text);
});
