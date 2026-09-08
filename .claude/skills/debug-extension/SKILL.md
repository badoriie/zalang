---
name: debug-extension
description: Drive the extension in a real Chrome via the Chrome DevTools MCP — console messages, network, screenshots, performance. Use to reproduce a bug on a live page, inspect a failing provider call, or see what the overlay actually renders.
---

Debug zalang in a real browser using the `chrome-devtools` MCP server.

## Start the debug browser

```bash
npm run debug:chrome
```

That builds `dist/` and launches Chrome with `--remote-debugging-port=9222` against a dedicated
`.chrome-debug` profile.

**First run only:** in that window, go to `chrome://extensions` → enable **Developer mode** → **Load
unpacked** → select `dist/`. It persists in the profile from then on. After a rebuild you still need to
hit **reload** on the extension card.

Then check the MCP is attached — `/mcp` should show `chrome-devtools` connected.

## Why it's done this way

The obvious setup — launching Chrome with `--load-extension=dist` — **does not work and fails
silently.** Google removed that flag from branded Chrome builds in **Chrome 137** (it was being abused
to side-load malware), and `--disable-extensions-except` followed in 139. Stock Chrome starts normally,
ignores the flag, and runs without your extension; the only trace is a log line you see solely with
`--enable-logging=stderr`. The symptom is a mysterious timeout, not an error.

So the extension is loaded once by hand and the MCP **attaches** to that browser.

The dedicated profile is also deliberate: attaching the MCP to your everyday Chrome would expose every
open tab and cookie to it. `.chrome-debug/` is gitignored.

## What you can and can't see

**Can:** page console messages (including content-script logs and errors), network requests, DOM
snapshots, screenshots, performance traces, and full page interaction — navigate, click, type. This
covers the injection flows and the overlay well.

**Can't, usefully:** the MV3 **service worker**. Provider calls, key handling and the message router
live there, and the DevTools MCP is page-oriented. For those, open the worker's own DevTools:
`chrome://extensions` → zalang → **service worker**. Its `console.debug("[zalang] <profile> <ms>ms")`
timing lines and the `[zalang] <profile> failed:` warnings are the fastest way to diagnose the
fallback chain.

## Useful runs

**Exercise the fixtures.** Serve `test/` (`cd test && python3 -m http.server 8000`), navigate to
`http://localhost:8000/fixtures.html`, type into a field, trigger the hotkey, screenshot the result.
Good for seeing overlay positioning and confirming text landed.

**Reproduce a site-specific failure.** Navigate to the page where the hotkey "does nothing", check
console for content-script errors, and inspect the composer element — is it an iframe, a shadow root, a
`contenteditable`? That tells you which branch of `src/content/editable.ts` is involved.

**Check the overlay renders correctly.** Screenshot it. Since it lives in a _closed_ shadow root you
cannot query into it from the page context — the screenshot is the practical check, plus
`overlay.owns()` behaviour when you click elsewhere.

**Performance.** Only worth tracing if translation feels slow. Measure round-trip in the service worker
first (the `[zalang]` timing log); the page side is rarely the bottleneck.

## Notes

- Chrome must be running before the MCP can attach — if `/mcp` shows it failed, start
  `npm run debug:chrome` and retry.
- Do not point this at your personal profile.
- Nothing here replaces `test-injection`: the MCP can drive the page, but confirming the _send button
  becomes enabled_ on a real widget is still the meaningful proof, and that needs a real chat.
