# Releasing

Releases are published to npm by `.github/workflows/release.yml` when a `v*` tag is pushed.
Publishing happens **only in CI** (provenance requires GitHub Actions OIDC) — never run
`npm publish` locally.

## Steps

1. Ensure `main` is green and the working tree is clean.
2. Verify a real install works end to end:
   ```bash
   npm run pack:smoke
   ```
3. Move the `CHANGELOG.md` `Unreleased` notes into a new dated version section.
4. Bump the version and tag (this also commits the version bump):
   ```bash
   npm version <patch|minor|major>   # 0.x: minor = features, patch = fixes
   git push && git push --tags
   ```
5. The `release` workflow runs the test/lint/build/pack-smoke gates, then
   `npm publish --provenance`. Watch the run; the package appears on npm with a
   provenance attestation.

## First release (0.1.0)

`package.json` is already at `0.1.0`. After `pack:smoke` passes, either tag `v0.1.0`
(`git tag v0.1.0 && git push --tags`) or trigger the `release` workflow manually
(`workflow_dispatch`). Requires the `NPM_TOKEN` repo secret to be set.
