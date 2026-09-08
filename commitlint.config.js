/**
 * Conventional Commits enforcement.
 * Runs from the husky `commit-msg` hook, so it applies to every commit
 * regardless of who or what wrote the message.
 *
 * Format:  type(scope): subject
 * Example: fix(content): use native setter so React inputs don't revert
 */
export default {
  extends: ["@commitlint/config-conventional"],

  rules: {
    // Scopes for this repo. Level 1 = warn, not block: a genuinely new area
    // shouldn't be stopped by a list that's out of date. Add it here when it is.
    "scope-enum": [
      1,
      "always",
      [
        "providers", // src/providers/** — adapters, presets, JSON coercion
        "content", // src/content/** — injection, hotkeys, overlay
        "prompts", // src/prompts.ts — the German/Persian instructions
        "background", // src/background.ts — service worker, routing
        "options", // options page
        "manifest", // manifest.json, permissions
        "build", // esbuild, scripts/
        "test", // tests and fixtures
        "claude", // .claude/ workspace: agents, skills, hooks
        "ci", // GitHub Actions
        "deps", // dependency bumps
        "docs", // README, CLAUDE.md
      ],
    ],

    // The default is 100, which invites subjects nobody can read in a log.
    "header-max-length": [2, "always", 72],

    // Body and footer wrap at 100 so `git log` stays readable in a terminal.
    "body-max-line-length": [2, "always", 100],
    "footer-max-line-length": [2, "always", 100],
  },
};
