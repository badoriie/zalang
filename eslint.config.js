import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  { ignores: ["dist/**", "node_modules/**"] },

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
