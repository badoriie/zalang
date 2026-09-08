---
name: pr
description: Full branch → commit → push → pull request → rebase-merge → cleanup flow. main is protected with no bypass, rebase-only, linear history. Use for "open a PR", "ship this", or any change that needs to reach main.
argument-hint: [optional PR title or intent]
---

Get the current work onto `main` through a pull request.

## The rules this repo enforces

The `main-branch` ruleset is **active with no bypass actors** — nobody can push to main directly, owner
included. It also sets:

| Rule                                                | Effect                                                      |
| --------------------------------------------------- | ----------------------------------------------------------- |
| `pull_request`, `allowed_merge_methods: ["rebase"]` | **Rebase merge only.** No merge commits, no squash.         |
| `required_linear_history`                           | History stays linear — a merge commit is rejected outright. |
| `non_fast_forward`                                  | No force-push to main.                                      |
| `deletion`                                          | main can't be deleted.                                      |
| `required_approving_review_count: 0`                | You can merge your own PR — no reviewer needed.             |

Repo settings: `delete_branch_on_merge: true`, so the **remote branch is removed automatically** after
merge. The local one is not — clean it up yourself (below).

Because history must stay linear, **never merge main into your branch.** Rebase onto it.

## Step 1 — Branch

If you're on `main`, branch before doing anything. A hook blocks commits and pushes from main, but
branch first and it never fires.

```bash
git switch main && git pull        # pull.rebase=true is set for this repo
git switch -c <type>/<slug>
```

Branch names mirror the commit type: `feat/xai-adapter`, `fix/overlay-dismiss`, `docs/chrome-137`,
`chore/bump-esbuild`. Keep the slug short and specific.

If you already have commits sitting on main locally (the guard should have prevented this, but):

```bash
git switch -c <type>/<slug>        # takes the commits with you
git switch main && git reset --hard origin/main
```

## Step 2 — Commit

Use the `/commit` skill, or follow the same rules: Conventional Commits, enforced by `commitlint` on the
`commit-msg` hook. One logical change per commit.

## Step 3 — Rebase onto main before pushing

```bash
git fetch origin
git rebase origin/main
```

If there are conflicts: fix, `git add`, `git rebase --continue`. Never `git merge origin/main` — it
creates a merge commit and `required_linear_history` will reject the PR.

## Step 4 — Push and open the PR

```bash
git push -u origin HEAD
gh pr create --fill
```

Prefer writing a real title and body over `--fill` when the change deserves explanation:

```bash
gh pr create --title "feat(providers): add xai adapter" --body "$(cat <<'EOF'
## What

One-line summary.

## Why

The reasoning — what problem this solves, what alternative was rejected.

## Verification

- `npm run check` green
- Provider matrix: added the profile, Fetch list, Test → OK
EOF
)"
```

The title should be a valid Conventional Commit header — it becomes the commit subject if the branch
ever collapses to one commit, and it keeps the PR list readable.

## Step 5 — Wait for CI, then merge

```bash
gh pr checks --watch
gh pr merge --rebase --delete-branch
```

`--rebase` is not optional: it's the only method the ruleset allows. `--delete-branch` also removes the
local branch and switches you back.

CI is **not** currently a required status check, so GitHub will let you merge a red PR. Check it
yourself — `gh pr checks` — before merging.

## Step 6 — Clean up

```bash
git switch main
git pull
git fetch --prune          # drops remote-tracking refs for auto-deleted branches
git branch -d <branch>     # if --delete-branch didn't already
```

## Notes

- **Ask before merging** unless the user has said to. Opening a PR is reversible; merging to main is
  the point of no return.
- If a PR needs updating after review, commit on the branch and `git push` — then rebase onto main
  again if main has moved.
- A stale branch that's fallen behind main just needs `git fetch origin && git rebase origin/main`
  followed by `git push --force-with-lease` (safe on your own branch; never on main).
