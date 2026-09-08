// Builds src/ into dist/, which is what you load in chrome://extensions.
//
// Three entry points, because Chrome loads each differently:
//   background.ts  → ESM   (service_worker with "type": "module")
//   options.ts     → ESM   (options page <script type="module">)
//   content/       → IIFE  (content_scripts have no module support at all —
//                           bundling is what lets the content code use imports)

import * as esbuild from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";

const watch = process.argv.includes("--watch");
const minify = process.argv.includes("--minify");

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });

const shared = {
  bundle: true,
  target: "chrome120",
  logLevel: "info",
  // Inline sourcemaps unless we're packaging: unpacked extensions are debugged
  // in the browser, and a map file is one more thing to keep in sync.
  sourcemap: minify ? false : "inline",
  minify,
};

/** @type {esbuild.BuildOptions[]} */
const builds = [
  { ...shared, entryPoints: { background: "src/background.ts" }, outdir: "dist", format: "esm" },
  { ...shared, entryPoints: { options: "src/options.ts" }, outdir: "dist", format: "esm" },
  { ...shared, entryPoints: { content: "src/content/index.ts" }, outdir: "dist", format: "iife" },
];

async function copyStatic() {
  await cp("manifest.json", "dist/manifest.json");
  await cp("src/options.html", "dist/options.html");
}

if (watch) {
  const contexts = await Promise.all(builds.map((b) => esbuild.context(b)));
  await Promise.all(contexts.map((c) => c.watch()));
  await copyStatic();
  console.log("watching — reload the extension in chrome://extensions after a change");
} else {
  await Promise.all(builds.map((b) => esbuild.build(b)));
  await copyStatic();
  console.log("built → dist/");
}
