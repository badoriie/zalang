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
