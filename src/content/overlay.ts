// The floating panel. Rendered inside a shadow root so no page CSS can reach it
// and nothing we do leaks back out onto the page.

import type { AnnotatedResult } from "../types.js";

export type OverlayAction = "shorter" | "formal" | "detail" | "regenerate" | "settings";

/** Anything we can position against: an element, or a selection Range. */
export type Anchor = { getBoundingClientRect(): DOMRect } | null;

const CSS = `
  :host { all: initial; }
  .panel {
    position: fixed;
    z-index: 2147483647;
    max-width: 420px;
    min-width: 280px;
    font: 13px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #1a1a1a;
    background: #fff;
    border: 1px solid #d8d8d8;
    border-radius: 10px;
    box-shadow: 0 8px 28px rgba(0,0,0,.18);
    overflow: hidden;
  }
  .head {
    display: flex; align-items: center; gap: 8px;
    padding: 7px 10px;
    background: #f6f6f7;
    border-bottom: 1px solid #e6e6e6;
    font-size: 11px; font-weight: 600; letter-spacing: .3px;
    text-transform: uppercase; color: #6b6b6b;
  }
  .head .spacer { flex: 1; }
  .head button {
    border: 0; background: none; cursor: pointer;
    font-size: 15px; line-height: 1; color: #8a8a8a; padding: 2px 4px;
  }
  .body { padding: 10px; }
  .fa {
    direction: rtl; text-align: right;
    font-size: 14px; line-height: 1.8;
    font-family: Vazirmatn, Tahoma, "Segoe UI", sans-serif;
  }
  .label { font-size: 10px; text-transform: uppercase; letter-spacing: .5px;
           color: #9a9a9a; margin-bottom: 3px; }
  .notes { margin: 9px 0 0; padding: 8px 10px;
           background: #fff8e6; border: 1px solid #f3e2b3; border-radius: 6px; }
  .notes li { margin: 0 0 3px; }
  .notes ul { margin: 0; padding-inline-start: 18px; }
  .err { color: #b3261e; }
  .foot {
    display: flex; flex-wrap: wrap; gap: 5px;
    padding: 8px 10px; border-top: 1px solid #eee; background: #fbfbfb;
  }
  .foot button {
    border: 1px solid #d5d5d5; background: #fff; border-radius: 5px;
    padding: 3px 9px; font-size: 12px; cursor: pointer; color: #333;
  }
  .foot button:hover { background: #f0f0f0; }
  .foot .spacer { flex: 1; }
  .hint { font-size: 11px; color: #9a9a9a; align-self: center; }
  .spin { display: inline-block; animation: s 1s linear infinite; }
  @keyframes s { to { transform: rotate(360deg); } }
  .meta { font-size: 10px; color: #b0b0b0; }
`;

let host: HTMLDivElement | null = null;
let root: ShadowRoot | null = null;
let handler: ((action: OverlayAction) => void) | null = null;

function ensure(): void {
  if (host?.isConnected) return;

  host = document.createElement("div");
  host.style.cssText = "all:initial;position:static;";
  root = host.attachShadow({ mode: "closed" });

  const style = document.createElement("style");
  style.textContent = CSS;
  root.append(style);

  document.documentElement.append(host);
}

function position(panel: HTMLElement, anchor: Anchor): void {
  const margin = 8;
  const rect = anchor?.getBoundingClientRect();

  panel.style.visibility = "hidden";
  panel.style.left = "0px";
  panel.style.top = "0px";

  requestAnimationFrame(() => {
    const pr = panel.getBoundingClientRect();
    let left = rect ? rect.left : (window.innerWidth - pr.width) / 2;
    let top = rect ? rect.top - pr.height - margin : window.innerHeight - pr.height - 40;

    // Flip below the field if there's no room above.
    if (top < margin) top = rect ? rect.bottom + margin : margin;

    left = Math.max(margin, Math.min(left, window.innerWidth - pr.width - margin));
    top = Math.max(margin, Math.min(top, window.innerHeight - pr.height - margin));

    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    panel.style.visibility = "visible";
  });
}

function esc(s: unknown): string {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

function notesHtml(notes: string[] | undefined): string {
  if (!notes?.length) return "";
  return `<div class="notes fa"><ul>${notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul></div>`;
}

function metaHtml(data: AnnotatedResult): string {
  return esc(data._profile ?? "") + (data._ms ? ` · ${data._ms}ms` : "");
}

function render(inner: string, anchor: Anchor): void {
  ensure();
  root?.querySelector(".panel")?.remove();

  const panel = document.createElement("div");
  panel.className = "panel";
  panel.innerHTML = inner;
  root?.append(panel);

  panel.addEventListener("click", (e) => {
    const action = (e.target as HTMLElement | null)?.dataset?.act as OverlayAction | "close";
    if (!action) return;

    e.preventDefault();
    e.stopPropagation();

    if (action === "close") hide();
    else handler?.(action);
  });

  position(panel, anchor);
}

export function hide(): void {
  root?.querySelector(".panel")?.remove();
}

export function onAction(fn: (action: OverlayAction) => void): void {
  handler = fn;
}

/**
 * True if `node` is our panel. The shadow root is closed, so an event inside it
 * retargets to the host — that's what we compare against. Callers need this to
 * avoid tearing the panel down on mousedown, before a button's click has fired.
 */
export function owns(node: EventTarget | null): boolean {
  return !!host && (node === host || host.contains(node as Node));
}

export function loading(anchor: Anchor, label = "در حال ترجمه…"): void {
  render(
    `<div class="head"><span class="spin">◌</span><span>zalang</span></div>
     <div class="body fa">${esc(label)}</div>`,
    anchor,
  );
}

/** Compose result: German is already in the chat box, so show the Farsi check. */
export function result(anchor: Anchor, data: AnnotatedResult, blockEnter = false): void {
  const sendHint = blockEnter
    ? "Esc = undo · use the chat's Send button"
    : "Esc = undo · Enter = send";
  render(
    `<div class="head">
       <span>✓ آماده ارسال</span><span class="spacer"></span>
       <span class="meta">${metaHtml(data)}</span>
       <button data-act="close" title="Close">×</button>
     </div>
     <div class="body">
       <div class="label">این یعنی / this says</div>
       <div class="fa">${esc(data.back_translation_fa || "—")}</div>
       ${notesHtml(data.notes)}
     </div>
     <div class="foot">
       <button data-act="shorter">کوتاه‌تر</button>
       <button data-act="formal">رسمی‌تر</button>
       <button data-act="detail">کامل‌تر</button>
       <button data-act="regenerate">دوباره</button>
       <span class="spacer"></span>
       <span class="hint">${esc(sendHint)}</span>
     </div>`,
    anchor,
  );
}

/** Explain result: incoming German rendered into Farsi. */
export function explained(anchor: Anchor, data: AnnotatedResult): void {
  render(
    `<div class="head">
       <span>ترجمه پیام</span><span class="spacer"></span>
       <span class="meta">${metaHtml(data)}</span>
       <button data-act="close" title="Close">×</button>
     </div>
     <div class="body">
       <div class="fa">${esc(data.german)}</div>
       ${
         data.back_translation_fa
           ? `<div class="label" style="margin-top:9px">منظورشان / what they want</div>
              <div class="fa"><b>${esc(data.back_translation_fa)}</b></div>`
           : ""
       }
       ${notesHtml(data.notes)}
     </div>
     <div class="foot"><span class="spacer"></span><span class="hint">Esc to close</span></div>`,
    anchor,
  );
}

export function error(anchor: Anchor, message: string): void {
  render(
    `<div class="head"><span>zalang</span><span class="spacer"></span>
       <button data-act="close" title="Close">×</button></div>
     <div class="body err">${esc(message)}</div>
     <div class="foot"><button data-act="settings">Settings</button>
       <span class="spacer"></span><span class="hint">Esc to close</span></div>`,
    anchor,
  );
}
