// Guards the mistakes that actually happen in extension work: renaming a file
// without updating the manifest, or letting the two version numbers drift.
//
// Manifest paths are relative to dist/, so this checks the build outputs — run
// `npm run build` first (CI does).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => JSON.parse(readFileSync(join(root, p), "utf8"));

interface Manifest {
  manifest_version: number;
  version: string;
  host_permissions?: string[];
  optional_host_permissions?: string[];
  background?: { service_worker?: string };
  options_ui?: { page?: string };
  icons?: Record<string, string>;
  content_scripts?: { js?: string[]; css?: string[]; all_frames?: boolean }[];
  web_accessible_resources?: { resources?: string[] }[];
}

const manifest = read("manifest.json") as Manifest;
const pkg = read("package.json") as { version: string };

test("manifest is Manifest V3", () => {
  assert.equal(manifest.manifest_version, 3);
});

test("version is semver and matches package.json", () => {
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  assert.equal(
    manifest.version,
    pkg.version,
    "manifest.json and package.json versions have drifted",
  );
});

test("every file the manifest references exists in dist/", async (t) => {
  if (!existsSync(join(root, "dist"))) {
    t.skip("dist/ not built — run `npm run build`");
    return;
  }

  const referenced = [
    manifest.background?.service_worker,
    manifest.options_ui?.page,
    ...(manifest.content_scripts ?? []).flatMap((cs) => [...(cs.js ?? []), ...(cs.css ?? [])]),
    ...(manifest.web_accessible_resources ?? []).flatMap((w) => w.resources ?? []),
    ...Object.values(manifest.icons ?? {}),
  ].filter((f): f is string => typeof f === "string");

  assert.ok(referenced.length > 0, "manifest references no files at all");

  for (const file of referenced) {
    await t.test(file, () => assert.ok(existsSync(join(root, "dist", file)), `missing: ${file}`));
  }
});

test("content scripts run in all frames", () => {
  // Operator chat widgets are nearly always iframed; without this the hotkey
  // silently does nothing on the sites that matter most.
  assert.equal(manifest.content_scripts?.[0]?.all_frames, true);
});

test("no broad host permissions are granted at install time", () => {
  // Endpoints are user-supplied, so hosts are requested at runtime instead.
  assert.equal(manifest.host_permissions, undefined);
  assert.ok(Array.isArray(manifest.optional_host_permissions));
});
