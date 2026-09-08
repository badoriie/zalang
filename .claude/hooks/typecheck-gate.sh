#!/usr/bin/env bash
# Stop: don't finish a turn with the project failing to typecheck.
#
# Hands the actual tsc errors back so they get fixed in the same turn instead of
# surfacing in CI ten minutes later.

set -uo pipefail

payload=$(cat)

# Guard against a loop: if we already blocked once and Claude is stopping again,
# let it through rather than trapping the turn.
active=$(printf '%s' "$payload" | jq -r '.stop_hook_active // false' 2>/dev/null)
[ "$active" = "true" ] && exit 0

cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0
[ -f tsconfig.json ] || exit 0
[ -d node_modules ] || exit 0

output=$(npx --no-install tsc --noEmit 2>&1)
status=$?

[ $status -eq 0 ] && exit 0

errors=$(printf '%s' "$output" | grep -E 'error TS' | head -20)
[ -n "$errors" ] || errors="$output"

jq -n --arg e "$errors" '{
  decision: "block",
  reason: ("`npm run typecheck` is failing — fix these before finishing:\n\n" + $e)
}'

exit 0
