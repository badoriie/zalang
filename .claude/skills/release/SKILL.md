---
name: release
description: Cut a zalang release — bump the version in both package.json and manifest.json (a test enforces they match), verify, tag and push. Tagging triggers the release workflow, which packages and publishes a GitHub Release. Use for "release", "cut a version", "bump to x.y.z", "cut a beta".
argument-hint: [patch|minor|major|x.y.z] [beta]
---

Cut a release of zalang: **$1**.

## The thing that goes wrong

The version lives in **two** files — `package.json` and `manifest.json` — and
`test/manifest.test.ts` asserts they match. Bumping one without the other is a guaranteed CI failure.
That is the entire reason this skill exists; do both in the same step.

## Beta vs. stable — the tag carries it, the files never do

Extension versions must be plain `MAJOR.MINOR.PATCH` — Chrome rejects semver pre-release suffixes like
`-beta.1`, so `package.json` and `manifest.json` are **always** plain semver, beta or not. "Beta" lives
entirely in the **tag**: `v0.1.0-beta.1` against a `package.json`/`manifest.json` version of `0.1.0`.
`.github/workflows/release.yml` reads that suffix off the tag (anything with a `-` in it) and marks the
GitHub Release a prerelease automatically — nothing to set by hand.

## Steps

**1. Confirm the tree is green and clean before touching versions.**

```bash
git status --short
npm run check
```

Don't start a release on a dirty tree or a red build.

**2. Work out the new version and the tag.** Read the current version from `package.json`. If given a
bump type (`patch`/`minor`/`major`), compute it; if given an explicit `x.y.z`, use that — this is what
goes in the files. If this is a beta, the **tag** gets a `-beta.N` suffix on top of that version (e.g.
version `0.1.0`, tag `v0.1.0-beta.1`); the files themselves never see the suffix.

**3. Set it in both files.** Edit `version` in `package.json` and `manifest.json`. Don't use
`npm version` — it only touches `package.json`, creates its own tag, and would leave the manifest
behind.

**3b. Update `CHANGELOG.md`.** Move the `[Unreleased]` items (if any) into a new
`## [<version>] - <today's date>` section — for a beta, the heading still uses the bare version
(`## [0.2.0] - 2026-10-01`); the beta suffix belongs on the tag, not the changelog heading, since
several beta tags can land against the same unreleased version. Add the compare-link reference at the
bottom (`[<version>]: https://github.com/badoriie/zalang/compare/v<prev>...v<version>`).

**4. Verify — the version test is the point.**

```bash
npm run check
```

`version is semver and matches package.json` must pass.

**5. Commit on a release branch — main is protected.**

```bash
git switch -c chore/release-v<version>
git add package.json manifest.json CHANGELOG.md
git commit -m "chore(deps): release v<version>"
git push -u origin HEAD
```

The message must satisfy `commitlint`; `chore: release v<version>` (no scope) is fine too.

**6. PR, then rebase-merge.**

```bash
gh pr create --title "chore: release v<version>" --body "Release v<version>."
gh pr checks --watch
gh pr merge --rebase --delete-branch
```

Rebase is the only merge method the ruleset allows.

**7. Tag main after the merge — not before.**

The tag must point at the commit that actually landed on main. Because the merge rebases, the SHA on
main differs from the one on your branch, so tagging earlier tags a commit that no longer exists.

```bash
git switch main
git pull
git tag v<version>              # stable, e.g. v0.3.0
# or, for a beta:
git tag v<version>-beta.<n>     # e.g. v0.3.0-beta.1 — package/manifest still say 0.3.0
git push origin <tag>
```

Pushing a tag from main is allowed — the ruleset governs branch refs, not tags. **This push triggers
`.github/workflows/release.yml`**, which builds, runs `npm run check`, packages `dist/` into a zip via
`npm run package`, and publishes a GitHub Release with that zip attached — prerelease flag set
automatically from the `-beta`/`-rc` suffix.

**8. Confirm the release workflow, not just CI.**

```bash
gh run list --workflow release.yml --limit 1
gh release view <tag>
```

The CI workflow (`ci.yml`) runs on the tag push too, but the artifact that actually matters here is the
GitHub Release from `release.yml` — check that one.

## Notes

- `dist/` is gitignored and never part of a release commit or tracked in git at all. Both CI and the
  release workflow build it fresh from source.
- Ask before pushing if the user hasn't already said to — pushing a tag kicks off a public release and
  is hard to walk back.
- Consider running `security-auditor` before a release, particularly if `src/content/overlay.ts`,
  `src/options.ts`, the provider layer or `manifest.json` changed since the last one.
- Distribution today is GitHub Releases only — install via "Load unpacked" from the downloaded zip.
  There's no Chrome Web Store publish step; that would need a Web Store developer account and API
  credentials that don't exist yet.
