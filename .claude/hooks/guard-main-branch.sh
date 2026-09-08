#!/usr/bin/env bash
# PreToolUse (Bash, git commit / git push): refuse to commit or push on main.
#
# The `main-branch` ruleset has no bypass actors, so a direct push to main is
# rejected by the server — but only after the work is already committed in the
# wrong place, with an error that doesn't say what to do instead. Catch it here,
# before the commit exists.
#
# Tag pushes and remote branch deletions are still allowed from main: the
# ruleset targets branch refs, and `/release` pushes tags after a merge.

set -uo pipefail

payload=$(cat)
cmd=$(printf '%s' "$payload" | jq -r '.tool_input.command // empty' 2>/dev/null)
[ -n "$cmd" ] || exit 0

cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0

branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null) || exit 0
[ "$branch" = "main" ] || exit 0

case "$cmd" in
  *"git push"*)
    # Tags and remote deletions are legitimate from main.
    case "$cmd" in
      *--tags* | *--delete* | *" tag "* | *refs/tags*) exit 0 ;;
    esac
    reason="You are on main and the \`main-branch\` ruleset has no bypass actors, so this push will be rejected by GitHub. Create a branch first (\`git switch -c <type>/<slug>\`), push that, and open a PR — see the /pr skill."
    ;;
  *"git commit"*)
    reason="You are on main, which is protected — commits must go on a branch and reach main through a rebase-merged PR. Run \`git switch -c <type>/<slug>\` first (branch names mirror the commit type: feat/, fix/, docs/, chore/…), then commit. See the /pr skill."
    ;;
  *)
    exit 0
    ;;
esac

jq -n --arg r "$reason" '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: $r
  }
}'

exit 0
