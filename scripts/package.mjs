// Builds a minified production bundle and zips dist/ into a distributable
// artifact — what `npm run package` produces here is exactly what the release
// workflow attaches to a GitHub Release.

import { execFileSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const { version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const zipName = `zalang-v${version}.zip`;

// Absolute paths, not bare command names — a bare name resolves through
// $PATH, which an attacker able to influence the runner's environment could
// point at a different binary.
execFileSync(process.execPath, ["scripts/build.mjs", "--minify"], { cwd: root, stdio: "inherit" });

rmSync(join(root, zipName), { force: true });
execFileSync("/usr/bin/zip", ["-rq", join("..", zipName), "."], {
  cwd: join(root, "dist"),
  stdio: "inherit",
});

console.log(`packaged → ${zipName}`);
