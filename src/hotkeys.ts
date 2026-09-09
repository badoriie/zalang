// Single source of truth for default hotkey settings — content/index.ts and
// options.ts both need it (the latter also uses it for "reset to default"),
// and duplicating the literal risks the two drifting apart.

import type { HotkeySettings } from "./types.js";

// Frozen (including the nested combos) because both call sites copy this by
// reference on first load, before any per-user override exists — an in-place
// mutation of `keys.translate`, say, instead of a full reassignment, would
// silently corrupt everyone's fallback default.
export const DEFAULT_HOTKEYS: HotkeySettings = Object.freeze({
  translate: Object.freeze({ key: "Enter", ctrl: true, shift: false, alt: false }),
  explain: Object.freeze({ key: " ", ctrl: true, shift: true, alt: false }),
  blockEnter: false,
});

/**
 * hotkeys used to live in chrome.storage.local, alongside profiles (API keys
 * included) — moved to sync so the content script never has a reason to
 * subscribe to the same storage area as a key. Called from background.ts's
 * onInstalled (so an update migrates it even if the user never reopens
 * options) and from options.ts's load() (belt and suspenders, and it's the
 * only place local.hotkeys could still exist on a very old install).
 *
 * Guarded against two real failure modes, not just "run once": local storage
 * doesn't sync across devices, so a second device can still have its own
 * stale local.hotkeys long after a first device already migrated — writing
 * that over sync unconditionally would clobber whatever the first device
 * already synced. First migration to actually reach sync wins; local.hotkeys
 * is cleared either way since it's obsolete regardless of which one won.
 */
export async function migrateHotkeys(): Promise<void> {
  const { hotkeys: local } = await chrome.storage.local.get("hotkeys");
  if (!local) return;

  const { hotkeys: existing } = await chrome.storage.sync.get("hotkeys");
  if (!existing) await chrome.storage.sync.set({ hotkeys: local });

  await chrome.storage.local.remove("hotkeys");
}
