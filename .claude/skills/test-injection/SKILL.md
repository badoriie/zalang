---
name: test-injection
description: Walk through the six injection fixtures to verify text actually lands in every kind of chat input. Use after changing src/content/editable.ts, before a release, or when the hotkey "does nothing" on a real site.
---

Verify that zalang can write into every kind of chat input. **Unit tests cannot cover this** — the
failures are framework behaviours that only appear in a real browser, and every one of them is silent.

## Setup

```bash
npm run build
cd test && python3 -m http.server 8000
```

Open `http://localhost:8000/fixtures.html`. Serve over HTTP rather than opening the file directly — the
iframe fixture needs a content script, and `file://` requires "Allow access to file URLs" to be enabled
for the extension.

Make sure a provider is configured and **Test** passes in settings first, otherwise every fixture will
fail for the same unrelated reason.

## The six fixtures

For each: type Finglish (e.g. `salam, man paket-am ro nagereftam`), press the translate hotkey
(`Ctrl`/`Cmd`+`Enter`), and confirm German **replaces** the text in place. Then press `Esc` and confirm
your original Farsi comes back.

| #   | Fixture                       | Failure mode to watch for                                                                                             |
| --- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 1   | Plain textarea                | Baseline. If this fails, nothing else will — check the provider first.                                                |
| 2   | **React-controlled textarea** | German appears, then **reverts a frame later**. Means the native prototype setter was bypassed.                       |
| 3   | contenteditable               | Text doesn't change at all, or appears then vanishes — `execCommand("insertText")` isn't reaching the editor's model. |
| 4   | Same-origin iframe            | Hotkey does nothing. Usually `all_frames` or the in-page keydown listener.                                            |
| 5   | Shadow DOM                    | Hotkey does nothing — `getActiveEditable()` isn't drilling through `shadowRoot.activeElement`.                        |
| 6   | Plain input                   | Text lands but the caret is at the start, so Enter behaves oddly.                                                     |

Fixture 2 is the one that matters most: it faithfully simulates React's value tracker, so it fails
exactly the way Intercom, Zendesk and most modern widgets fail. **A naive `el.value = x` passes fixtures
1, 4, 5 and 6 and fails only here** — which is why this page exists.

## Also check the overlay

- The Farsi back-translation panel appears anchored near the field, and flips below it when there's no
  room above.
- The refine buttons (**کوتاه‌تر**, **رسمی‌تر**, **کامل‌تر**, **دوباره**) actually do something. If they
  silently do nothing, the outside-click handler is tearing the panel down on `mousedown` before
  `click` fires — `overlay.owns()` regressed.
- `Esc` restores the original. `Enter` sends normally and clears the panel.
- Type a new message, press the hotkey again: it must translate the **new** text, not the previous one.

## Then a real site

The fixtures approximate; real widgets surprise. On an actual operator chat, confirm:

- The text lands inside the widget's iframe.
- **The send button becomes enabled** — this is the real proof the framework registered the input event,
  rather than the DOM merely showing the text.
- The message sends unmodified.

## If a fixture fails

Open DevTools on the page (not the extension) and check the console for content-script errors. Compare
against `src/content/editable.ts` — each numbered case above maps to one branch there, and
`CLAUDE.md § Writing into a chat box` explains why each is written the way it is.
