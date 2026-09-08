---
name: tune-prompt
description: Change src/prompts.ts safely — the representative messages to test against and what to check in each. Use when German output reads wrong, too formal, too literal, or drops information.
---

Change `src/prompts.ts`. This file is the product, not configuration: it decides whether a German
representative reads the user as competent or as confusing.

## Rules before editing

Read `CLAUDE.md § Working on the prompts` first. The constraints that must survive any edit:

- **Always Sie.** Greeting and Grußformel on the **first and last message only** — never every line.
- **Nativize, don't translate.** Fact first (Bestellnummer, date, amount), request stated plainly, one
  request per message, short sentences. Persian ta'arof is converted, not carried over.
- **Verbatim passthrough** of numbers, IDs, names, dates, addresses, IBANs, emails.
- **Never invent.** Missing info goes in `notes`, never into `german`, and never as a
  `[placeholder]` the user might send as-is.
- **`back_translation_fa` reflects what the German actually says** — including whatever the
  nativization changed. If it just echoes the user's input, the safety check is broken while looking
  like it works.

## Test against real messages, not reasoning

Prompt changes cannot be verified by reading. Build, reload, and send these four through the extension:

1. **A complaint.** `salam, in mahsul kharab bud va man mikham pool-am ro pas begiram`
   → Must stay a clear complaint. Watch for the model softening dissatisfaction into vagueness — that
   actively harms the user.
2. **A Kündigung.** `man mikham gharardad-am ro cancel konam az avval-e mah-e ayande`
   → Direct, unambiguous, correct German cancellation vocabulary. No hedging.
3. **A date change.** `mishe gharar-e ruz-e 15 om ro be 22 om taghir bedid?`
   → Both dates survive exactly. Konjunktiv politeness (`könnten Sie`), not a longer sentence.
4. **One carrying an ID.** `shomare gharardad man 88213-BQ ast, hanuz javab nagereftam`
   → `88213-BQ` appears **character for character**. This is the highest-cost failure: a mangled ID
   sends the representative to the wrong record.

Also test the **first message** of a conversation versus a **follow-up** — the greeting rule only shows
up across turns. Send two in a row on the same domain and confirm the second has no `Guten Tag`.

And test the explain direction: paste a real German service message and confirm the Persian is
actionable and any deadline or cost is impossible to miss.

## What to check in each

- Register: `Sie` throughout, no `du`.
- No Grußformel on a mid-conversation line.
- IDs and dates identical to input.
- `back_translation_fa` matches the German that was produced, in natural Persian.
- `notes` in Persian, and only flagging things genuinely missing.

## Review it

Run the `prompt-linguist` agent on the diff and the sample outputs. It reviews German register and
Persian fidelity specifically, which is a different skill from reviewing the code.

## Finish

```bash
npm run check
```

The prompts are plain strings, so tests won't catch a register regression — the real check is the four
messages above. Say which ones you actually ran; don't claim output quality you haven't seen.
