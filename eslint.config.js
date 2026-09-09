import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  // .chrome-debug/ is the local debug Chrome profile (npm run debug:chrome) —
  // it holds Chrome's own internal extension bundles (e.g. its WASM TTS
  // engine), not project source. It's gitignored, but ESLint's ignore list is
  // separate from .gitignore and doesn't pick that up automatically.
  { ignores: ["dist/**", "node_modules/**", ".chrome-debug/**"] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ["src/**/*.ts"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.webextensions },
    },
  },

  {
    files: ["test/**/*.ts", "scripts/**/*.mjs", "eslint.config.js"],
    languageOptions: { globals: globals.node },
  },

  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", caughtErrors: "none" },
      ],
      "no-console": "off", // deliberate: console.debug/warn are the only debugging surface
      eqeqeq: ["error", "smart"],
      "prefer-const": "error",
    },
  },
];
