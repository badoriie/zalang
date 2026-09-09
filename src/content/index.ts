// Runs in every frame of every page. Owns the hotkeys and the compose/explain
// flows. Never sends a message for you — it only rewrites the box.

import type { Editable } from "./editable.js";
import { getActiveEditable, isEditable, readText, writeText } from "./editable.js";
import * as overlay from "./overlay.js";
import type { Anchor } from "./overlay.js";
import { DEFAULT_HOTKEYS } from "../hotkeys.js";
import type {
  Hotkey,
  HotkeySettings,
  Message,
  Refinement,
  Reply,
  AnnotatedResult,
} from "../types.js";

let keys: HotkeySettings = DEFAULT_HOTKEYS;

// Hotkeys live in the sync area, not local, so this listener never has a
// reason to subscribe to "local" — which is where profiles (API keys
// included) live. chrome.storage.onChanged delivers every changed key in
// whichever area a listener is on with no per-key filter, so a content
// script listening on "local" would receive the full profiles array,
// cleartext keys included, on every settings save even though it never
// reads them.
void chrome.storage.sync.get("hotkeys").then(({ hotkeys }) => {
  if (hotkeys) keys = { ...DEFAULT_HOTKEYS, ...(hotkeys as Partial<HotkeySettings>) };
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.hotkeys?.newValue) {
    keys = { ...DEFAULT_HOTKEYS, ...(changes.hotkeys.newValue as Partial<HotkeySettings>) };
  }
});

/**
 * The open compose result, so Esc can undo and refine knows what to rework.
 * `written` is the exact text we last put into `el` — undo() only restores
 * over content that still matches it, so a widget that clears the field after
 * an actual send (the normal path once "block Enter" is on, since then Enter
 * can never trigger it) can't have its now-empty box overwritten with the
 * stale Farsi original by a later, unrelated Escape.
 */
let pending: { el: Editable; original: string; written: string } | null = null;

/**
 * Which flow the visible overlay belongs to. Esc must only undo a compose when
 * the panel it's dismissing IS that compose's result — otherwise dismissing an
 * unrelated explain popup silently undoes a leftover compose elsewhere on the
 * page, because `pending` outlives its own overlay by design (so undo still
 * works after you've clicked the popup away).
 */
let activeOverlay: "compose" | "explain" | null = null;

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

  // Whatever the field holds right now — the original on a fresh translate, or
  // the previous translation on a refine — is what we'd be overwriting, so
  // it's also what undo() should require still being there before restoring.
  pending = { el, original, written: readText(el) };
  activeOverlay = "compose";
  overlay.loading(el, refine ? "در حال بازنویسی…" : "در حال ترجمه…");

  const res = await send({ type: "translate", text: original, domain, refine });

  if (!res?.ok) {
    overlay.error(el, res?.error ?? "No response from zalang.");
    return;
  }

  writeText(el, res.data.german);
  pending = { el, original, written: res.data.german };
  overlay.result(el, res.data, keys.blockEnter);
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
  activeOverlay = "explain";
  overlay.loading(anchor, "در حال ترجمه…");

  const res = await send({ type: "explain", text: selected, domain });

  if (!res?.ok) overlay.error(anchor, res?.error ?? "No response from zalang.");
  else overlay.explained(anchor, res.data);
}

// ------------------------------------------------------------------- undo/esc

function undo(): void {
  if (pending?.el && readText(pending.el) === pending.written) {
    writeText(pending.el, pending.original);
    pending.el.focus();
  }
  pending = null;
  activeOverlay = null;
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
    // A page can dispatch a synthetic KeyboardEvent on itself, and this
    // listener runs in every frame of every site — without this check any
    // page could silently trigger a translate/explain call (spending the
    // user's API key and reading the result back out of a field it controls)
    // with no click and no visible UI, e.g. inside a zero-size iframe.
    if (!e.isTrusted) return;
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

    if (
      keys.blockEnter &&
      e.key === "Enter" &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.shiftKey &&
      !e.altKey &&
      getActiveEditable()
    ) {
      // stopPropagation (not just preventDefault, which only blocks the
      // browser's native action) so a widget's own JS keydown handler on the
      // field never sees this Enter either — same trick as the hotkeys above.
      // Not airtight against a page that itself listens on window in capture
      // ahead of us, but that's rare; document capture covers the common case.
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    if (e.key === "Escape" && activeOverlay === "explain") {
      // Dismissing an explain popup must never undo an unrelated, still-pending
      // compose elsewhere on the page — pending intentionally outlives its own
      // overlay (see the comment on `activeOverlay`), so without this check
      // this Esc would fall through to undo() and revert that other field.
      e.preventDefault();
      e.stopPropagation();
      activeOverlay = null;
      overlay.hide();
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
  if (!e.isTrusted) return;
  if (e.key === "Enter" && !e.ctrlKey && !e.metaKey && !e.shiftKey && pending) {
    pending = null;
    activeOverlay = null;
    overlay.hide();
  }
});

// Click away to dismiss — but never on the panel itself, or the refine buttons
// would be removed before their click event fired.
document.addEventListener("mousedown", (e) => {
  if (!e.isTrusted) return;
  if (overlay.owns(e.target) || e.target === pending?.el) return;
  activeOverlay = null;
  overlay.hide();
});

// Pre-warm the service worker. MV3 workers idle out after ~30s and the cold
// start is real perceived latency — by the time you finish typing, it's awake.
// isTrusted here blocks a page calling dispatchEvent() to fake this, though
// not a page calling el.focus() on its own field — that's a genuine, trusted
// focus event per spec, indistinguishable from a real user click. Low stakes
// either way: the 20s throttle bounds it to keeping the worker warm, not
// spending anything, and the privileged compose/explain calls below are
// gated on trusted keydowns regardless.
let lastPing = 0;
document.addEventListener("focusin", (e) => {
  if (!e.isTrusted) return;
  if (!isEditable(document.activeElement)) return;

  const now = Date.now();
  if (now - lastPing < 20_000) return;

  lastPing = now;
  void send({ type: "ping" });
});

chrome.runtime.onMessage.addListener((msg: { type?: string; text?: string }) => {
  if (msg?.type === "explain-selection") void explain(msg.text);
});
