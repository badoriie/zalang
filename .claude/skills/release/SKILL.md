---
name: release
description: Cut a zalang release — bump the version in both package.json and manifest.json (a test enforces they match), verify, tag and push. Use for "release", "cut a version", "bump to x.y.z".
argument-hint: [patch|minor|major|x.y.z]
---

Cut a release of zalang: **$1**.

## The thing that goes wrong

The version lives in **two** files — `package.json` and `manifest.json` — and
`test/manifest.test.ts` asserts they match. Bumping one without the other is a guaranteed CI failure.
That is the entire reason this skill exists; do both in the same step.

## Steps

**1. Confirm the tree is green and clean before touching versions.**

```bash
git status --short
npm run check
```

Don't start a release on a dirty tree or a red build.

**2. Work out the new version.** Read the current one from `package.json`. If given a bump type
(`patch`/`minor`/`major`), compute it; if given an explicit `x.y.z`, use that. Extension versions must
be plain `MAJOR.MINOR.PATCH` — Chrome does not accept semver pre-release suffixes like `-beta.1`.

**3. Set it in both files.** Edit `version` in `package.json` and `manifest.json`. Don't use
`npm version` — it only touches `package.json`, creates its own tag, and would leave the manifest
behind.

**4. Verify — the version test is the point.**

```bash
npm run check
```

`version is semver and matches package.json` must pass.

**5. Commit and tag.**

```bash
git add package.json manifest.json
git commit -m "Release v<version>"
git tag v<version>
git push && git push --tags
```

The pre-push hook runs typecheck and tests again.

**6. Confirm CI.**

```bash
gh run list --limit 1
```

## Notes

- `dist/` is gitignored and never part of a release commit. CI builds it and uploads it as an artifact,
  so an installable build is downloadable from the run.
- Ask before pushing if the user hasn't already said to — pushing a tag is hard to walk back.
- Consider running `security-auditor` before a release, particularly if `src/content/overlay.ts`,
  `src/options.ts`, the provider layer or `manifest.json` changed since the last one.
