---
name: commit
description: Stage and commit using Conventional Commits — reads the actual diff, picks the right type and scope, writes the message. Use for "commit this", "commit my changes", or any request to make a commit in this repo.
argument-hint: [optional intent, e.g. "just the provider changes"]
---

Commit the current work as a Conventional Commit.

`commitlint` runs on a husky `commit-msg` hook, so a malformed message is **rejected** — get the format
right rather than discovering it at commit time.

## Step 0 — Not on main

`main` is protected with no bypass actors; a hook blocks commits made from it. Check first:

```bash
git branch --show-current
```

If it says `main`, branch before committing — the name mirrors the commit type you're about to use:

```bash
git switch -c <type>/<slug>     # feat/xai-adapter, fix/overlay-dismiss, docs/chrome-137
```

Work reaches main through a rebase-merged PR — see `/pr`.

## Step 1 — Look at what actually changed

```bash
git status --short
git diff
git diff --cached
```

Read the diff. The type and scope come from what the code does, not from what the task was called. A
change described as "add provider support" that turns out to only touch docs is `docs`, not `feat`.

## Step 2 — Format

```
type(scope): subject

body

footers
```

**Types:**

| Type       | Use for                                        |
| ---------- | ---------------------------------------------- |
| `feat`     | a new capability the user can observe          |
| `fix`      | a bug fix                                      |
| `refactor` | restructuring with no behaviour change         |
| `perf`     | a change made for speed                        |
| `docs`     | README, CLAUDE.md, comments, skills            |
| `test`     | tests and fixtures only                        |
| `build`    | esbuild, `scripts/`, packaging                 |
| `ci`       | GitHub Actions                                 |
| `chore`    | deps, tooling, config — anything not the above |
| `style`    | formatting only, no code meaning               |
| `revert`   | reverting a previous commit                    |

**Scopes** (`commitlint.config.js` holds the list; an unknown one warns rather than blocks):
`providers`, `content`, `prompts`, `background`, `options`, `manifest`, `build`, `test`, `claude`,
`ci`, `deps`, `docs`. Omit the scope when a change genuinely spans the repo.

**Subject — the rules commitlint enforces:**

- **≤ 72 characters** for the whole header including `type(scope): `.
- **Lower-case first letter.** `feat: add x`, never `feat: Add x` — this is the rule that trips people.
- Imperative mood: "add", "fix", "remove" — not "added" or "adds".
- No trailing period.

**Body** (optional, blank line before it, wrap at 100): explain **why**, not what — the diff already
says what. Worth writing whenever the reasoning isn't obvious from the change, especially for the
non-obvious workarounds in this repo (the native setter, `execCommand`, the gesture requirement).

**Breaking changes:** `!` after the scope _and_ a `BREAKING CHANGE:` footer explaining the migration.

```
feat(providers)!: require explicit jsonMode on every profile

BREAKING CHANGE: profiles saved before 0.2.0 have no jsonMode and will fail to
load. Re-save each provider in settings.
```

**Attribution footer** — keep the existing convention:

```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

## Step 3 — Scope the commit

If the working tree mixes unrelated changes, **say so and propose splitting them** rather than burying
several concerns in one message. One logical change per commit is the point of the convention.

If the user named a subset in `$1`, stage only that.

## Step 4 — Commit

Stage deliberately (`git add <paths>`, not a reflexive `git add -A` when the tree is mixed), then use a
heredoc so the body keeps its line breaks:

```bash
git commit -F - <<'EOF'
type(scope): subject

Body explaining why.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
```

Hooks that will run: `pre-commit` (lint-staged), the secret scan, and `commit-msg` (commitlint). If
commitlint rejects the message, fix the message — do not bypass with `--no-verify`.

## Examples from this repo

```
fix(content): consult overlay.owns() before dismissing on mousedown

The panel lives in a closed shadow root, so clicks inside it retarget to the
host and the outside-click handler tore it down before a refine button's click
could fire. The buttons silently did nothing.

feat(providers): add xai adapter
docs(claude): document the chrome 137 --load-extension removal
chore(deps): bump esbuild to 0.24.2
test(content): cover shadow-root drilling in getActiveEditable
```

## Notes

- **Only commit when asked.** Don't commit as a reflex at the end of a task.
- Don't push unless the user asks for that too. Getting the work to main is `/pr`.
- Existing history predates this convention; it is not retroactively enforced.
