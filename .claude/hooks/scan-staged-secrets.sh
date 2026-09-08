#!/usr/bin/env bash
# PreToolUse (Bash, if: git commit): block a commit that stages something
# shaped like a provider API key.
#
# This repo exists to hold provider keys, and every preset in
# src/providers/presets.ts names a service that issues one — so a key pasted
# into a test fixture or a debug line is a live risk, not a hypothetical.
# Keys belong in chrome.storage.local at runtime, never in the tree.

set -uo pipefail

cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0

added=$(git diff --cached -U0 2>/dev/null | grep -E '^\+' || true)
[ -n "$added" ] || exit 0

pattern='sk-ant-[A-Za-z0-9_-]{20,}'
pattern+='|sk-[A-Za-z0-9]{32,}'
pattern+='|AIza[A-Za-z0-9_-]{35}'
pattern+='|gsk_[A-Za-z0-9]{40,}'
pattern+='|xai-[A-Za-z0-9]{32,}'
pattern+='|sk-or-v1-[A-Za-z0-9]{32,}'

hits=$(printf '%s' "$added" | grep -Eo "$pattern" | sort -u || true)
[ -n "$hits" ] || exit 0

# Report a masked prefix only — never echo the full secret back into the
# transcript, which would just relocate the leak.
masked=$(printf '%s' "$hits" | cut -c1-12 | sed 's/$/…/' | tr '\n' ' ')

jq -n --arg m "$masked" '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason:
      ("Staged changes contain something shaped like a provider API key (" + $m +
       "). Unstage it and keep the key in chrome.storage.local at runtime. " +
       "If this is a placeholder in a fixture, make it obviously fake (e.g. sk-ant-EXAMPLE).")
  }
}'

exit 0
