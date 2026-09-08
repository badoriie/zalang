# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

`zalang` is a Chrome MV3 extension written in TypeScript. A Persian speaker types Farsi or Finglish
(Latin-transliterated Farsi) directly into a German chat box, presses a hotkey, and the text is
replaced in place by German — with a Farsi back-translation shown so they can check it before sending.
Selecting the operator's German reply and pressing another hotkey explains it in Farsi.

The target user is chatting with German customer service, Behörden, landlords and insurers, in real
time. Two things follow from that: **latency is a feature**, and **a wrong contract number is worse
than an awkward sentence**.

## Non-negotiables

Break any of these and the extension fails in a way the user can't recover from.

1. **Never lose the user's original text.** Every path that writes to the chat box must keep the
   original for undo. If a provider returns garbage, degrade (write what we got, drop the
   back-translation) rather than blanking the field. See the fallback in `src/providers/index.ts`.
2. **Never send a message.** zalang rewrites the box; the user presses Enter. There is no code path
   that submits a chat form.
3. **API keys stay in the service worker.** Content scripts never receive one. All provider calls run
   in `src/background.ts`.
4. **IDs, numbers, names and dates pass through verbatim.** Enforced in the prompt, and the single
   most damaging failure mode if it regresses.

## Layout

```
src/
  background.ts        Service worker. Owns keys, routes messages, holds site context + history.
  options.ts/.html     Profiles, keys, models, site context, hotkeys.
  prompts.ts           Provider-neutral system prompts. The actual product quality lives here.
  types.ts             Shared types. Message/Reply shapes for the worker boundary.
  content/
    index.ts           Hotkeys, compose/explain flows, undo.
    editable.ts        Reading/writing every kind of chat input.
    overlay.ts         Shadow-DOM panel.
  providers/           The only place that knows a provider exists.
    index.ts           Profile registry, fallback chain, JSON repair retry
    openai-compat.ts   /v1/chat/completions — most of the market, incl. local Ollama
    anthropic.ts       /v1/messages
    gemini.ts          :generateContent
    presets.ts         Known providers → base URL, shape, quirks
    json.ts            Tolerant parsing + per-provider schema transforms
dist/                  Build output — this is what you load in chrome://extensions. Gitignored.
```

**Load `dist/`, not the repo root.** `manifest.json` paths are relative to `dist/`, and the build
copies the manifest and `options.html` in alongside the bundles.

## Build

esbuild, three entry points, because Chrome loads each differently:

| Entry                  | Format   | Why                                             |
| ---------------------- | -------- | ----------------------------------------------- |
| `src/background.ts`    | ESM      | service worker, `"type": "module"`              |
| `src/options.ts`       | ESM      | options page `<script type="module">`           |
| `src/content/index.ts` | **IIFE** | `content_scripts` have no module support at all |

Bundling is what lets the content-script code use `import` — without it, content scripts would have to
share a `globalThis` namespace and be listed in dependency order in the manifest. Don't undo that.

There are no runtime dependencies, and there shouldn't be. devDependencies are tooling only.

## Conventions and traps

### Writing into a chat box

`src/content/editable.ts` handles four cases that each fail differently. Do not "simplify" it:

- React-controlled inputs ignore `el.value = x` — the framework's value tracker doesn't see the change
  and reverts on the next render. Only the **native prototype setter** gets through.
- `contenteditable` editors (Draft.js, Slate, ProseMirror, Lexical — i.e. Intercom, Zendesk, Slack)
  reconcile against their own document model, so `textContent` mutation is discarded.
  `document.execCommand("insertText")` is deprecated but remains the only reliable path; it produces
  the `beforeinput`/`input` sequence these editors listen for. The deprecation warning is expected.
- Widgets nest their composer in a shadow root, so `document.activeElement` returns the host — drill in.
- Widgets are iframed, hence `all_frames: true` and a content-script `keydown` listener rather than
  `chrome.commands` (which fires in the worker with no reliable frame attribution).

Verify any change here against `test/fixtures.html`, which reproduces all of them including a faithful
React value-tracker simulation. Unit tests cannot cover this — you have to load the extension and type.

### The overlay is in a closed shadow root

Events inside it retarget to the host element, so `overlay.owns()` is how you tell "click was on the
panel" from "click was on the page". The outside-click dismissal must consult it, or the panel is
removed on `mousedown` before a button's `click` can fire.

### Permissions

Endpoints are user-supplied, so hosts are requested at runtime via `optional_host_permissions`.
`chrome.permissions.request()` **requires a user gesture and throws synchronously inside a service
worker**. It must be the first statement in the options-page click handler — an `await` before it can
consume the gesture. Getting this wrong breaks the feature permanently with no visible error.

### Providers

Adding a provider should mean touching only `src/providers/`. If a change leaks provider specifics into
`prompts.ts`, `background.ts` or the UI, the seam is wrong.

- Structured-output support is **not portable** even among "OpenAI-compatible" endpoints. Groq requires
  every property in `required`; OpenRouter needs `require_parameters: true`; Ollama has historically
  ignored `json_schema`. Encode quirks in `presets.ts` and always run the tolerant parser regardless.
- Do not add an assistant-prefill JSON trick. It returns a 400 on current Claude models.
- **Do not hardcode model IDs.** They churn fast. Presets carry a suggested default at most; the
  options page fetches the real list via `listModels()`. If asked about a current model, look it up —
  don't answer from memory.

### Latency

Non-streaming by design; streaming into a live chat input is jarring at this message length. The
service worker is pre-warmed by a `ping` on field focus because MV3 workers idle out after ~30s and the
cold start is real perceived latency. Keep both properties.

## Working on the prompts

`src/prompts.ts` is where quality lives, and it is not "just a string". The German must read as native:
always **Sie**; greeting and Grußformel on the first and last message only, never every line; lead with
the concrete fact; one request per message. Persian politeness conventions (ta'arof, long preambles,
repeated apology) are converted, not translated — a short direct German message reads as competent,
not rude.

Changes here need to be checked against real messages, not reasoned about. Send a complaint, a
Kündigung, a date change, and something containing a contract number.

## Commands

```bash
npm run build       # → dist/
npm run dev         # watch mode; still reload the extension in chrome://extensions
npm run typecheck   # tsc --noEmit
npm test            # node:test via tsx — parsing, schema transforms, manifest integrity
npm run lint
npm run format
npm run check       # everything CI runs, in order

cd test && python3 -m http.server 8000   # then open localhost:8000/fixtures.html
```

`npm test` asserts that every file the manifest references exists in `dist/`, so **build before
testing** (`npm run check` does this in the right order).

## Style

Prettier-formatted, 100 columns, strict TypeScript. Comments explain **why**, especially where the
code looks odd on purpose (the native setter, `execCommand`, the gesture requirement, the closed shadow
root) — those are the places a future reader will otherwise "clean up" and break. Match the surrounding
density; don't narrate what the code already says.
