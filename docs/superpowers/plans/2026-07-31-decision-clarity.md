# Decision Clarity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Insights scope truthful, give each Kind decision-focused columns, explain every priority score, and summarize only Handoff work that is ready.

**Architecture:** Keep the provider → Cached Dataset → derivation → presentation pipeline. Add one Insights-specific toolbar projection, move complete table-column ownership into Kind renderers, attach a unified score explanation during derivation, and reuse one Handoff eligibility predicate in both planning and toolbar counts.

**Tech Stack:** TypeScript, browser-native DOM APIs, vanilla CSS, Vitest/jsdom, Vite 8, `vite-plugin-singlefile`.

## Global Constraints

- Implement the approved order: global Insights presentation → Kind-owned columns → unified priority explanation → actionable Handoff summary.
- Chrome remains the supported browser baseline.
- Add no runtime dependency, UI framework, table library, state manager, or enrichment framework.
- Preserve provider behavior, Cached Dataset semantics, scoring formulas, Triage Actions, Handoff transitions, and session persistence.
- A production build must contain exactly one self-contained `dist/triage.html` with no external script, stylesheet, or module-preload dependency.
- Preserve keyboard navigation, visible focus, reduced motion, semantic P0–P3 text, HTML escaping, and Markdown sanitization.
- Do not modify or commit `.impeccable/critique/`.

## File Structure

- Create `src/runtime/layout/table/columns.ts`: shared repository, title, and priority column builders.
- Modify `src/runtime/layout/toolbar/toolbar.ts`: explicit global Insights scope presentation.
- Modify `src/runtime/shell/app-shell.ts`: project global scope counts and consume derived score explanations/Handoff readiness.
- Modify `src/runtime/layout/table/kind-renderer.ts`: require complete Kind-owned columns and carry derived explanations.
- Modify `src/runtime/layout/table/triage-table.ts`: render only the supplied column contract and matching skeletons.
- Modify `src/runtime/layout/table/detail-panel.ts`: pass complete renderer columns to the table.
- Modify `src/runtime/views/code-security/view.ts`, `src/runtime/views/code-security/code-scanning.ts`, and `src/runtime/views/code-review/view.ts`: declare the approved decision columns.
- Modify scoring modules under `src/runtime/scoring/`: produce one built-in/configured explanation contract from the same scoring inputs.
- Modify `src/runtime/catalog/types.ts`, `src/runtime/catalog/runtime-catalog.ts`, and ready Kind declarations: require a built-in explanation function.
- Modify `src/runtime/layout/table/score-breakdown.ts` and `src/runtime/handoff/projector.ts`: render/project the unified explanation union.
- Modify `src/runtime/handoff/queue.ts`, `src/runtime/handoff/controller.ts`, `src/runtime/layout/handoff/selection-controls.ts`: share transfer eligibility and show ready count.
- Update only the corresponding `test/` files named in each task.

---

### Task 1: Make Insights scope and count truthful

**Files:**
- Modify: `src/runtime/layout/toolbar/toolbar.ts`
- Modify: `src/runtime/shell/app-shell.ts`
- Modify: `src/runtime/theme/tokens.css`
- Test: `test/layout/toolbar.test.ts`
- Test: `test/shell/app-shell.test.ts`

**Interfaces:**
- Produces: `InsightScopeSummary` with `providerLabel`, `repositoryCount`, and `openItemCount`.
- Consumes: the active Provider Connection's complete `DatasetSnapshot.items`.
- Preserves: the existing `onViewChange` and provider-switch callbacks.

- [ ] **Step 1: Add failing toolbar tests for Insights presentation**

Add this type fixture and tests to `test/layout/toolbar.test.ts`:

```ts
const insightScope = {
  providerLabel: "GitHub",
  repositoryCount: 3,
  openItemCount: 12,
};

it("renders global Insights scope and count without list controls", () => {
  const host = document.createElement("div");
  renderToolbar(host, props({ activeView: "insights", insightScope }));

  expect(host.querySelector(".tb-count")?.textContent?.trim()).toBe("12");
  expect(host.querySelector("[data-insight-scope]")?.textContent)
    .toContain("GitHub · 3 repositories · all supported surfaces");
  expect(host.querySelector("[data-repo-tabs]")).toBeNull();
  expect(host.querySelector("[data-tb-filter]")).toBeNull();
  expect(host.querySelector("[data-tb-sort]")).toBeNull();
  expect(host.querySelector("[data-handoff-selection]")).toBeNull();
});

it("uses singular repository copy in Insights", () => {
  const host = document.createElement("div");
  renderToolbar(host, props({
    activeView: "insights",
    insightScope: { ...insightScope, repositoryCount: 1 },
  }));
  expect(host.querySelector("[data-insight-scope]")?.textContent)
    .toContain("1 repository");
});
```

- [ ] **Step 2: Run the toolbar tests and verify failure**

Run:

```bash
rtk npm test -- test/layout/toolbar.test.ts
```

Expected: FAIL because `ToolbarProps` has no `insightScope` and Insights still renders `.fbar` list controls.

- [ ] **Step 3: Add the toolbar scope contract and minimal branch**

In `toolbar.ts`, add:

```ts
export interface InsightScopeSummary {
  readonly providerLabel: string;
  readonly repositoryCount: number;
  readonly openItemCount: number;
}

export interface ToolbarProps {
  // existing fields stay unchanged
  insightScope?: InsightScopeSummary;
}
```

Compute the tab count from `p.insightScope.openItemCount` when `activeView === "insights"`. After rendering the shared tab/provider row, render this instead of `.fbar`:

```ts
const insightScopeHtml = p.insightScope
  ? `<div class="insight-scope" data-insight-scope>${esc(p.insightScope.providerLabel)} · ${p.insightScope.repositoryCount} ${p.insightScope.repositoryCount === 1 ? "repository" : "repositories"} · all supported surfaces</div>`
  : "";
```

Return after wiring view tabs and the provider switch so no repository/filter/sort/Handoff DOM or listeners are created in Insights.

- [ ] **Step 4: Project scope from the same snapshot used by Insights**

In `app-shell.ts`, add a pure local projection:

```ts
const insightScope = (): InsightScopeSummary => {
  const items = activeItems();
  const provider = catalog.provider(currentProvider());
  return {
    providerLabel: provider?.label ?? currentProvider(),
    repositoryCount: new Set(items.map((item) => item.location)).size,
    openItemCount: items.length,
  };
};
```

Pass it from `buildNav()` only when `currentView() === "insights"`. Do not apply `currentRepository()` or `currentFilters()`.

- [ ] **Step 5: Add the shell-level consistency test**

Extend the existing Insights test in `test/shell/app-shell.test.ts` after `clickView("Insights")`:

```ts
const scope = document.querySelector("[data-insight-scope]");
expect(scope?.textContent).toContain("all supported surfaces");
expect(document.querySelector("[data-tb-filter]")).toBeNull();
expect(document.querySelector("[data-tb-sort]")).toBeNull();
expect(document.querySelector("[data-handoff-selection]")).toBeNull();
expect(document.querySelector(".tb-count")?.textContent?.trim()).toBe("1");
```

Add a second shell test proving the hidden state survives the round trip:

```ts
history.replaceState(null, "", "/?artifact=dependency-vuln&repo=acme-corp%2Fweb&severity=critical");
bootstrap(configWithoutInsights);
await flush();
clickView("Insights");
await flush();
clickView("List");
await flush();
expect(parseSessionQuery(location.search)).toMatchObject({
  kind: "dependency-vuln",
  view: "list",
  repository: "acme-corp/web",
  axes: { severity: ["critical"] },
});
```

- [ ] **Step 6: Style the read-only scope line**

Add a compact `.insight-scope` rule beside `.fbar` rules in `tokens.css`: mono register, muted text, existing horizontal padding, one bottom border, no pill or decorative card. Add a narrow-screen wrap rule inside the existing responsive block.

- [ ] **Step 7: Run focused tests**

Run:

```bash
rtk npm test -- test/layout/toolbar.test.ts test/shell/app-shell.test.ts
```

Expected: PASS, including existing Insight route and refresh-race tests.

- [ ] **Step 8: Commit Task 1**

```bash
rtk git add src/runtime/layout/toolbar/toolbar.ts src/runtime/shell/app-shell.ts src/runtime/theme/tokens.css test/layout/toolbar.test.ts test/shell/app-shell.test.ts
rtk git commit -m "fix(insights): show truthful global scope"
```

### Task 2: Give each Kind complete decision columns

**Files:**
- Create: `src/runtime/layout/table/columns.ts`
- Modify: `src/runtime/layout/table/kind-renderer.ts`
- Modify: `src/runtime/layout/table/triage-table.ts`
- Modify: `src/runtime/layout/table/detail-panel.ts`
- Modify: `src/runtime/views/code-security/view.ts`
- Modify: `src/runtime/views/code-security/code-scanning.ts`
- Modify: `src/runtime/views/code-review/view.ts`
- Modify: `src/runtime/catalog/runtime-catalog.ts`
- Modify: `src/runtime/shell/app-shell.ts`
- Test: `test/layout/triage-table.test.ts`
- Test: `test/views/code-security.test.ts`
- Test: `test/views/code-scanning.test.ts`
- Test: `test/views/code-review.test.ts`
- Test: `test/catalog/runtime-catalog.test.ts`

**Interfaces:**
- Produces: required `KindRenderer.columns: readonly TableColumn[]`.
- Produces: `repositoryColumn()`, `titleColumn(label)`, and `priorityColumn()` helpers.
- Consumes: `ScoredItem` and existing escaped Kind detail readers.

- [ ] **Step 1: Write failing complete-column tests**

Add exact header expectations:

```ts
expect(dependencyVulnRenderer.columns.map((column) => column.header))
  .toEqual(["Repository", "Dependency", "Severity", "Fix", "Priority"]);

expect(codeScanningRenderer.columns.map((column) => column.header))
  .toEqual(["Repository", "Finding", "Rule", "Severity", "State", "Priority"]);

expect(changeRequestRenderer.columns.map((column) => column.header))
  .toEqual(["Repository", "Title", "#", "Author", "Priority"]);
expect(issueRenderer.columns.map((column) => column.header))
  .toEqual(["Repository", "Title", "#", "Author", "Priority"]);
```

In `test/layout/triage-table.test.ts`, assert the rendered table contains no standalone `Signal`, `Score`, or `Tier` headers and that header/body cell counts match.

- [ ] **Step 2: Run focused tests and verify failure**

```bash
rtk npm test -- test/layout/triage-table.test.ts test/views/code-security.test.ts test/views/code-scanning.test.ts test/views/code-review.test.ts
```

Expected: FAIL because shared columns are still hard-coded.

- [ ] **Step 3: Define the complete column contract and shared builders**

Move the column shape into `kind-renderer.ts`:

```ts
export interface TableColumn {
  readonly header: string;
  readonly className?: string;
  readonly cell: (item: ScoredItem) => string;
}

export interface KindRenderer {
  readonly kind: Kind;
  readonly columns: readonly TableColumn[];
  readonly detail?: (item: ScoredItem, ctx: DetailCtx) => DetailView;
}
```

Create `columns.ts` with builders that escape repository/title and use the existing tier class:

```ts
export const repositoryColumn = (): TableColumn => ({
  header: "Repository",
  cell: (item) => esc(item.location),
});

export const titleColumn = (header: string): TableColumn => ({
  header,
  cell: (item) => `<button type="button" class="alert-row-open" data-open-detail>${esc(item.title)}</button>`,
});

export const priorityColumn = (): TableColumn => ({
  header: "Priority",
  className: "priority-col",
  cell: (item) => `<span class="tier tier-${item.tier}">${item.tier}</span><span class="priority-score">· ${item.score}</span>`,
});
```

- [ ] **Step 4: Make the shared table render only supplied columns**

Change `tableHtml(rows, columns, selection)` to build every `<th>` and `<td>` from `columns`. Apply `className` to both header and cells. Keep the queue column, row `data-i`, and accessible region unchanged.

Change `renderTableSkeleton(root, columns)` to render the supplied headers and one skeleton cell per column. `app-shell.ts` passes `catalog.readyKind(active.kinds[0])!.renderer.columns` during hydration.

- [ ] **Step 5: Declare the approved columns in each renderer**

Use shared builders plus Kind-specific cells:

- Dependencies: repository, dependency title, severity, fix version/state, priority.
- Code scanning: repository, finding title, `ruleId`, severity, state, priority. Do not render file location.
- Change requests/issues: repository, title, number, author, priority.

All provider-derived strings pass through `esc`. The dependency Fix cell returns `fixVersion`, `Available`, or `No fix` in that order.

- [ ] **Step 6: Enforce non-empty ready-Kind columns**

In `validateReadyKind`, add:

```ts
if (!Array.isArray(kind.renderer.columns) || kind.renderer.columns.length === 0) {
  throw new CatalogError(
    `kind "${kind.kind}": renderer must declare at least one column`,
  );
}
```

Add a catalog test that clones a ready Kind with `renderer: { ...renderer, columns: [] }` and expects `/at least one column/`.

- [ ] **Step 7: Update test-only renderers and verify table interaction**

Every `KindRenderer` fixture supplies at least `titleColumn("Title")`. Verify the title control still opens the modal detail, queue selection still stops propagation, and skeleton header/body counts match.

- [ ] **Step 8: Run focused tests**

```bash
rtk npm test -- test/layout/triage-table.test.ts test/views/code-security.test.ts test/views/code-scanning.test.ts test/views/code-review.test.ts test/catalog/runtime-catalog.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit Task 2**

```bash
rtk git add src/runtime/layout/table src/runtime/views/code-security src/runtime/views/code-review src/runtime/catalog/runtime-catalog.ts src/runtime/shell/app-shell.ts test/layout/triage-table.test.ts test/views/code-security.test.ts test/views/code-scanning.test.ts test/views/code-review.test.ts test/catalog/runtime-catalog.test.ts
rtk git commit -m "refactor(table): let kinds own decision columns"
```

### Task 3: Produce unified priority explanations during scoring

**Files:**
- Modify: `src/runtime/scoring/score-model.ts`
- Modify: `src/runtime/scoring/configured.ts`
- Modify: `src/runtime/scoring/severity-scorer.ts`
- Modify: `src/runtime/scoring/dependency-vuln.ts`
- Modify: `src/runtime/scoring/code-scanning.ts`
- Modify: `src/runtime/scoring/review.ts`
- Modify: `src/runtime/catalog/types.ts`
- Modify: `src/runtime/catalog/runtime-catalog.ts`
- Modify: `src/runtime/kinds/dependency-vuln.ts`
- Modify: `src/runtime/kinds/code-scanning.ts`
- Modify: `src/runtime/kinds/change-request.ts`
- Modify: `src/runtime/kinds/issue.ts`
- Modify: `src/runtime/core/derivation.ts`
- Modify: `src/runtime/layout/table/kind-renderer.ts`
- Test: `test/scoring/configured.test.ts`
- Test: `test/scoring/severity-scorer.test.ts`
- Test: `test/scoring/dependency-vuln.test.ts`
- Test: `test/scoring/code-scanning.test.ts`
- Test: `test/scoring/review.test.ts`
- Test: `test/core/derivation.test.ts`
- Test: `test/catalog/runtime-catalog.test.ts`

**Interfaces:**
- Produces: discriminated `ScoreExplanation` union.
- Produces: required `ReadyKindDeclaration.explainBuiltInScore(item, now)`.
- Produces: `scoreAndTier(..., now)` result containing `score`, `tier`, and `explanation`.
- Preserves: existing numeric scorer exports and formulas.

- [ ] **Step 1: Add failing configured/built-in explanation tests**

Extend `test/scoring/configured.test.ts`:

```ts
import type { ScoreContext } from "../../src/runtime/scoring/configured";

const context = (model: ScoreModel | null): ScoreContext => ({
  getModel: () => model,
  getFields: () => fields,
  getThresholds: () => DEFAULT_THRESHOLDS,
});

it("returns configured evidence with the configured score", () => {
  const result = scoreAndTier(item, context(validModel), runtimeCatalog, 0);
  expect(result.explanation.source).toBe("configured");
  expect(result.explanation.score).toBe(result.score);
});

it("returns built-in factors with the built-in score", () => {
  const result = scoreAndTier(item, context(null), runtimeCatalog,
    Date.parse("2026-01-01T00:00:00Z"));
  expect(result.explanation.source).toBe("built-in");
  expect(result.explanation.score).toBe(result.score);
  if (result.explanation.source === "built-in") {
    expect(result.explanation.factors.map((factor) => factor.label))
      .toEqual(expect.arrayContaining(["Severity", "CVSS", "Fix", "Scope", "Age"]));
  }
});
```

- [ ] **Step 2: Run scoring tests and verify failure**

```bash
rtk npm test -- test/scoring/configured.test.ts test/scoring/dependency-vuln.test.ts test/scoring/code-scanning.test.ts test/scoring/review.test.ts
```

Expected: FAIL because `scoreAndTier` returns no explanation.

- [ ] **Step 3: Define the unified explanation types**

In `score-model.ts`, keep the configured signal shape and define:

```ts
export interface BuiltInScoreFactor {
  readonly label: string;
  readonly raw: string | number | boolean | null;
  readonly contribution: number;
  readonly reason: string;
}

export type ScoreExplanation =
  | {
      readonly source: "configured";
      readonly score: number;
      readonly signals: Record<string, {
        readonly from: string;
        readonly raw: unknown;
        readonly value: number;
      }>;
    }
  | {
      readonly source: "built-in";
      readonly score: number;
      readonly factors: readonly BuiltInScoreFactor[];
    };
```

`explainScoreModel` returns `source: "configured"`.

- [ ] **Step 4: Add the ready-Kind explainer contract**

In `catalog/types.ts`:

```ts
export type Scorer = (item: TriageItem, now?: number) => number;

export type BuiltInScoreExplainer = (
  item: TriageItem,
  now: number,
) => Extract<ScoreExplanation, { source: "built-in" }>;
```

Add required `explainBuiltInScore` to `ReadyKindDeclaration`. Validate it beside `builtInScorer` in `runtime-catalog.ts`, and add a missing-explainer catalog test.

- [ ] **Step 5: Make severity scoring share one factor calculation**

In `severity-scorer.ts`, extract a pure calculation accepting `now`:

```ts
export interface SeverityScoring<D> {
  readonly score: (item: TriageItem<D>, now?: number) => number;
  readonly explain: (
    item: TriageItem<D>,
    now: number,
  ) => Extract<ScoreExplanation, { source: "built-in" }>;
}
```

Both functions consume one internal `calculate(item, now)` result containing severity base, adjustment factors, age contribution, and final rounded/clamped score. Do not duplicate constants between `score` and `explain`.

Dependency factors are Severity, CVSS, Fix, Scope, and Age. Code-scanning factors are Severity, State, and Age.

- [ ] **Step 6: Give review scoring the same shared calculation**

Extract the existing base, label, age, vulnerability relation, review activity, and bot dampening values into one internal calculation. Export the existing `reviewScore` plus `explainReviewScore`. Accept `now` so score and explanation use the same age value.

- [ ] **Step 7: Register explainers on every ready Kind**

Wire dependency and code-scanning explainers directly. Both change-request and issue declarations use `explainReviewScore`. Update test catalog fixtures with a minimal built-in explanation:

```ts
explainBuiltInScore: (_item, _now) => ({
  source: "built-in",
  score: 0,
  factors: [],
}),
```

- [ ] **Step 8: Attach explanations during derivation**

Change `scoreAndTier` to accept `now = Date.now()` and return:

```ts
export interface Scored {
  readonly score: number;
  readonly tier: Tier;
  readonly explanation: ScoreExplanation;
}
```

For configured scoring, evaluate once with `explainScoreModel` and derive score/tier from that result. For built-in scoring, call the scorer and explainer with the same `now`; if the explainer throws or disagrees on score, return a built-in fallback with the calculated score and empty factors.

Extend `ScoredItem` with `readonly explanation?: ScoreExplanation` so direct test fixtures remain concise while all production-derived rows contain it. `derive()` spreads the complete scoring result onto the item.

- [ ] **Step 9: Verify calculation/explanation consistency**

Add fixed-time tests for dependency, code scanning, and review asserting:

```ts
expect(explanation.score).toBe(score(item, now));
expect(explanation.factors.reduce(
  (total, factor) => total + factor.contribution,
  0,
)).toBe(explanation.score);
```

For rounded or clamped calculations, make the final Age, Base, or Clamp factor absorb the delta so contributions sum exactly to the displayed integer.

- [ ] **Step 10: Run scoring, catalog, and derivation tests**

```bash
rtk npm test -- test/scoring test/catalog/runtime-catalog.test.ts test/kinds/manifests.test.ts test/core/derivation.test.ts
```

Expected: PASS with unchanged numeric scores and tiers.

- [ ] **Step 11: Commit Task 3**

```bash
rtk git add src/runtime/scoring src/runtime/catalog src/runtime/kinds src/runtime/core/derivation.ts src/runtime/layout/table/kind-renderer.ts test/scoring test/catalog/runtime-catalog.test.ts test/kinds/manifests.test.ts test/core/derivation.test.ts
rtk git commit -m "feat(scoring): explain built-in priority factors"
```

### Task 4: Render and hand off unified priority evidence

**Files:**
- Modify: `src/runtime/shell/app-shell.ts`
- Modify: `src/runtime/adapters/dom-view.ts`
- Modify: `src/runtime/layout/table/kind-renderer.ts`
- Modify: `src/runtime/layout/table/score-breakdown.ts`
- Modify: `src/runtime/handoff/projector.ts`
- Test: `test/layout/score-breakdown.test.ts`
- Test: `test/handoff/projector.test.ts`
- Test: `test/shell/app-shell-breakdown.test.ts`

**Interfaces:**
- Consumes: `ScoredItem.explanation` from Task 3.
- Produces: `scoreExplain(item)` as a read-only lookup, never a second scoring pass.
- Preserves: configured factor tables and `HandoffEvidenceV1` shape.

- [ ] **Step 1: Add failing rendering tests for both explanation variants**

Replace the configured fixture in `test/layout/score-breakdown.test.ts` with `source: "configured"`. Add:

```ts
it("renders built-in factors without configuration guidance", () => {
  const host = document.createElement("div");
  renderScoreBreakdown(host, item, {
    source: "built-in",
    score: 142,
    factors: [{
      label: "Severity",
      raw: "critical",
      contribution: 100,
      reason: "critical severity",
    }],
  });
  expect(host.textContent).toContain("Built-in priority");
  expect(host.textContent).toContain("critical severity");
  expect(host.textContent).not.toContain("Configure scoring");
});
```

Retain a null/undefined fallback test that shows only source, score, and tier without throwing.

- [ ] **Step 2: Run focused tests and verify failure**

```bash
rtk npm test -- test/layout/score-breakdown.test.ts test/handoff/projector.test.ts test/shell/app-shell-breakdown.test.ts
```

Expected: FAIL because rendering assumes every explanation has `.signals`.

- [ ] **Step 3: Render the discriminated union**

In `score-breakdown.ts`:

- Configured: preserve the existing normalized signal table and total.
- Built-in with factors: render `Built-in priority · score N · Pn` and a compact factor list using each factor's `reason` and signed contribution.
- Missing/empty built-in factors: render `Built-in score · N · Pn` only.

Escape labels, raw values, and reasons.

- [ ] **Step 4: Remove app-shell rescoring**

Replace the policy/model parsing in `scoreExplain` with:

```ts
const scoreExplain = (item: ScoredItem): ScoreExplanation | null =>
  item.explanation ?? null;
```

Remove now-unused `explainScoreModel` and `validateModel` imports from `app-shell.ts`. The DOM adapter interface remains unchanged.

- [ ] **Step 5: Project both explanation variants into Handoff evidence**

In `handoff/projector.ts`, add one pure mapper:

```ts
const explanationEvidence = (
  explanation: ScoreExplanation | null,
): HandoffEvidenceV1[] | undefined => {
  if (!explanation) return undefined;
  if (explanation.source === "configured") {
    return Object.entries(explanation.signals).map(([name, signal]) => ({
      label: name,
      value: signal.value,
      reason: `${signal.from}: ${String(signal.raw)}`,
    }));
  }
  return explanation.factors.map((factor) => ({
    label: factor.label,
    value: factor.raw,
    reason: factor.reason,
  }));
};
```

Use it in `projectTarget`. Preserve existing Kind-projected priority explanations as the higher-precedence value.

- [ ] **Step 6: Run focused tests**

```bash
rtk npm test -- test/layout/score-breakdown.test.ts test/handoff/projector.test.ts test/shell/app-shell-breakdown.test.ts test/adapters/dom-view.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Task 4**

```bash
rtk git add src/runtime/shell/app-shell.ts src/runtime/adapters/dom-view.ts src/runtime/layout/table/kind-renderer.ts src/runtime/layout/table/score-breakdown.ts src/runtime/handoff/projector.ts test/layout/score-breakdown.test.ts test/handoff/projector.test.ts test/shell/app-shell-breakdown.test.ts
rtk git commit -m "feat(ui): show priority evidence everywhere"
```

### Task 5: Replace retained Handoff counts with ready work

**Files:**
- Modify: `src/runtime/handoff/queue.ts`
- Modify: `src/runtime/handoff/controller.ts`
- Modify: `src/runtime/layout/handoff/selection-controls.ts`
- Modify: `src/runtime/shell/app-shell.ts`
- Test: `test/handoff/queue.test.ts`
- Test: `test/handoff/controller.test.ts`
- Test: `test/layout/handoff-selection-controls.test.ts`

**Interfaces:**
- Produces: `isReadyForHandoff(entry: HandoffQueueEntry): boolean`.
- Produces: `SelectionControlsProps.readyCount` replacing toolbar-only `selectedCount` and `totalCount`.
- Preserves: `HandoffQueueSnapshot.selectedCount` and controller `retainedCount` for composer behavior.

- [ ] **Step 1: Write failing readiness tests**

In `test/handoff/queue.test.ts`, cover every status:

```ts
import type { HandoffQueueEntry } from "../../src/runtime/handoff/types";

const queueEntry = (
  over: Partial<HandoffQueueEntry>,
): HandoffQueueEntry => ({
  identity: identity("ready-test"),
  selectedAt: 1000,
  selected: true,
  status: "queued",
  ...over,
});

it.each([
  ["queued", true],
  ["current", true],
  ["changed", true],
  ["checking", false],
  ["resolved", false],
  ["unavailable", false],
  ["blocked", false],
  ["transferred", false],
] as const)("treats %s readiness as %s", (status, expected) => {
  expect(isReadyForHandoff(queueEntry({ status, selected: true })))
    .toBe(expected);
});

it("requires explicit selection for readiness", () => {
  expect(isReadyForHandoff(queueEntry({
    status: "current",
    selected: false,
  })))
    .toBe(false);
});
```

Add selection-control tests expecting `Handoff` at zero and `Handoff · 3 ready` at three. Assert neither rendered text nor accessible label contains `selected` or `retained`.

- [ ] **Step 2: Run focused tests and verify failure**

```bash
rtk npm test -- test/handoff/queue.test.ts test/handoff/controller.test.ts test/layout/handoff-selection-controls.test.ts
```

Expected: FAIL because the shared predicate and ready copy do not exist.

- [ ] **Step 3: Implement the shared readiness predicate**

In `queue.ts`:

```ts
const READY_STATUSES = new Set<HandoffQueueStatus>([
  "queued",
  "current",
  "changed",
]);

export const isReadyForHandoff = (entry: HandoffQueueEntry): boolean =>
  entry.selected && READY_STATUSES.has(entry.status);
```

Use this predicate in `handoff/controller.ts` when selecting entries for package projection. This deliberately excludes the transient `checking` state until revalidation finishes.

- [ ] **Step 4: Pass only ready count to toolbar controls**

Change `SelectionControlsProps`:

```ts
readonly readyCount: number;
```

Remove toolbar-only `selectedCount` and `totalCount`. In `app-shell.ts` compute:

```ts
readyCount: snapshot.entries.filter(isReadyForHandoff).length,
```

Do not remove `selectedCount` or `retainedCount` from queue/controller snapshots; the composer still uses them.

- [ ] **Step 5: Render operator-language copy**

In `selection-controls.ts`:

```ts
const queueLabel = props.readyCount > 0
  ? `Handoff · ${props.readyCount} ready`
  : "Handoff";
const accessibleLabel = props.readyCount > 0
  ? `Open Handoff queue: ${props.readyCount} ready`
  : "Open Handoff queue";
```

Keep the same button, click callback, visible-selection checkbox, and queue styling.

- [ ] **Step 6: Prove controller and toolbar share eligibility**

Import `isReadyForHandoff` in `test/handoff/controller.test.ts` and add:

```ts
it("packages exactly the entries counted as ready", () => {
  const { controller, queue } = fixture({ count: 5 });
  const entries = queue.snapshot().entries;
  queue.transitionMany([
    { key: queueKey(entries[0].identity), transition: { status: "queued", selected: true } },
    { key: queueKey(entries[1].identity), transition: { status: "checking", selected: true } },
    { key: queueKey(entries[2].identity), transition: { status: "changed", selected: true } },
    { key: queueKey(entries[3].identity), transition: { status: "blocked", selected: true } },
    { key: queueKey(entries[4].identity), transition: { status: "transferred", selected: false } },
  ]);

  const ready = queue.snapshot().entries.filter(isReadyForHandoff);
  const packagedIds = controller.snapshot().packages.flatMap((entry) =>
    entry.targets.map((target) => target.id));

  expect(ready).toHaveLength(2);
  expect(packagedIds).toEqual([
    "github:issue:00",
    "github:issue:02",
  ]);
});
```

- [ ] **Step 7: Run focused tests**

```bash
rtk npm test -- test/handoff/queue.test.ts test/handoff/controller.test.ts test/layout/handoff-selection-controls.test.ts test/runtime/focus-handoff-workflow.test.ts
```

Expected: PASS with unchanged composer history and transfer confirmation behavior.

- [ ] **Step 8: Commit Task 5**

```bash
rtk git add src/runtime/handoff/queue.ts src/runtime/handoff/controller.ts src/runtime/layout/handoff/selection-controls.ts src/runtime/shell/app-shell.ts test/handoff/queue.test.ts test/handoff/controller.test.ts test/layout/handoff-selection-controls.test.ts test/runtime/focus-handoff-workflow.test.ts
rtk git commit -m "fix(handoff): summarize ready work"
```

### Task 6: Verify the complete Decision Clarity slice

**Files:**
- Test: existing suite and artifact checks.

**Interfaces:**
- Consumes: Tasks 1–5.
- Produces: a verified self-contained artifact and clean branch.

- [ ] **Step 1: Run typechecking**

```bash
rtk npm run typecheck
```

Expected: PASS with no optional-column or explanation-union errors.

- [ ] **Step 2: Run the complete test suite**

```bash
rtk npm test
```

Expected: PASS. If the documented localStorage environment failures appear, confirm they are exactly the pre-existing failures described in `CONTEXT.md`; no new failure is acceptable.

- [ ] **Step 3: Run anonymization lint**

```bash
rtk npm run lint:anon
```

Expected: PASS.

- [ ] **Step 4: Verify the single-file artifact**

```bash
rtk npm run build:cli
rtk proxy node scripts/check-build.mjs
rtk proxy node dist-cli/cli/index.js build --generic
```

Expected: `dist/` contains exactly `triage.html`; the artifact has no script `src`, stylesheet link, or module-preload link.

- [ ] **Step 5: Inspect the production diff**

```bash
rtk git diff main...HEAD --stat
rtk git diff main...HEAD --check
rtk git status --short --branch
```

Expected: only scoped source/tests/spec/plan changes, no `.impeccable/critique/`, and no whitespace errors. If any check fails, return to the task that introduced the failure, add its failing regression test, make the smallest correction, repeat that task's focused test command, and amend that task before repeating Task 6 from Step 1.
