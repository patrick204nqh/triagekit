# Developer Experience Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Make one checkout's tests deterministic, typecheck the complete browser runtime, and expose one local command that enforces the same guarantees as CI.

**Architecture:** Keep the existing Node/CLI TypeScript project as the emitting build and add a non-emitting, Vite-compatible browser project beside it. Put test discovery policy in Vitest configuration and move build/Pages assertions from GitHub Actions into narrow Node helpers, then compose every check sequentially through `package.json`.

**Tech Stack:** Node.js 20+, TypeScript 6, Vitest 4, npm scripts, ES modules, GitHub Actions.

## Global Constraints

- Work only on `patrick/dx-hardening`, based on `main` after merge of PR #10.
- Preserve the self-contained, backend-free dashboard and all stable runtime/provider interfaces.
- Do not change generated Pages ownership, add a dev server, add formatting/linting, or repair README terminology in this change.
- Preserve Vitest's default excludes and additionally exclude `**/.worktrees/**`.
- Typecheck production runtime files with `ES2022`, `DOM`, `DOM.Iterable`, strict mode, bundler module resolution, and `noEmit`.
- Run verification steps sequentially; build-related commands share `dist-cli/**`, `dist/**`, and `site/app/index.html`.
- Never commit real repository names, credentials, AI attribution, or external scripts in the built dashboard.
- Use test-first development and commit after each independently reviewable task.

---

## File Structure

### Create

- `vitest.config.ts` — the single Vitest discovery boundary.
- `tsconfig.runtime.json` — non-emitting browser-runtime TypeScript project.
- `scripts/check-build.mjs` — build an example dashboard and enforce the self-contained HTML invariant.
- `scripts/check-pages.mjs` — rebuild the generic Pages dashboard and enforce tracked-artifact synchronization.
- `test/tooling/vitest-config.test.ts` — regression coverage for default and linked-worktree excludes.
- `test/tooling/check-build.test.ts` — unit coverage for build artifact assertions.
- `test/tooling/check-pages.test.ts` — unit coverage for Pages synchronization failure behavior.
- `test/tooling/developer-commands.test.ts` — contract coverage for npm command composition and CI delegation.

### Modify

- `package.json` — typecheck, build-check, Pages-check, ordinary-check, and release-check interfaces.
- `.github/workflows/ci.yml` — install dependencies and delegate verification to `npm run check`.
- `CONTRIBUTING.md` — make `npm run check` the contributor golden path.
- `src/runtime/dataset/artifact.ts` — preserve `Kind` instead of widening artifact identifiers to `string`.
- `src/runtime/session/triage-session.ts` — freeze copied filter state without widening its existing editing interface.
- `src/runtime/scoring/configured.ts` — accept readonly field catalogs.
- `src/runtime/scoring/score-model.ts` — validate readonly field catalogs.
- `src/runtime/shell/signal-editor.ts` — render readonly field catalogs.
- `src/runtime/shell/settings.ts` — cache and render readonly discovery results.
- `src/runtime/views/code-review/view.ts` — satisfy the `ViewModule` label contract.
- `src/runtime/views/code-security/code-scanning.ts` — satisfy the `ViewModule` label contract.
- `src/runtime/views/code-security/view.ts` — satisfy the `ViewModule` label contract.
- `site/app/index.html` — refresh the committed generic dashboard after runtime metadata changes.

## Task 1: Isolate Vitest Discovery

**Files:**

- Create: `vitest.config.ts`
- Create: `test/tooling/vitest-config.test.ts`

**Interfaces:**

- Produces: `testExclude: string[]`, imported by the tooling regression test.
- Preserves: the existing `npm test` command and Vitest's built-in exclude patterns.

- [ ] **Step 1: Write the failing configuration test**

Create `test/tooling/vitest-config.test.ts`:

```ts
import { configDefaults } from "vitest/config";
import { describe, expect, it } from "vitest";
import { testExclude } from "../../vitest.config";

describe("Vitest discovery", () => {
  it("preserves default excludes", () => {
    for (const pattern of configDefaults.exclude) {
      expect(testExclude).toContain(pattern);
    }
  });

  it("excludes repository-local linked worktrees", () => {
    expect(testExclude).toContain("**/.worktrees/**");
  });
});
```

- [ ] **Step 2: Run the test and verify that the missing configuration fails**

Run:

```bash
rtk npx vitest run test/tooling/vitest-config.test.ts
```

Expected: FAIL because `../../vitest.config` does not exist.

- [ ] **Step 3: Add the minimal Vitest configuration**

Create `vitest.config.ts`:

```ts
import { configDefaults, defineConfig } from "vitest/config";

export const testExclude = [
  ...configDefaults.exclude,
  "**/.worktrees/**",
];

export default defineConfig({
  test: {
    exclude: testExclude,
  },
});
```

- [ ] **Step 4: Run the focused test and the current checkout's suite**

Run:

```bash
rtk npx vitest run test/tooling/vitest-config.test.ts
rtk npm test
```

Expected: the focused test passes; the suite passes and reports only test files inside the active checkout.

- [ ] **Step 5: Verify linked-worktree paths are absent from Vitest's list**

From the repository root that contains `.worktrees/**`, run:

```bash
rtk npx vitest list
```

Expected: output contains no path segment matching `/.worktrees/`.

- [ ] **Step 6: Commit the discovery boundary**

```bash
rtk git add vitest.config.ts test/tooling/vitest-config.test.ts
rtk git commit -m "test: isolate vitest discovery"
```

## Task 2: Typecheck the Browser Runtime and Repair Exposed Contracts

**Files:**

- Create: `tsconfig.runtime.json`
- Modify: `package.json`
- Modify: `src/runtime/dataset/artifact.ts`
- Modify: `src/runtime/session/triage-session.ts`
- Modify: `src/runtime/scoring/configured.ts`
- Modify: `src/runtime/scoring/score-model.ts`
- Modify: `src/runtime/shell/signal-editor.ts`
- Modify: `src/runtime/shell/settings.ts`
- Modify: `src/runtime/views/code-review/view.ts`
- Modify: `src/runtime/views/code-security/code-scanning.ts`
- Modify: `src/runtime/views/code-security/view.ts`

**Interfaces:**

- Produces: `npm run typecheck:cli`, `npm run typecheck:runtime`, and sequential `npm run typecheck`.
- Changes `Artifact.id` to `Kind` and `Artifact.kinds` to `readonly Kind[]`.
- Preserves mutable `ListState` drafts while freezing copied session snapshots at runtime.
- Changes field-catalog consumers to `readonly FieldDef[]`.
- Changes discovery-result consumers to `readonly DiscoveryOption[]`.
- Preserves all runtime behavior; fixes are type-contract corrections plus required view labels.

- [ ] **Step 1: Add the runtime TypeScript project**

Create `tsconfig.runtime.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "noEmit": true
  },
  "include": ["src/runtime/**/*.ts"]
}
```

- [ ] **Step 2: Add the typecheck command contract**

Add these entries to `package.json` immediately after `build:cli`:

```json
"typecheck:cli": "tsc -p tsconfig.json --noEmit",
"typecheck:runtime": "tsc -p tsconfig.runtime.json",
"typecheck": "npm run typecheck:cli && npm run typecheck:runtime",
```

- [ ] **Step 3: Run the new boundary and capture the expected failures**

Run:

```bash
rtk npm run typecheck:runtime
```

Expected: FAIL with 15 diagnostics in four categories:

- readonly `FieldDef[]` incompatibilities;
- frozen `ListState.axes` incompatibility;
- `Artifact.id` widened to `string` before calls requiring `Kind`;
- four `ViewModule` declarations missing `label`.

If diagnostics differ, stop and compare the branch with commit `5676690` before changing types.

- [ ] **Step 4: Preserve domain identifiers and freeze session copies without widening them**

In `src/runtime/dataset/artifact.ts`, replace the mutable/widened interface with:

```ts
export interface Artifact {
  id: Kind;
  label: string;
  group: ArtifactGroup;
  kinds: readonly Kind[];
}
```

Do not make `ListState` readonly: `src/runtime/layout/toolbar/toolbar.ts` intentionally
uses it as a short-lived mutable draft before emitting a replacement state. Instead,
replace `frozenFilters` in `src/runtime/session/triage-session.ts` with:

```ts
const frozenFilters = (filters: ListState): ListState => {
  const axes: Record<string, string[]> = Object.fromEntries(
    Object.entries(filters.axes).map(([id, values]) => {
      const copiedValues = [...values];
      Object.freeze(copiedValues);
      return [id, copiedValues];
    }),
  );
  Object.freeze(axes);
  const snapshot: ListState = {
    sort: filters.sort,
    axes,
  };
  Object.freeze(snapshot);
  return snapshot;
};
```

This preserves the current editing type while ensuring the session owns and freezes
its copies. Do not add a cast from `readonly string[]` to `string[]`.

Do not add casts at the two `session.selectKind(a.id)` call sites; the stronger artifact type must make them valid.

- [ ] **Step 5: Make field-catalog consumers readonly**

In `src/runtime/scoring/configured.ts`, change:

```ts
getFields(kind: Kind): readonly FieldDef[];
```

In `src/runtime/scoring/score-model.ts`, change the validator signature to:

```ts
export function validateModel(
  model: ScoreModel,
  fields: readonly FieldDef[],
): string[] {
```

In `src/runtime/shell/signal-editor.ts`, use readonly fields in both declarations:

```ts
export interface SignalEditorOpts {
  name: string;
  signal: SignalSpec;
  fields: readonly FieldDef[];
  onChange(name: string, signal: SignalSpec): void;
  onRename(oldName: string, newName: string): void;
  onRemove(name: string): void;
}

function paramsHtml(
  signal: SignalSpec,
  fields: readonly FieldDef[],
): string {
```

No copies are required because these consumers only iterate, search, and map the arrays.

- [ ] **Step 6: Make discovery-result caching readonly**

In `src/runtime/shell/settings.ts`, change the cache, local result, and renderer parameter:

```ts
const discoverCache = new Map<string, readonly DiscoveryOption[]>();
```

```ts
let options: readonly DiscoveryOption[] = [];
```

```ts
function mountMultiSelect(
  list: HTMLElement,
  s: ProviderDeclaration,
  key: string,
  options: readonly DiscoveryOption[],
) {
```

The multiselect only filters and renders the options, so it must not demand a mutable provider result.

- [ ] **Step 7: Satisfy the view metadata contract**

Add the following labels without changing IDs or kinds:

```ts
// src/runtime/views/code-review/view.ts
export const changeRequestView: ViewModule = {
  id: "code-review",
  label: "Code review",
  kind: CHANGE_REQUEST,
};
export const issueView: ViewModule = {
  id: "code-review",
  label: "Issues",
  kind: ISSUE,
};
```

```ts
// src/runtime/views/code-security/code-scanning.ts
export const codeScanningView: ViewModule = {
  id: "code-scanning",
  label: "Code scanning",
  kind: CODE_SCANNING,
};
```

```ts
// src/runtime/views/code-security/view.ts
export const dependencyVulnView: ViewModule = {
  id: "code-security",
  label: "Code security",
  kind: DEPENDENCY_VULN,
};
```

- [ ] **Step 8: Run both TypeScript projects and focused runtime tests**

Run:

```bash
rtk npm run typecheck
rtk npx vitest run test/runtime test/session test/layout
```

Expected: both TypeScript projects pass; all selected runtime tests pass with no behavior changes.

- [ ] **Step 9: Run the full test suite**

Run:

```bash
rtk npm test
```

Expected: PASS with no tests discovered below `.worktrees/**`.

- [ ] **Step 10: Commit the runtime checking boundary**

```bash
rtk git add package.json tsconfig.runtime.json \
  src/runtime/dataset/artifact.ts \
  src/runtime/session/triage-session.ts \
  src/runtime/scoring/configured.ts \
  src/runtime/scoring/score-model.ts \
  src/runtime/shell/signal-editor.ts \
  src/runtime/shell/settings.ts \
  src/runtime/views/code-review/view.ts \
  src/runtime/views/code-security/code-scanning.ts \
  src/runtime/views/code-security/view.ts
rtk git commit -m "build: typecheck browser runtime"
```

## Task 3: Extract Cross-Platform Build Assertions

**Files:**

- Create: `scripts/check-build.mjs`
- Create: `scripts/check-pages.mjs`
- Create: `test/tooling/check-build.test.ts`
- Create: `test/tooling/check-pages.test.ts`
- Modify: `package.json`

**Interfaces:**

- Produces: `assertSelfContainedHtml(html: string): void`.
- Produces: `assertPagesInSync(changed: boolean): void`.
- Produces: `npm run check:build` and `npm run check:pages`.
- `check:build` owns example-dashboard generation after `build:cli`.
- `check:pages` owns generic Pages regeneration and tracked-file comparison.

- [ ] **Step 1: Write failing unit tests for artifact assertions**

Create `test/tooling/check-build.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { assertSelfContainedHtml } from "../../scripts/check-build.mjs";

describe("build smoke assertion", () => {
  it("accepts inline scripts", () => {
    expect(() =>
      assertSelfContainedHtml("<html><script>globalThis.ok = true</script></html>"),
    ).not.toThrow();
  });

  it("rejects external scripts", () => {
    expect(() =>
      assertSelfContainedHtml(
        '<html><script src="https://cdn.example.invalid/app.js"></script></html>',
      ),
    ).toThrow("external script");
  });
});
```

Create `test/tooling/check-pages.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { assertPagesInSync } from "../../scripts/check-pages.mjs";

describe("Pages artifact assertion", () => {
  it("accepts an unchanged artifact", () => {
    expect(() => assertPagesInSync(false)).not.toThrow();
  });

  it("rejects a stale artifact with corrective guidance", () => {
    expect(() => assertPagesInSync(true)).toThrow(
      "site/app/index.html is stale",
    );
  });
});
```

- [ ] **Step 2: Run the tests and verify missing modules fail**

Run:

```bash
rtk npx vitest run \
  test/tooling/check-build.test.ts \
  test/tooling/check-pages.test.ts
```

Expected: FAIL because both helper modules are missing.

- [ ] **Step 3: Implement the build smoke helper**

Create `scripts/check-build.mjs`:

```js
#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repo = resolve(import.meta.dirname, "..");
const output = resolve(repo, "dist/triage.html");

export function assertSelfContainedHtml(html) {
  if (/<script\b[^>]*\bsrc=["']https?:/i.test(html)) {
    throw new Error(
      "✗ build-smoke: built HTML references an external script — single-file invariant broken",
    );
  }
}

export function checkBuild() {
  execFileSync(
    process.execPath,
    [
      resolve(repo, "dist-cli/cli/index.js"),
      "build",
      "-c",
      resolve(repo, "triage.config.example.yml"),
    ],
    { cwd: repo, stdio: "inherit" },
  );
  let html;
  try {
    html = readFileSync(output, "utf8");
  } catch {
    throw new Error(`✗ build-smoke: expected ${output} — build produced nothing`);
  }
  assertSelfContainedHtml(html);
  console.log("✓ build-smoke: dist/triage.html is self-contained");
}

const isMain =
  process.argv[1] !== undefined
  && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isMain) {
  try {
    checkBuild();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
```

- [ ] **Step 4: Implement the Pages synchronization helper**

Create `scripts/check-pages.mjs`:

```js
#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repo = resolve(import.meta.dirname, "..");
const artifact = "site/app/index.html";

export function assertPagesInSync(changed) {
  if (changed) {
    throw new Error(
      `✗ pages-sync: ${artifact} is stale — commit the freshly generated result`,
    );
  }
}

export function checkPages() {
  execFileSync("npm", ["run", "build:pages"], {
    cwd: repo,
    stdio: "inherit",
  });
  const comparison = spawnSync(
    "git",
    ["diff", "--quiet", "--", artifact],
    { cwd: repo, stdio: "inherit" },
  );
  if (comparison.error) throw comparison.error;
  assertPagesInSync(comparison.status !== 0);
  console.log(`✓ pages-sync: ${artifact} matches a fresh generic build`);
}

const isMain =
  process.argv[1] !== undefined
  && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isMain) {
  try {
    checkPages();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
```

- [ ] **Step 5: Expose the two focused commands**

Add to `package.json`:

```json
"check:build": "npm run build:cli && node scripts/check-build.mjs",
"check:pages": "node scripts/check-pages.mjs",
```

- [ ] **Step 6: Run helper tests and actual build checks**

Run:

```bash
rtk npx vitest run \
  test/tooling/check-build.test.ts \
  test/tooling/check-pages.test.ts
rtk npm run check:build
rtk npm run check:pages
```

Expected:

- unit tests pass;
- example output is generated and reported self-contained;
- Pages output is rebuilt;
- `check:pages` fails only if the newly generated `site/app/index.html` needs to be committed.

If `check:pages` reports staleness because of Task 2's view labels, leave the generated
file unstaged until Task 5; do not weaken the assertion.

- [ ] **Step 7: Commit the reusable artifact checks**

```bash
rtk git add package.json \
  scripts/check-build.mjs \
  scripts/check-pages.mjs \
  test/tooling/check-build.test.ts \
  test/tooling/check-pages.test.ts
rtk git commit -m "build: add reusable artifact checks"
```

## Task 4: Unify Local and CI Verification

**Files:**

- Create: `test/tooling/developer-commands.test.ts`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**

- Produces: sequential `npm run check`.
- Produces: sequential `npm run check:release`.
- CI consumes exactly `npm run check`; it no longer owns duplicate verification snippets.

- [ ] **Step 1: Write the failing developer-command contract test**

Create `test/tooling/developer-commands.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const pkg = JSON.parse(
  readFileSync(resolve(root, "package.json"), "utf8"),
) as { scripts: Record<string, string> };
const ci = readFileSync(resolve(root, ".github/workflows/ci.yml"), "utf8");

describe("developer verification commands", () => {
  it("runs the complete ordinary check sequentially", () => {
    expect(pkg.scripts.check).toBe(
      "npm run typecheck && npm test && npm run lint:anon && npm run check:build && npm run check:pages",
    );
  });

  it("adds package validation only to the release check", () => {
    expect(pkg.scripts["check:release"]).toBe(
      "npm run check && npm run pack:smoke",
    );
  });

  it("delegates CI policy to the ordinary check", () => {
    expect(ci).toContain("run: npm run check");
    expect(ci).not.toContain("node dist-cli/cli/index.js build");
    expect(ci).not.toContain("git diff --quiet");
  });
});
```

- [ ] **Step 2: Run the test and verify missing command composition fails**

Run:

```bash
rtk npx vitest run test/tooling/developer-commands.test.ts
```

Expected: FAIL because `check`, `check:release`, and CI delegation are absent.

- [ ] **Step 3: Add the sequential top-level commands**

Add to `package.json` after the focused check scripts:

```json
"check": "npm run typecheck && npm test && npm run lint:anon && npm run check:build && npm run check:pages",
"check:release": "npm run check && npm run pack:smoke",
```

Do not use `&`, `concurrently`, or `Promise.all`; each command must finish before the next starts.

- [ ] **Step 4: Simplify CI to consume the package interface**

Replace the four named verification steps in `.github/workflows/ci.yml` with:

```yaml
      - name: Verify
        run: npm run check
```

Keep checkout, Node 20 setup, npm caching, and `npm ci` unchanged.

- [ ] **Step 5: Run the contract test and ordinary check**

Run:

```bash
rtk npx vitest run test/tooling/developer-commands.test.ts
rtk npm run check
```

Expected: the contract test passes. The ordinary check passes unless Task 2 intentionally made the committed Pages artifact stale; if so, verify that this is the only failure and keep the generated file for Task 5.

- [ ] **Step 6: Commit the shared verification interface**

```bash
rtk git add package.json .github/workflows/ci.yml \
  test/tooling/developer-commands.test.ts
rtk git commit -m "ci: share developer verification command"
```

## Task 5: Document and Verify the Golden Path

**Files:**

- Modify: `CONTRIBUTING.md`
- Modify: `site/app/index.html`

**Interfaces:**

- Documents `npm run check` as the ordinary pre-push contract.
- Documents `npm run check:release` for packaging-sensitive work.
- Produces a clean generated Pages artifact consistent with the runtime sources.

- [ ] **Step 1: Update the development setup commands**

In `CONTRIBUTING.md`, make the first verification command:

```markdown
rtk npm run check        # typecheck, test, anonymity lint, build smoke, Pages sync
```

Keep targeted commands documented below it:

```markdown
rtk npm test             # run only the Vitest suite
rtk npm run typecheck    # check CLI/config and browser runtime TypeScript
rtk npm run build:cli    # compile the CLI to dist-cli/
rtk npm run lint:anon    # run only the anonymity guardrail
rtk npm run check:release # ordinary checks plus tarball install/build smoke
```

- [ ] **Step 2: Update the contribution checklist**

Replace the current list of separate pre-PR commands with:

```markdown
- Before opening a PR, run `npm run check`. For packaging or release changes, run
  `npm run check:release`. Green CI is required to merge.
```

- [ ] **Step 3: Refresh the generated Pages dashboard**

Run:

```bash
rtk npm run build:pages
```

Expected: `site/app/index.html` contains the generic dashboard built from the current runtime. No external scripts or real repository identifiers are present.

- [ ] **Step 4: Commit documentation and the refreshed artifact**

```bash
rtk git add CONTRIBUTING.md site/app/index.html
rtk git commit -m "docs: document developer verification loop"
```

The commit must happen before the clean-state verification because `check:pages`
correctly treats any tracked-file difference as stale.

- [ ] **Step 5: Run the complete ordinary and release checks**

Run sequentially:

```bash
rtk npm run check
rtk npm run check:release
```

Expected: both commands exit zero. `npm run check` does not rewrite a different Pages artifact on its second build.

- [ ] **Step 6: Confirm test discovery and generated-file stability**

Run:

```bash
rtk npx vitest list
rtk git diff --exit-code -- site/app/index.html
rtk git diff --check
```

Expected:

- no listed test path contains `/.worktrees/`;
- the Pages artifact is unchanged after a fresh build;
- no whitespace errors are reported.

- [ ] **Step 7: Confirm repository security invariants**

Run:

```bash
rtk npm run lint:anon
rtk grep -n 'src="http' site/app/index.html
```

Expected: anonymity lint passes and `grep` prints no matches.

- [ ] **Step 8: Review the final branch**

Run:

```bash
rtk git status --short
rtk git log --oneline origin/main..HEAD
rtk git diff --stat origin/main...HEAD
```

Expected:

- the worktree is clean;
- the branch contains the design/spec commit followed by the five scoped implementation commits;
- the diff contains only the files named in this plan.
