# zalang

Type Farsi or Finglish straight into a German chat box, press a hotkey, and it's replaced in place by
German a native would actually send — with a Farsi back-translation so you can check it before hitting
Enter. Select the operator's German reply and press a hotkey to get it explained in Farsi.

Built for live chats with Kundenservice, Behörden, Vermieter, Versicherungen and hotlines.

## What it actually does

It doesn't translate word for word. Persian politeness conventions — ta'arof, long preambles, indirect
requests — get converted into how a German would phrase the same intent: fact first, request stated
plainly, one request per message, always **Sie**. Your meaning survives; the phrasing becomes what an
operator expects to read.

Numbers, contract IDs, names and dates are passed through verbatim. If something a representative will
certainly ask for is missing, it's flagged in the notes rather than invented.

## Install

```bash
npm install
npm run build
```

1. `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select the **`dist/`**
   folder (not the repo root).
2. Click the zalang toolbar icon to open settings.
3. Add a provider, paste your key, click **Save & grant access**, then **Test**.

Use `npm run dev` for a watch build while developing; you still need to hit reload in
`chrome://extensions` after a change.

## Providers

Any API works. Pick a preset or choose **Custom** and point it at any endpoint:

| Shape           | Works with                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------ |
| `openai-compat` | OpenAI, Groq, OpenRouter, Together, DeepSeek, Mistral, xAI, LiteLLM, **Ollama**, LM Studio, vLLM |
| `anthropic`     | Claude                                                                                           |
| `gemini`        | Gemini                                                                                           |

Add several and they're tried in order — if the first is rate-limited or down, zalang falls through to
the next.

**On Gemini:** a Gemini Advanced / Google One AI subscription does **not** include API access. Those are
separate products with separate billing, and the consumer gemini.google.com session has no public API an
extension can call. Get a free key at [aistudio.google.com](https://aistudio.google.com) — no credit card
needed.

**For sensitive conversations** (contracts, health, Behörden), add an Ollama profile pointed at
`http://localhost:11434` and move it to the top. Nothing leaves your machine.

## Use

| Key                              | What it does                                    |
| -------------------------------- | ----------------------------------------------- |
| `Ctrl`/`Cmd` + `Enter`           | In the chat box: replace your Farsi with German |
| `Esc`                            | Undo — restores your original text              |
| `Enter`                          | Sends normally. zalang never sends for you      |
| `Ctrl`/`Cmd` + `Shift` + `Space` | With German text selected: explain it in Farsi  |

Right-click a selection also works, as a fallback.

After translating, the panel offers **کوتاه‌تر** (shorter), **رسمی‌تر** (more formal), **کامل‌تر** (more
detail) and **دوباره** (regenerate). Each reworks from your original Farsi, not from the German.

Hotkeys are configurable in settings. They're handled inside the page rather than by Chrome, so they
work inside chat widgets that live in an iframe — the tradeoff is that they can't be remapped from
`chrome://extensions/shortcuts`.

### Conversation context

In settings, attach facts to a domain — `Vertrag 88213, Umzug am 1.10., Anbieter Vodafone`. They're
injected into every message on that site. Cheap, and it noticeably improves precision. The last few
turns are also kept (in session storage only) so references resolve.

## Development

TypeScript, bundled with esbuild. No runtime dependencies.

```bash
npm run dev           # watch build
npm run typecheck     # tsc --noEmit
npm test              # response parsing, schema transforms, manifest integrity
npm run check         # everything CI runs: typecheck → lint → format → build → test
npm run debug:chrome  # Chrome on port 9222 with a dedicated debug profile
```

### Claude Code

The repo ships a committed `.claude/` workspace: agents (`security-auditor`, `prompt-linguist`,
`extension-reviewer`, `provider-adapter`, `build-verifier`), skills (`/add-provider`, `/release`,
`/test-injection`, `/tune-prompt`, `/debug-extension`), and hooks that auto-format, block edits to
`dist/`, refuse commits containing API keys, and gate turns on a passing typecheck. See `CLAUDE.md`.

`npm run debug:chrome` launches a separate Chrome profile the Chrome DevTools MCP attaches to on port
9222 — load `dist/` unpacked into it once. Note that `--load-extension` no longer works in branded
Chrome (removed in 137), which is why the extension is loaded by hand rather than by flag.

Injection fixtures — the part most likely to break on a real site:

```bash
cd test && python3 -m http.server 8000
# open http://localhost:8000/fixtures.html
```

Type into each of the six fields and press the hotkey. German must replace your text in **every** one,
and `Esc` must restore the original. The fixtures cover a plain textarea, a React-controlled textarea, a
`contenteditable`, a same-origin iframe, a shadow root, and a plain input — the six ways real chat
widgets are built.

## Notes

API keys live in `chrome.storage.local`, readable by anyone with local access to your machine and
devtools. Fine for a personal tool; worth knowing. Chat content goes to whichever provider sits at the
top of your list.
