#!/usr/bin/env bash
# PreToolUse (Write|Edit): refuse to write into dist/.
#
# dist/ is esbuild output and gitignored. Editing it is always a mistake — the
# change is silently discarded by the next `npm run build`, which looks like the
# edit "didn't take". Fail loudly instead.

set -uo pipefail

payload=$(cat)
path=$(printf '%s' "$payload" | jq -r '.tool_input.file_path // empty' 2>/dev/null)

[ -n "$path" ] || exit 0

case "$path" in
  */dist/* | dist/*)
    jq -n '{
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason:
          "dist/ is generated build output and is gitignored — this edit would be discarded by the next `npm run build`. Edit the corresponding file under src/ and rebuild."
      }
    }'
    ;;
esac

exit 0
