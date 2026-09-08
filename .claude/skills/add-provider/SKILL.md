---
name: add-provider
description: Add support for a new LLM provider in zalang — decide whether it needs a preset or a full adapter, encode its JSON-mode quirks, and verify it end to end. Use for "add <provider> support" or when a provider's responses fail to parse.
argument-hint: [provider name]
---

Add support for **$1** to zalang's provider layer.

## Step 1 — Preset or adapter?

Most providers speak the OpenAI dialect, in which case this is a **one-entry change to
`src/providers/presets.ts`** and no new file. Check first:

- Does it expose `POST {base}/v1/chat/completions` with `Authorization: Bearer <key>`? → preset,
  `shape: "openai-compat"`.
- Anthropic-shaped (`/v1/messages`, `x-api-key`)? → preset, `shape: "anthropic"`.
- Gemini-shaped (`:generateContent`, key as query param)? → preset, `shape: "gemini"`.
- None of the above → new adapter file.

Don't guess — look up the provider's current API reference. `WebFetch` its docs.

## Step 2 — Add the preset

In `src/providers/presets.ts`:

```ts
providerkey: {
  label: "Provider Name",
  shape: "openai-compat",
  baseUrl: "https://api.provider.com",   // no trailing /v1 — the adapter appends it
  model: "",                              // see below
  jsonMode: "object",
  needsKey: true,
  keyHint: "where to get a key",
},
```

**Leave `model: ""` unless you have verified a current ID from the provider's own docs in this
session.** IDs churn; the options page fetches the real list via **Fetch list**. A hardcoded stale ID
is worse than an empty field because it fails at request time with a confusing error.

## Step 3 — Get JSON mode right

The wire format is portable across OpenAI-compatible endpoints; **enforcement is not.** Pick the
weakest mode you're confident in — the tolerant parser in `src/providers/json.ts` and the repair retry
in `index.ts` recover from missing enforcement, but a hard 400 kills the request.

Known quirks, encoded as `quirks`:

| Provider   | Quirk                                                           | Flag                                 |
| ---------- | --------------------------------------------------------------- | ------------------------------------ |
| Groq       | rejects a schema unless _every_ property is in `required`       | `allPropsRequired: true`             |
| OpenRouter | only routes to upstreams honouring `response_format` when asked | `requireParameters: true`            |
| Ollama     | OpenAI-compatible endpoint has ignored `json_schema`            | use `jsonMode: "object"`             |
| Anthropic  | current models reject `temperature`; prefill 400s               | `allowsTemperature` gate; no prefill |

## Step 4 — New adapter, only if needed

Copy the structure of `src/providers/openai-compat.ts`. Implement `Adapter` from `src/types.ts`:

- `complete()` returns **raw text**. It does not parse JSON — `runProfile()` owns extraction, the
  repair retry and the degraded fallback.
- `listModels()` returns sorted model IDs.
- Throw `Error` with `profile.name`, the HTTP status and a truncated body, so the fallback chain's
  combined message stays diagnosable.
- Register it in `ADAPTERS` in `src/providers/index.ts` and add the shape to `ProviderShape` in
  `src/types.ts` and to `SHAPES` in `presets.ts`.

Touch nothing outside `src/providers/` (plus `types.ts` if a new capability needs a field). A change
that reaches `prompts.ts` or the UI means the seam is wrong — raise it rather than working around it.

## Step 5 — Verify

```bash
npm run typecheck && npm run lint && npm test
```

Then live, which is the only real proof:

1. `npm run build`, reload the extension.
2. Settings → add the provider → paste key → **Save & grant access** (this is what triggers the runtime
   host permission; adding a preset grants nothing).
3. **Fetch list** → a model list should appear.
4. **Test** → expect `OK · <ms>`.
5. Send a real Farsi message through it and confirm the JSON parses — check the overlay shows a Farsi
   back-translation rather than the "⚠️ Provider did not return structured JSON" degraded note.

State plainly if you have no key for this provider and could not complete step 5.
