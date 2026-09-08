// Reading and writing the page's chat input.
//
// This is the highest-risk part of the extension. Modern chat widgets keep their
// own model of the input's value and will silently revert a naive write a moment
// after you make it. Each case below needs different handling.

export type Editable = HTMLInputElement | HTMLTextAreaElement | HTMLElement;

export function isEditable(el: Element | null): el is Editable {
  if (!el) return false;

  if (el instanceof HTMLTextAreaElement) return !el.disabled && !el.readOnly;

  if (el instanceof HTMLInputElement) {
    return !el.disabled && !el.readOnly && /^(text|search|email|url|tel|)$/i.test(el.type);
  }

  return el instanceof HTMLElement && el.isContentEditable;
}

/**
 * Find the focused editable, drilling through shadow roots (widgets like
 * Intercom and Zendesk nest their composer inside one).
 */
export function getActiveEditable(): Editable | null {
  let el: Element | null = document.activeElement;
  while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
  return isEditable(el) ? el : null;
}

export function readText(el: Editable | null): string {
  if (!el) return "";
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return el.value;
  return el.innerText;
}

function writeInput(el: HTMLInputElement | HTMLTextAreaElement, text: string): boolean {
  // React (and Vue, Svelte, Angular to varying degrees) installs its own `value`
  // setter on the element instance and ignores plain assignment — the DOM shows
  // the new text but the framework's state never updates, so it reverts on the
  // next render. Going through the native prototype setter fixes that.
  const proto =
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;

  if (setter) setter.call(el, text);
  else el.value = text;

  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));

  // Caret to the end so Enter sends immediately.
  try {
    el.setSelectionRange(text.length, text.length);
  } catch {
    // Not all input types support selection.
  }
  return true;
}

function writeContentEditable(el: HTMLElement, text: string): boolean {
  // Draft.js, Slate, ProseMirror, Lexical and friends reconcile against their
  // own document model, so mutating textContent gets thrown away. execCommand
  // is deprecated but remains the only reliable path: it produces the real
  // beforeinput/input sequence these editors listen for.
  const sel = window.getSelection();
  if (!sel) return false;

  const range = document.createRange();
  range.selectNodeContents(el);
  sel.removeAllRanges();
  sel.addRange(range);

  let ok = false;
  try {
    ok = document.execCommand("insertText", false, text);
  } catch {
    ok = false;
  }

  if (!ok) {
    // Fallback for editors that block execCommand. Less reliable, but better
    // than doing nothing.
    el.textContent = text;
    el.dispatchEvent(
      new InputEvent("input", { bubbles: true, data: text, inputType: "insertText" }),
    );
  }

  // Collapse the caret to the end.
  const end = document.createRange();
  end.selectNodeContents(el);
  end.collapse(false);
  sel.removeAllRanges();
  sel.addRange(end);

  return true;
}

/** Replace the whole contents of `el` in a way the page's framework accepts. */
export function writeText(el: Editable | null, text: string): boolean {
  if (!el) return false;
  el.focus();

  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    return writeInput(el, text);
  }
  return writeContentEditable(el, text);
}
