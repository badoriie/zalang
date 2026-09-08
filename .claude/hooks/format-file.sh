#!/usr/bin/env bash
# PostToolUse (Write|Edit): run Prettier on whatever was just written.
#
# Keeps `npm run format:check` green so CI never fails on formatting alone.
# --ignore-unknown means files Prettier has no parser for are skipped silently,
# so this is safe to run on every write.

set -uo pipefail

payload=$(cat)
file=$(printf '%s' "$payload" |
  jq -r '.tool_response.filePath // .tool_input.file_path // empty' 2>/dev/null)

[ -n "$file" ] || exit 0
[ -f "$file" ] || exit 0

cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0

# --no-install: use the local devDependency, never fetch from the network.
npx --no-install prettier --write --ignore-unknown "$file" >/dev/null 2>&1 || true

exit 0
