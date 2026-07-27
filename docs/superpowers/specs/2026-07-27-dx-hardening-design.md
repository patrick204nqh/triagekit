# Developer Experience Hardening Design

**Date:** 2026-07-27  
**Status:** Approved  
**Branch:** `patrick/dx-hardening`  
**Base:** `main` after merge of PR #10 (`runtime-architecture-deepening`)

## Summary

Triagekit is easy to install and conceptually small, but its local development loop does
not currently enforce the same guarantees as CI. The most important gaps are:

1. Vitest discovers tests inside repository-local linked worktrees, making the root test
   run slower and allowing unrelated branches to affect its result.
2. The browser runtime under `src/runtime/**` is bundled by Vite but is not checked by
   `tsc`; the current TypeScript project includes only the CLI, config, and Vite code.
3. Contributors must remember a collection of separate commands, while CI maintains its
   own copy of the verification sequence.

This change introduces explicit test discovery boundaries, a browser-runtime TypeScript
project, and one sequential local/CI verification command. It intentionally does not
redesign generated Pages artifact handling or add a development server.

## Goals

- A root `npm test` run considers only tests owned by the current checkout.
- All production TypeScript, including `src/runtime/**`, receives strict static checking.
- A contributor can run one command before pushing and get the same core result as CI.
- CI delegates verification policy to package scripts instead of duplicating it in YAML.
- Verification remains deterministic and sequential.
- Existing build output, runtime behavior, package contents, and browser compatibility
  remain unchanged.

## Non-goals

- Stop tracking `site/app/index.html` or redesign the Pages publishing workflow.
- Add watch mode, a local development server, formatting, or a general-purpose linter.
- Fix README terminology and stale examples.
- Change application architecture or public provider interfaces.
- Add release-only packaging checks to every ordinary CI run.

Those remain useful follow-up changes, but combining them here would make the first DX
change harder to review and diagnose.

## Considered approaches

### A. Explicit configuration and shared verification scripts — recommended

Add a Vitest configuration, a browser-runtime TypeScript configuration, and named package
scripts that both contributors and CI call.

This approach makes each boundary visible, testable, and reusable. It adds a small amount
of configuration but directly prevents the observed failures.

### B. Minimal package-script aliases

Add a single shell-style `check` command while leaving test discovery, TypeScript scope,
and CI YAML mostly unchanged.

This is faster to introduce but does not protect the runtime or prevent linked-worktree
test leakage. It would improve ergonomics without improving confidence.

### C. Broader development-tooling redesign

Combine the three fixes with Pages artifact removal, a Vite development loop, formatting,
and documentation cleanup.

This could produce a more polished end state, but it mixes independent risks and obscures
which change improves or breaks the contributor workflow.

## Design

### 1. Bound Vitest discovery to the active checkout

Add `vitest.config.ts` using Vitest's configuration API. Preserve Vitest's default exclude
patterns and append:

```text
**/.worktrees/**
```

The pattern is intentionally independent of the worktree names currently present. It
also handles nested repository-local worktree directories created in the future.

The normal `npm test` interface remains unchanged.

### 2. Typecheck the browser runtime with browser-appropriate semantics

Keep `tsconfig.json` as the emitting Node/CLI project so `npm run build:cli` and published
CLI output retain their current behavior.

Add `tsconfig.runtime.json` for non-emitting validation of the browser application:

- include `src/runtime/**`;
- use `strict` checking;
- use `ES2022`, `DOM`, and `DOM.Iterable` libraries;
- use ES module plus bundler-style resolution, matching Vite's extensionless imports;
- set `noEmit: true`;
- retain `skipLibCheck` so third-party declaration noise does not dominate application
  checks.

Files imported by the runtime, such as shared config types, are checked through the same
program. Tests are not included in this project; Vitest remains responsible for compiling
tests. A later change may add a dedicated test TypeScript project if that proves valuable.

Expose three scripts:

- `typecheck:cli`: validate the existing CLI project without emitting;
- `typecheck:runtime`: validate the browser-runtime project;
- `typecheck`: run both sequentially.

`build:cli` remains the command that emits `dist-cli/**`.

### 3. Make verification policy a package-level interface

Add named checks for the guarantees currently expressed inline in CI:

- `check:build`: build the CLI, build an example dashboard, assert the HTML exists, and
  reject external script references;
- `check:pages`: rebuild the generic Pages dashboard and fail when
  `site/app/index.html` differs from the tracked artifact;
- `check`: run typechecking, unit tests, anonymity lint, build smoke, and Pages sync
  sequentially;
- `check:release`: run `check`, then the package smoke test.

Small cross-platform Node scripts should hold assertions that are currently shell snippets.
The package scripts remain the public contributor interface; helper scripts may be split
according to one responsibility each.

The exact sequence for `check` is:

```text
typecheck
→ test
→ lint:anon
→ check:build
→ check:pages
```

The sequence must not be parallelized. Both build checks write generated directories, and
parallel execution can create transient failures or verify the wrong artifact.

`check:pages` is allowed to rewrite `site/app/index.html` before reporting that it was
stale. This matches current CI behavior and leaves the corrective artifact available for
the developer to inspect and commit.

### 4. Delegate CI to the shared command

Replace the duplicated test, anonymity, build-smoke, and Pages-sync steps in
`.github/workflows/ci.yml` with dependency installation followed by:

```bash
npm run check
```

GitHub Actions continues to select Node 20 and install with `npm ci`. Release workflow
behavior remains unchanged. `check:release` is primarily a maintainer/pre-release local
command unless a future release-workflow change adopts it.

### 5. Document the golden path

Update `CONTRIBUTING.md` so the primary pre-push instruction is `npm run check`, with
`npm run check:release` documented for packaging-sensitive work. Individual commands stay
documented for targeted iteration and debugging.

## Failure behavior

- A linked-worktree test must never appear in `vitest list` or an ordinary test run from
  the repository root.
- Type errors identify whether they belong to the CLI or browser runtime through the
  named subcommand.
- Build-smoke failures state whether compilation, dashboard generation, output existence,
  or the single-file invariant failed.
- Pages-sync failures name `site/app/index.html` and tell the contributor to commit the
  freshly generated result.
- Every helper exits non-zero on failure so npm and CI propagate the result.

## Testing strategy

Implementation follows test-first development:

1. Add a tooling regression test proving the worktree exclude is present while Vitest's
   defaults remain active.
2. Run the new runtime TypeScript project before fixing any diagnostics it exposes; treat
   each diagnostic as evidence of the previously unchecked boundary.
3. Test build-smoke and Pages-sync helpers through exported pure assertions where
   practical, using temporary files or injected command results rather than mutating real
   repository state in unit tests.
4. Verify command composition from `package.json` and then run the actual commands
   sequentially.
5. From a checkout containing `.worktrees/**`, confirm `vitest list` contains no paths
   beneath that directory.
6. Run `npm run check` locally and confirm the simplified CI workflow invokes the same
   command.
7. Run `npm run check:release` before the PR is declared complete.

## Acceptance criteria

- `npm test` passes and reports only tests under the active checkout.
- `npm run typecheck` passes and covers both CLI/config code and all production runtime
  TypeScript.
- `npm run check` passes on a clean checkout and exercises every current CI invariant.
- A deliberately stale Pages artifact makes `npm run check:pages` fail with actionable
  output.
- An HTML file containing an external script reference makes the build assertion fail.
- `.github/workflows/ci.yml` invokes `npm run check` rather than reimplementing its steps.
- `npm run check:release` completes the ordinary checks and package smoke test.
- No runtime bundle behavior or public API changes are introduced.

## Risks and mitigations

### Runtime typechecking reveals existing diagnostics

This is expected evidence, not a reason to weaken the project. Fix narrow, behavior-neutral
typing defects in the same PR. If diagnostics require architectural or behavioral changes,
document and defer those changes rather than broadening this PR silently.

### Shared scripts drift from their helper implementations

Keep npm scripts declarative and helpers narrowly scoped. Unit-test the assertions and use
the actual top-level commands as final verification.

### Pages sync remains mutation-based

That is current repository behavior and is explicitly retained for this scope. A later PR
can make generated-artifact checking side-effect-free or stop tracking the artifact.

### Platform-specific shell behavior

Move non-trivial assertions into Node scripts and avoid relying on Bash-only conditionals
inside `package.json`.

## Follow-up opportunities

After this change lands, the recommended order is:

1. correct README imports and Provider terminology;
2. decide whether `site/app/index.html` should remain tracked;
3. add a focused watch/development command;
4. introduce formatting and linting only after the project chooses an enforceable style.
