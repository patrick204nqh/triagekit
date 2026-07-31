# Unified Handoff Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-item Agent Handoff and Delegation Queue with one session-scoped Handoff Queue that defaults to read-only investigation, supports explicit implementation authorization, and needs no repeated package prompts.

**Architecture:** Add mode and human notes to the existing queue pipeline first, then update prompt projection, validation, controller behavior, and UI behind tests. Finish with a mechanical breaking cutover from `delegation` to `handoff`, delete the legacy single-item path, and record the superseding ADR. This order keeps behavior changes reviewable while producing the clean final source and contract model.

**Tech Stack:** TypeScript 6, browser DOM APIs, sessionStorage through `StoragePort`, Vitest 4 with jsdom, Vite 8 single-file build, existing CSS token system.

## Global Constraints

- Read `CONTEXT.md`, `PRODUCT.md`, and `DESIGN.md` before implementation.
- Use the existing TypeScript, DOM, CSS, and Vitest stack; add no dependency.
- Prefix every shell command with `rtk`.
- Use test-first changes: failing focused test, minimal implementation, focused pass, then commit.
- The final product terms are Handoff Queue, Handoff Bundle, Handoff Package, Handoff mode, mission note, and item note.
- Remove product-facing Delegation Queue, Delegation Bundle, Work Package, Agent brief, and Generate brief.
- Every new queue defaults to `investigate`; switching mode never changes selection or notes.
- Investigate forbids file changes, commits, pushes, provider mutations, and external actions even if a human note says otherwise.
- Implement authorizes scoped local changes and verification only; publication and provider mutations still require explicit human text.
- One package contains one repository, one Kind, and 1–10 targets; one bundle contains 1–5 packages and at most 50 targets.
- Queue mode, mission note, item notes, membership, and status are session-only.
- Use the new storage key `triagekit.handoff.queue.v1`; do not read or migrate `triagekit.delegation.queue.v1`.
- The final schema is `triagekit.handoff-bundle`; keep no compatibility aliases for legacy contracts.
- Preserve safe allow-listed projection, secret rejection, bounded body disclosure, stale/offline behavior, clipboard fallback, confirmation, and undo.
- Preserve the single self-contained HTML artifact, CSP, anonymization, dark/light themes, WCAG 2.1 AA, visible focus, and reduced motion.
- Preserve unrelated user work, including `.impeccable/critique/`.

---

## File Map

### Final core modules

- `src/runtime/handoff/types.ts` — unified queue, mode, target, package, bundle, controller, validation, and transport contracts.
- `src/runtime/handoff/intent.ts` — generated mode boundary and Kind-specific instruction.
- `src/runtime/handoff/queue.ts` — immutable aggregate queue state and mutations.
- `src/runtime/handoff/browser-queue-store.ts` — strict parsing and persistence under the new session key.
- `src/runtime/handoff/planner.ts` — deterministic repository/Kind grouping and limits.
- `src/runtime/handoff/projector.ts` — curated target projection and explicit item notes.
- `src/runtime/handoff/validator.ts` — safe-value checks and Handoff Bundle invariants.
- `src/runtime/handoff/markdown.ts` — mode-first combined/package Markdown.
- `src/runtime/handoff/revalidation.ts` — queue revalidation transitions.
- `src/runtime/handoff/controller.ts` — queue state, bundle projection, transfer, confirmation, and undo.
- `src/runtime/handoff/adapters/download.ts` — generic Markdown/JSON downloads for Handoff Bundles.

### Final UI modules

- `src/runtime/layout/handoff/composer.ts` — Handoff mode, mission note, repository/Kind packages, target notes, transfer controls, and status.
- `src/runtime/layout/handoff/selection-controls.ts` — visible selection, queue badge, and item identity mapping.
- `src/runtime/layout/table/detail-panel.ts` — item detail plus Add/Remove from handoff; no brief view.
- `src/runtime/layout/table/kind-renderer.ts` — Handoff selection dependency only.
- `src/runtime/layout/table/triage-table.ts` — row-level Add/Remove from handoff control.
- `src/runtime/layout/toolbar/toolbar.ts` — Handoff selection host.
- `src/runtime/adapters/dom-view.ts` — passes Handoff selection state; no legacy single-target controller.
- `src/runtime/shell/app-shell.ts` — creates the unified store, queue, controller, composer, and selection callbacks.
- `src/runtime/index.html` — `handoff-host`.
- `src/runtime/theme/tokens.css` — renamed Handoff selectors and the mode/note layout.

### Documentation and tests

- `docs/adr/0009-unified-handoff-queue.md` — superseding decision.
- `docs/adr/README.md` — ADR status/index update.
- `test/handoff/*.test.ts` — all pure queue/bundle/controller coverage.
- `test/layout/handoff-*.test.ts` — composer and selection coverage.
- `test/runtime/focus-handoff-workflow.test.ts` — integrated workflow.
- Existing shell, table, adapter, architecture, CSP, bootstrap, tooling, and site tests — updated for the new names and removed legacy path.

---

### Task 1: Queue-Level Mode and Human Notes

**Files:**
- Modify: `src/runtime/delegation/types.ts`
- Modify: `src/runtime/delegation/queue.ts`
- Modify: `test/delegation/queue.test.ts`

**Interfaces:**
- Consumes: Existing `QueueIdentity`, queue transitions, selection, transfer, and subscription behavior.
- Produces: `HandoffMode`, aggregate `QueueSnapshot.mode`, `QueueSnapshot.missionNote`, `QueueEntry.note`, `setMode(mode)`, `setMissionNote(note)`, and `setItemNote(key, note)`.

- [ ] **Step 1: Write failing queue tests for the safe default and note mutations**

Add these cases to `test/delegation/queue.test.ts`:

```ts
it("defaults a new queue to investigate with no notes", () => {
  const queue = createDelegationQueue();

  expect(queue.snapshot()).toMatchObject({
    mode: "investigate",
    missionNote: undefined,
    selectedCount: 0,
  });
});

it("changes mode without changing membership or notes", () => {
  const queue = createDelegationQueue();
  queue.add(identity("github:42"), 100);
  const key = queueKey(identity("github:42"));
  queue.setMissionNote("Keep public APIs stable");
  queue.setItemNote(key, "The failing snapshot is unrelated");

  expect(queue.setMode("implement")).toBe(true);
  expect(queue.snapshot()).toMatchObject({
    mode: "implement",
    missionNote: "Keep public APIs stable",
    selectedCount: 1,
  });
  expect(queue.snapshot().entries[0].note)
    .toBe("The failing snapshot is unrelated");
});

it("normalizes empty human notes away", () => {
  const queue = createDelegationQueue();
  queue.add(identity("github:42"), 100);
  const key = queueKey(identity("github:42"));

  queue.setMissionNote("  Verify the regression test  ");
  queue.setItemNote(key, "  Do not change the public type  ");
  expect(queue.snapshot().missionNote).toBe("Verify the regression test");
  expect(queue.snapshot().entries[0].note)
    .toBe("Do not change the public type");

  queue.setMissionNote("  ");
  queue.setItemNote(key, "\n");
  expect(queue.snapshot().missionNote).toBeUndefined();
  expect(queue.snapshot().entries[0].note).toBeUndefined();
});
```

- [ ] **Step 2: Run the focused test and verify the new API is absent**

Run:

```bash
rtk npm test -- test/delegation/queue.test.ts
```

Expected: FAIL because snapshots have no mode/mission note and the three mutation methods do not exist.

- [ ] **Step 3: Add aggregate state and immutable note mutations**

Add the exact contracts in `src/runtime/delegation/types.ts`:

```ts
export type HandoffMode = "investigate" | "implement";

export interface QueueEntry {
  // existing fields remain
  readonly note?: string;
}

export interface QueueSnapshot {
  readonly mode: HandoffMode;
  readonly missionNote?: string;
  readonly entries: readonly QueueEntry[];
  readonly selectedCount: number;
}

export interface DelegationQueue {
  setMode(mode: HandoffMode): boolean;
  setMissionNote(note: string): boolean;
  setItemNote(key: string, note: string): boolean;
  // existing methods remain
}
```

In `src/runtime/delegation/queue.ts`, initialize:

```ts
let mode: HandoffMode = "investigate";
let missionNote: string | undefined;

function normalizedNote(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}
```

Return `mode` and `missionNote` from `snapshot()`. Implement mutations so they publish only when the normalized value changes. `setItemNote` must rebuild and freeze the matching entry and delete the property when the normalized value is empty.

- [ ] **Step 4: Run the queue suite**

Run:

```bash
rtk npm test -- test/delegation/queue.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the aggregate queue behavior**

```bash
rtk git add src/runtime/delegation/types.ts src/runtime/delegation/queue.ts test/delegation/queue.test.ts
rtk git commit -m "feat: add handoff mode and queue notes"
```

---

### Task 2: Persist the Whole Handoff Queue State

**Files:**
- Modify: `src/runtime/delegation/types.ts`
- Modify: `src/runtime/delegation/queue.ts`
- Modify: `src/runtime/delegation/browser-queue-store.ts`
- Modify: `test/delegation/browser-queue-store.test.ts`
- Modify: `test/delegation/queue.test.ts`

**Interfaces:**
- Consumes: Task 1 queue snapshot and mutations.
- Produces: `HandoffQueueState`, `DelegationQueueStore.load(): HandoffQueueState`, `save(state)`, and `createDelegationQueue(store, initial?)` hydration under `triagekit.handoff.queue.v1`.

- [ ] **Step 1: Write failing persistence and old-key rejection tests**

Add to `test/delegation/browser-queue-store.test.ts`:

```ts
it("round-trips mode, mission note, item note, and entries", () => {
  const storage = memoryStorage();
  const store = createBrowserQueueStore(storage);
  const queue = createDelegationQueue(store);
  const target = identity("github:42");

  queue.add(target, 100);
  queue.setMode("implement");
  queue.setMissionNote("Keep the API compatible");
  queue.setItemNote(queueKey(target), "Do not update the lockfile");

  const restored = createDelegationQueue(store).snapshot();
  expect(restored.mode).toBe("implement");
  expect(restored.missionNote).toBe("Keep the API compatible");
  expect(restored.entries[0].note).toBe("Do not update the lockfile");
});

it("ignores the obsolete delegation storage key", () => {
  const storage = memoryStorage();
  storage.set(
    "triagekit.delegation.queue.v1",
    JSON.stringify([{ identity: identity("legacy"), selectedAt: 1 }]),
  );

  expect(createDelegationQueue(createBrowserQueueStore(storage)).snapshot())
    .toMatchObject({ mode: "investigate", entries: [] });
});

it("falls back safely when aggregate state is malformed", () => {
  const storage = memoryStorage();
  storage.set("triagekit.handoff.queue.v1", JSON.stringify({
    mode: "ship-it",
    missionNote: 42,
    entries: "not-an-array",
  }));

  expect(createDelegationQueue(createBrowserQueueStore(storage)).snapshot())
    .toMatchObject({ mode: "investigate", entries: [] });
});
```

- [ ] **Step 2: Run focused persistence tests**

Run:

```bash
rtk npm test -- test/delegation/browser-queue-store.test.ts test/delegation/queue.test.ts
```

Expected: FAIL because the store persists only an entry array and uses the obsolete key.

- [ ] **Step 3: Replace the stored array with a strict aggregate contract**

Add to `src/runtime/delegation/types.ts`:

```ts
export interface HandoffQueueState {
  readonly mode: HandoffMode;
  readonly missionNote?: string;
  readonly entries: readonly QueueEntry[];
}

export interface DelegationQueueStore {
  load(): HandoffQueueState;
  save(state: HandoffQueueState): void;
}
```

In `browser-queue-store.ts`, use:

```ts
const QUEUE_KEY = "triagekit.handoff.queue.v1";
const MODES = new Set<HandoffMode>(["investigate", "implement"]);
const EMPTY_STATE: HandoffQueueState = {
  mode: "investigate",
  entries: [],
};
```

Allow `note` in `ENTRY_KEYS`, require the top-level keys to be only `mode`, `missionNote`, and `entries`, trim non-empty notes, and return `EMPTY_STATE` for invalid JSON or invalid aggregate shape. Save `JSON.stringify(state)`.

Update `createDelegationQueue` so restored mode and mission note initialize the aggregate and every publish calls `store.save(serializedState())`.

- [ ] **Step 4: Run persistence and queue tests**

Run:

```bash
rtk npm test -- test/delegation/browser-queue-store.test.ts test/delegation/queue.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit session persistence**

```bash
rtk git add src/runtime/delegation/types.ts src/runtime/delegation/queue.ts src/runtime/delegation/browser-queue-store.ts test/delegation/browser-queue-store.test.ts test/delegation/queue.test.ts
rtk git commit -m "feat: persist complete handoff queue state"
```

---

### Task 3: Generate Mode-Bound Instructions and Safe Bundle Output

**Files:**
- Modify: `src/runtime/handoff/types.ts`
- Modify: `src/runtime/handoff/intent.ts`
- Modify: `src/runtime/delegation/types.ts`
- Modify: `src/runtime/delegation/planner.ts`
- Modify: `src/runtime/delegation/projector.ts`
- Modify: `src/runtime/delegation/markdown.ts`
- Modify: `src/runtime/delegation/validator.ts`
- Modify: `test/handoff/intent.test.ts`
- Modify: `test/delegation/planner.test.ts`
- Modify: `test/delegation/projector.test.ts`
- Modify: `test/delegation/markdown.test.ts`
- Modify: `test/delegation/validator.test.ts`

**Interfaces:**
- Consumes: `HandoffMode`, existing target projection, Focus Policy grouping, safe-value checks, and bundle limits.
- Produces: `generatedIntentFor(kind, mode)`, explicit target `note`, `instructions.mode`, optional `instructions.missionNote`, schema `triagekit.handoff-bundle`, and mode-first Markdown.

- [ ] **Step 1: Write failing generated-intent tests**

Replace fixed-intent expectations in `test/handoff/intent.test.ts` with:

```ts
it("generates a read-only investigation boundary", () => {
  const intent = generatedIntentFor("issue", "investigate");

  expect(intent.outcome).toBe("Investigate the selected issues");
  expect(intent.constraints).toEqual(expect.arrayContaining([
    "Do not modify files.",
    "Do not create commits or pushes.",
    "Do not perform provider mutations or other external actions.",
  ]));
  expect(intent.verification).toEqual([
    "Report evidence, risks, and unanswered questions.",
    "Outline a concrete action plan.",
  ]);
});

it("generates scoped implementation instructions without publication", () => {
  const intent = generatedIntentFor("change-request", "implement");

  expect(intent.outcome).toBe(
    "Implement the requested changes for the selected change requests",
  );
  expect(intent.constraints).toContain(
    "Do not commit, push, merge, deploy, or mutate provider state unless the human instructions explicitly request it.",
  );
  expect(intent.verification).toContain(
    "Run proportionate verification and report the result.",
  );
});
```

- [ ] **Step 2: Write failing Markdown, JSON, and validation tests**

Add exact assertions:

```ts
expect(renderBundleMarkdown(investigateBundle)).toContain("# Handoff bundle");
expect(renderBundleMarkdown(investigateBundle))
  .toContain("## Mode: Investigate");
expect(renderBundleMarkdown(investigateBundle))
  .toContain("Make no changes.");
expect(renderBundleMarkdown(investigateBundle))
  .toContain("## Mission note\n\nKeep public APIs stable");
expect(renderBundleMarkdown(investigateBundle))
  .toContain("#### Item note\n\nDo not update beyond v4");

expect(validateHandoffBundle({
  ...investigateBundle,
  instructions: {
    ...investigateBundle.instructions,
    generatedBoundary: [],
  },
})).toEqual({
  valid: false,
  errors: expect.arrayContaining([
    expect.objectContaining({ field: "instructions.generatedBoundary" }),
  ]),
});
```

Also assert that a human note containing `fix this` does not remove or replace the generated Investigate boundary.

- [ ] **Step 3: Run the focused core tests**

Run:

```bash
rtk npm test -- test/handoff/intent.test.ts test/delegation/planner.test.ts test/delegation/projector.test.ts test/delegation/markdown.test.ts test/delegation/validator.test.ts
```

Expected: FAIL on missing mode-aware intent, notes, Handoff schema, and generated-boundary validation.

- [ ] **Step 4: Implement deterministic mode-aware instructions**

In `src/runtime/handoff/intent.ts`, export:

```ts
export function generatedIntentFor(
  kind: Kind,
  mode: HandoffMode,
): HandoffIntent;
```

Use exact Kind outcomes for `dependency-vuln`, `code-scanning`, `change-request`, and `issue`, plus provider-neutral fallbacks:

```ts
const INVESTIGATE_CONSTRAINTS = [
  "Do not modify files.",
  "Do not create commits or pushes.",
  "Do not perform provider mutations or other external actions.",
] as const;

const IMPLEMENT_CONSTRAINTS = [
  "Limit changes to the selected targets.",
  "Preserve unrelated behavior.",
  "Do not commit, push, merge, deploy, or mutate provider state unless the human instructions explicitly request it.",
] as const;
```

Pass mode into `planPackages`. Replace editable `intent` with `generatedIntent`. Add to bundle instructions:

```ts
interface HandoffInstructionsV1 {
  readonly mode: HandoffMode;
  readonly missionNote?: string;
  readonly generatedBoundary: readonly string[];
  readonly processPackagesInOrder: true;
  readonly generatedFrom: "explicit-session-queue";
}
```

Add `note?: string` directly to `HandoffTargetV1`. `projectDelegationTarget` receives `note?: string`, trims it, and includes only non-empty text.

- [ ] **Step 5: Render and validate the authorization boundary**

Change schema validation to `triagekit.handoff-bundle`. Validate:

- mode is `investigate` or `implement`;
- Investigate has all three exact no-change constraints in `generatedBoundary`;
- packages use `generatedIntent`;
- mission and item notes are strings when present;
- existing 1–5 package, 1–10 target, 50-target, repository/Kind, identity, safe-value, and byte limits remain.

Render this order in Markdown:

```text
# Handoff bundle
## Mode: Investigate|Implement
### Authorization boundary
## Mission note (only when present)
## Focus summary
## Package N: repository · Kind
### Generated instruction
### Targets
#### Item note (only when present)
#### Evidence
#### Curated context
```

Render the authorization boundary inside `renderPackageMarkdown` too, so a copied package is self-contained.

- [ ] **Step 6: Run the focused core tests**

Run:

```bash
rtk npm test -- test/handoff/intent.test.ts test/delegation/planner.test.ts test/delegation/projector.test.ts test/delegation/markdown.test.ts test/delegation/validator.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit generated handoff instructions**

```bash
rtk git add src/runtime/handoff/types.ts src/runtime/handoff/intent.ts src/runtime/delegation/types.ts src/runtime/delegation/planner.ts src/runtime/delegation/projector.ts src/runtime/delegation/markdown.ts src/runtime/delegation/validator.ts test/handoff/intent.test.ts test/delegation/planner.test.ts test/delegation/projector.test.ts test/delegation/markdown.test.ts test/delegation/validator.test.ts
rtk git commit -m "feat: generate mode-bound handoff instructions"
```

---

### Task 4: Replace Package Prompt Editing with Queue Controls

**Files:**
- Modify: `src/runtime/delegation/controller.ts`
- Modify: `src/runtime/delegation/types.ts`
- Modify: `test/delegation/controller.test.ts`

**Interfaces:**
- Consumes: Task 1 queue mutations, Task 3 planner/projector/validator/Markdown.
- Produces: `setMode(mode)`, `setMissionNote(note)`, `setItemNote(itemId, note)`, mode/note snapshot fields, and mode-specific copy labels. Removes `updateIntent`.

- [ ] **Step 1: Write failing controller tests**

Add:

```ts
it("defaults to an investigation bundle with no human prompt", () => {
  const { controller } = fixture();
  const snapshot = controller.snapshot();

  expect(snapshot.mode).toBe("investigate");
  expect(snapshot.missionNote).toBeUndefined();
  expect(snapshot.packages[0].generatedIntent.constraints)
    .toContain("Do not modify files.");
  expect(snapshot.previewMarkdown).toContain("## Mode: Investigate");
});

it("updates mode and notes without changing selected targets", () => {
  const { controller, queue } = fixture();
  const before = queue.snapshot().selectedCount;
  const itemId = controller.snapshot().packages[0].targets[0].id;

  controller.setMode("implement");
  controller.setMissionNote("Keep public APIs stable");
  controller.setItemNote(itemId, "Do not update beyond v4");

  expect(controller.snapshot()).toMatchObject({
    mode: "implement",
    missionNote: "Keep public APIs stable",
    selectedCount: before,
  });
  expect(controller.snapshot().packages[0].targets[0].note)
    .toBe("Do not update beyond v4");
});

it("keeps investigate authoritative over conflicting human text", () => {
  const { controller } = fixture();
  controller.setMissionNote("Fix every target and push it");
  controller.setItemNote(
    controller.snapshot().packages[0].targets[0].id,
    "Make the change now",
  );

  expect(controller.snapshot().previewMarkdown)
    .toContain("Do not modify files.");
  expect(controller.snapshot().previewMarkdown)
    .toContain("Fix every target and push it");
});
```

Update copy/clipboard fallback expectations from `# Delegation bundle` to `# Handoff bundle`.

- [ ] **Step 2: Run controller tests**

Run:

```bash
rtk npm test -- test/delegation/controller.test.ts
```

Expected: FAIL because the controller still owns package intent edits and exposes no queue-level control methods.

- [ ] **Step 3: Simplify projection and expose queue-level mutations**

Delete `intentEdits` and `updateIntent`. Build packages with `planned.generatedIntent`. Read mode and mission note from the queue snapshot and pass mode to the planner. When projecting a target, look up its queue entry and pass `entry.note`.

Add to controller and snapshot contracts:

```ts
readonly mode: HandoffMode;
readonly missionNote?: string;
setMode(mode: HandoffMode): void;
setMissionNote(note: string): void;
setItemNote(itemId: string, note: string): void;
```

Implement `setItemNote` through the existing identity lookup:

```ts
setItemNote(itemId, note) {
  const entry = deps.queue.snapshot().entries.find(
    (candidate) => candidate.identity.itemId === itemId,
  );
  if (entry) deps.queue.setItemNote(queueKey(entry.identity), note);
}
```

Keep revalidation, copy/download, pending confirmation, handed-off history, and undo behavior unchanged. Rename internal user messages from bundle/delegation wording to Handoff wording where visible.

- [ ] **Step 4: Run controller and queue tests**

Run:

```bash
rtk npm test -- test/delegation/controller.test.ts test/delegation/queue.test.ts test/delegation/browser-queue-store.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the controller simplification**

```bash
rtk git add src/runtime/delegation/controller.ts src/runtime/delegation/types.ts test/delegation/controller.test.ts
rtk git commit -m "feat: control handoff instructions at queue level"
```

---

### Task 5: Redesign the Queue as the Handoff Review Surface

**Files:**
- Modify: `src/runtime/layout/delegation/composer.ts`
- Modify: `src/runtime/theme/tokens.css`
- Modify: `test/layout/delegation-composer.test.ts`

**Interfaces:**
- Consumes: Task 4 controller snapshot and mutations.
- Produces: accessible Handoff mode control, optional mission note, inline item notes, generated read-only package instructions, and mode-specific primary copy action.

- [ ] **Step 1: Replace composer fixture and write failing interaction tests**

Update the fixture to contain:

```ts
mode: "investigate",
missionNote: undefined,
packages: [{
  id: "pkg-core-issues",
  order: 1,
  repository: "acme-corp/core",
  kind: "issue",
  generatedIntent: {
    outcome: "Investigate the selected issues",
    constraints: ["Do not modify files."],
    verification: ["Outline a concrete action plan."],
  },
  targets: [target],
  selectionReason: "Repository priority 1",
}],
```

Add tests:

```ts
it("shows a safe default without package prompt fields", () => {
  const host = document.createElement("div");
  mountHandoffComposer(host, controllerWith());

  expect(host.querySelector("h2")?.textContent).toBe("Handoff queue");
  expect(host.querySelector<HTMLInputElement>(
    "[name='handoff-mode'][value='investigate']",
  )?.checked).toBe(true);
  expect(host.textContent).toContain(
    "Analyze and propose a plan. Make no changes.",
  );
  expect(host.querySelector("[data-intent-outcome]")).toBeNull();
  expect(host.querySelector("[data-intent-constraints]")).toBeNull();
  expect(host.querySelector("[data-intent-verification]")).toBeNull();
  expect(host.querySelector("[data-copy-all]")?.textContent)
    .toBe("Copy investigation handoff");
});

it("changes mode and mission note through accessible controls", () => {
  const host = document.createElement("div");
  const controller = controllerWith();
  mountHandoffComposer(host, controller);

  host.querySelector<HTMLInputElement>(
    "[name='handoff-mode'][value='implement']",
  )!.click();
  expect(controller.setMode).toHaveBeenCalledWith("implement");

  const note = host.querySelector<HTMLTextAreaElement>(
    "[data-mission-note]",
  )!;
  note.value = "Keep public APIs stable";
  note.dispatchEvent(new Event("change"));
  expect(controller.setMissionNote)
    .toHaveBeenCalledWith("Keep public APIs stable");
});

it("adds and edits an item exception note", () => {
  const host = document.createElement("div");
  const controller = controllerWith();
  mountHandoffComposer(host, controller);

  host.querySelector<HTMLElement>("[data-add-item-note='github:42']")!
    .click();
  const field = host.querySelector<HTMLTextAreaElement>(
    "[data-item-note='github:42']",
  )!;
  field.value = "Do not update beyond v4";
  field.dispatchEvent(new Event("change"));
  expect(controller.setItemNote)
    .toHaveBeenCalledWith("github:42", "Do not update beyond v4");
});
```

- [ ] **Step 2: Run the composer test**

Run:

```bash
rtk npm test -- test/layout/delegation-composer.test.ts
```

Expected: FAIL on missing Handoff copy, mode controls, mission note, and item note behavior.

- [ ] **Step 3: Replace package editors with generated review content**

Rename the export in place to:

```ts
export function mountHandoffComposer(
  host: HTMLElement,
  controller: HandoffController,
): () => void;
```

Render mode as a `fieldset` with two native radio inputs and persistent descriptions. Render mission note once using:

```html
<label for="handoff-mission-note">Mission note <span>(optional)</span></label>
<textarea id="handoff-mission-note"
  data-mission-note
  placeholder="Applies to every selected target"></textarea>
```

Render `generatedIntent` as read-only summary text. Do not render Outcome, Constraints, or Verification textareas. Each target renders `Add note`; after activation or when a note exists, render one compact textarea labeled with the target title. On change, call `setItemNote`.

Preserve field focus, selection range, body scroll, modal dismissal, focus return to the queue badge, linked package errors, revalidation, not-in-next-bundle, handed-off, downloads, confirmation, and undo.

- [ ] **Step 4: Add focused styles using existing tokens**

In `tokens.css`, add only the structure needed for:

- `.handoff-mode` fieldset and two option labels;
- selected radio state using existing accent/focus tokens;
- `.handoff-mission-note`;
- `.handoff-item-note`;
- compact generated instruction disclosure.

Do not use P0–P3 colors for mode, new shadows on package surfaces, gradients, glass, or nested card treatment. Keep radio labels keyboard-visible and narrow-width layout single-column.

- [ ] **Step 5: Run composer and accessibility-adjacent tests**

Run:

```bash
rtk npm test -- test/layout/delegation-composer.test.ts test/shell/app-shell.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit the review surface**

```bash
rtk git add src/runtime/layout/delegation/composer.ts src/runtime/theme/tokens.css test/layout/delegation-composer.test.ts
rtk git commit -m "feat: redesign the handoff review surface"
```

---

### Task 6: Make Selection the Only Item-Level Handoff Action

**Files:**
- Modify: `src/runtime/layout/table/detail-panel.ts`
- Modify: `src/runtime/layout/table/kind-renderer.ts`
- Modify: `src/runtime/layout/table/triage-table.ts`
- Modify: `src/runtime/layout/delegation/selection-controls.ts`
- Modify: `src/runtime/layout/toolbar/toolbar.ts`
- Modify: `src/runtime/adapters/dom-view.ts`
- Modify: `test/layout/triage-table.test.ts`
- Modify: `test/layout/delegation-selection-controls.test.ts`
- Modify: `test/adapters/dom-view.test.ts`
- Delete after replacement: `test/handoff/controller.test.ts`
- Delete after replacement: single-target assertions in `test/handoff/markdown.test.ts`, `test/handoff/projector.test.ts`, and `test/handoff/validator.test.ts`

**Interfaces:**
- Consumes: Existing row selection state and the unified queue open/toggle callbacks.
- Produces: `HandoffSelection`, `Add to handoff`, `Remove from handoff`, Handoff queue badge copy, and no single-target brief UI.

- [ ] **Step 1: Write failing tests that prohibit the legacy brief**

Add integration assertions:

```ts
expect(root.querySelector("[data-brief-gen]")).toBeNull();
expect(root.textContent).not.toContain("Generate brief");

const detailAction = root.querySelector<HTMLElement>(
  "[data-detail-handoff-toggle]",
)!;
expect(detailAction.textContent).toBe("Add to handoff");
detailAction.click();
expect(selection.onToggle).toHaveBeenCalledWith(item);
```

Update selection control expectations:

```ts
expect(host.querySelector("[data-queue-badge]")
  ?.getAttribute("aria-label"))
  .toBe("Open Handoff queue: 2 selected, 3 retained");
```

- [ ] **Step 2: Run table, selection, and adapter tests**

Run:

```bash
rtk npm test -- test/layout/triage-table.test.ts test/layout/delegation-selection-controls.test.ts test/adapters/dom-view.test.ts
```

Expected: FAIL because the detail drawer still creates a `Generate brief` action and the selection types/copy use Delegation.

- [ ] **Step 3: Delete the single-item drawer brief path**

Remove these from `detail-panel.ts`:

- `AgentHandoffV1`, `HandoffController`, and single-target Markdown imports;
- `showBriefInDrawer`;
- every `data-brief-*` action;
- the legacy controller branch.

Use the same `ctx.handoffSelection` passed to the row table to append one detail footer action:

```ts
const selected = ctx.handoffSelection.queuedKeys.has(
  queueKey(handoffIdentityForItem(r)),
);
const button = document.createElement("button");
button.className = "act";
button.dataset.detailHandoffToggle = "";
button.textContent = selected ? "Remove from handoff" : "Add to handoff";
button.addEventListener("click", () => ctx.handoffSelection?.onToggle(r));
foot.appendChild(button);
```

Rename `RowDelegationSelection` to `HandoffSelection`, `queueIdentityForItem` to `handoffIdentityForItem`, and accessible/product copy to Handoff.

- [ ] **Step 4: Remove obsolete single-target tests**

Delete `test/handoff/controller.test.ts`. In the remaining legacy Handoff tests, keep only reusable target projection, safe-value, and generic adapter coverage that the new bundle path still exercises. Remove all `AgentHandoffV1`, exactly-one-target, `# Agent handoff`, and `generateFor` cases.

- [ ] **Step 5: Run affected UI and reusable primitive tests**

Run:

```bash
rtk npm test -- test/layout/triage-table.test.ts test/layout/delegation-selection-controls.test.ts test/adapters/dom-view.test.ts test/handoff/adapters/adapters.test.ts test/handoff/projector.test.ts test/handoff/validator.test.ts
```

Expected: PASS and no test references `Generate brief`.

- [ ] **Step 6: Commit the single-path item experience**

```bash
rtk git add src/runtime/layout/table/detail-panel.ts src/runtime/layout/table/kind-renderer.ts src/runtime/layout/table/triage-table.ts src/runtime/layout/delegation/selection-controls.ts src/runtime/layout/toolbar/toolbar.ts src/runtime/adapters/dom-view.ts test/layout/triage-table.test.ts test/layout/delegation-selection-controls.test.ts test/adapters/dom-view.test.ts test/handoff
rtk git commit -m "feat: route item handoff through the queue"
```

---

### Task 7: Perform the Breaking `delegation` → `handoff` Cutover

**Files:**
- Move: `src/runtime/delegation/browser-queue-store.ts` → `src/runtime/handoff/browser-queue-store.ts`
- Move: `src/runtime/delegation/planner.ts` → `src/runtime/handoff/planner.ts`
- Move: `src/runtime/delegation/queue.ts` → `src/runtime/handoff/queue.ts`
- Move: `src/runtime/delegation/revalidation.ts` → `src/runtime/handoff/revalidation.ts`
- Merge: `src/runtime/delegation/controller.ts` → `src/runtime/handoff/controller.ts`
- Merge: `src/runtime/delegation/markdown.ts` → `src/runtime/handoff/markdown.ts`
- Merge: `src/runtime/delegation/projector.ts` → `src/runtime/handoff/projector.ts`
- Merge: `src/runtime/delegation/types.ts` → `src/runtime/handoff/types.ts`
- Merge: `src/runtime/delegation/validator.ts` → `src/runtime/handoff/validator.ts`
- Move: `src/runtime/layout/delegation/composer.ts` → `src/runtime/layout/handoff/composer.ts`
- Move: `src/runtime/layout/delegation/selection-controls.ts` → `src/runtime/layout/handoff/selection-controls.ts`
- Move: `test/delegation/*.test.ts` → `test/handoff/`
- Move: `test/layout/delegation-composer.test.ts` → `test/layout/handoff-composer.test.ts`
- Move: `test/layout/delegation-selection-controls.test.ts` → `test/layout/handoff-selection-controls.test.ts`
- Move: `test/runtime/focus-delegation-workflow.test.ts` → `test/runtime/focus-handoff-workflow.test.ts`
- Modify: `src/runtime/shell/app-shell.ts`
- Modify: `src/runtime/index.html`
- Modify: all import consumers found by the required search below
- Delete: remaining obsolete files under `src/runtime/delegation/`
- Delete: remaining legacy-only files under `src/runtime/handoff/`

**Interfaces:**
- Consumes: Tasks 1–6 behavior.
- Produces: only `Handoff*` public names, one `src/runtime/handoff/` core, one `src/runtime/layout/handoff/` UI, one `test/handoff/` suite, `handoff-host`, and schema `triagekit.handoff-bundle`.

- [ ] **Step 1: Capture the full rename surface**

Run:

```bash
rtk proxy rg -n -i "delegation|agent.?handoff|agent brief|generate brief|data-brief|brief-" src test docs/adr --glob '!docs/superpowers/**'
```

Expected: output lists the old directories, imports, symbols, CSS selectors, DOM attributes, test descriptions, host ID, and ADR history.

- [ ] **Step 2: Move files with Git-aware commands**

Run the applicable moves one at a time so history remains legible:

```bash
rtk git mv src/runtime/delegation/browser-queue-store.ts src/runtime/handoff/browser-queue-store.ts
rtk git mv src/runtime/delegation/planner.ts src/runtime/handoff/planner.ts
rtk git mv src/runtime/delegation/queue.ts src/runtime/handoff/queue.ts
rtk git mv src/runtime/delegation/revalidation.ts src/runtime/handoff/revalidation.ts
rtk git mv src/runtime/layout/delegation src/runtime/layout/handoff
```

For colliding core files, copy the approved multi-target implementation into the existing Handoff file with `apply_patch`, then delete the obsolete Delegation file with `apply_patch`. Do not preserve aliases such as `DelegationBundleV1 = HandoffBundleV1`.

- [ ] **Step 3: Apply the final contract and API names**

The final exported names are:

```ts
HandoffMode
HandoffIdentity
HandoffQueueStatus
HandoffQueueEntry
HandoffQueueState
HandoffQueueSnapshot
HandoffQueueStore
HandoffQueue
HandoffFocusV1
HandoffInstructionsV1
HandoffTargetV1
HandoffPackageV1
HandoffBundleV1
HandoffValidationError
HandoffValidationResult
HandoffControllerSnapshot
HandoffController
createHandoffQueue
createBrowserHandoffQueueStore
planHandoffPackages
projectHandoffTarget
validateHandoffBundle
renderHandoffBundleMarkdown
renderHandoffPackageMarkdown
createHandoffController
mountHandoffComposer
```

Use `handedOff` and `handedOffAt`, not `transferred`/`transferredAt`, in final queue statuses and UI summaries. Update revalidation and undo mappings accordingly.

- [ ] **Step 4: Cut over shell and DOM integration**

In `app-shell.ts`:

- delete construction of the legacy single-target controller;
- create one Browser Handoff Queue store, queue, controller, and composer;
- pass one Handoff selection object through toolbar, table, detail, and DOM view;
- keep current Focus Policy, Cached Dataset, score explanation, revalidation, clipboard, and download dependencies.

Rename the runtime host:

```html
<div id="handoff-host"></div>
```

Update bootstrap, shell, CSP, tooling, and build tests to assert `handoff-host` and reject `delegation-host`.

- [ ] **Step 5: Rename CSS and DOM attributes mechanically**

Rename product-specific selectors and attributes:

```text
delegation-*        → handoff-*
data-delegation-*   → data-handoff-*
```

Keep generic `queue-badge`, `data-queue-badge`, `data-copy-package`, and `data-download-package` when they remain accurate. Remove every `brief-*` selector and `data-brief-*` attribute.

- [ ] **Step 6: Move and rename tests**

Move former Delegation tests into `test/handoff/`, merge colliding controller/Markdown/projector/validator tests, and rename descriptions to Handoff. Keep one test file per final source file. Delete duplicate legacy test files after their reusable cases are merged.

- [ ] **Step 7: Run typecheck and the complete Handoff slice**

Run:

```bash
rtk npm run typecheck
rtk npm test -- test/handoff test/layout/handoff-composer.test.ts test/layout/handoff-selection-controls.test.ts test/runtime/focus-handoff-workflow.test.ts test/shell/app-shell.test.ts test/runtime/bootstrap.test.ts test/runtime/architecture-guardrails.test.ts test/build/csp.test.ts test/tooling/check-build.test.ts
```

Expected: PASS.

- [ ] **Step 8: Prove the old implementation is gone**

Run:

```bash
rtk proxy rg -n -i "DelegationQueue|DelegationBundle|WorkPackage|AgentHandoffV1|Generate brief|delegation-host|data-brief|brief-" src test --glob '!site/app/index.html'
rtk proxy rg --files src/runtime/delegation test/delegation
```

Expected: both commands return no matches/files. Historical ADR text may still contain old terms.

- [ ] **Step 9: Commit the breaking cutover**

```bash
rtk git add src/runtime test
rtk git commit -m "refactor!: unify agent transfer as handoff"
```

---

### Task 8: Record the Superseding Architecture Decision

**Files:**
- Create: `docs/adr/0009-unified-handoff-queue.md`
- Modify: `docs/adr/README.md`
- Modify: `docs/adr/0001-handoff-data-model.md`
- Modify: `docs/adr/0002-transport-adapters.md`
- Modify: `docs/adr/0003-phase-boundaries.md`
- Modify: `docs/adr/0007-human-focus-policy.md`
- Modify: `docs/adr/0008-bounded-delegation-bundles.md`
- Modify: `test/runtime/architecture-guardrails.test.ts`

**Interfaces:**
- Consumes: Approved design spec and final Task 7 names.
- Produces: ADR-0009, explicit supersession pointers, updated transport language, and architecture guards against legacy reintroduction.

- [ ] **Step 1: Write failing architecture guardrails**

Add:

```ts
it("keeps one browser-local Handoff implementation", () => {
  expect(existsSync(join(runtime, "delegation"))).toBe(false);
  const handoff = filesUnder(join(runtime, "handoff"))
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");
  expect(handoff).not.toMatch(/\b(fetch|WebSocket|EventSource)\s*\(/);
  expect(handoff).not.toContain("triagekit.delegation-bundle");
  expect(handoff).not.toContain("triagekit.delegation.queue.v1");
  expect(handoff).not.toContain("AgentHandoffV1");
  expect(handoff).toContain("triagekit.handoff-bundle");
  expect(handoff).toContain("triagekit.handoff.queue.v1");
});
```

- [ ] **Step 2: Run the architecture guardrail**

Run:

```bash
rtk npm test -- test/runtime/architecture-guardrails.test.ts
```

Expected: PASS after Task 7; this test prevents the old paths from returning.

- [ ] **Step 3: Write ADR-0009**

Use this decision summary:

```markdown
# ADR-0009: Unified Handoff Queue and explicit agent authorization

**Date**: 2026-07-31
**Status**: accepted
**Deciders**: Patrick

## Decision

Replace the single-target Agent Handoff and multi-target Delegation Bundle
with one breaking `HandoffBundleV1` contract and one session Handoff Queue.
Every queue has one mode: `investigate` (default, no changes) or `implement`
(scoped local changes). Human guidance is one optional mission note plus
optional target notes. Repository-and-Kind packages remain generated,
bounded, validated, and independently transferable; they have no editable
per-package prompt.
```

Document the rejected alternatives: preserve both flows, compatibility aliases, per-repository prompts, package prompt editors, and automatic write authorization.

- [ ] **Step 4: Mark historical ADR relationships**

Set ADR-0001 and ADR-0008 status to `superseded by ADR-0009`. Add a short supersession note to ADR-0002 and ADR-0003 without deleting their historical reasoning. Update ADR-0007 product language from Delegation Queue to Handoff Queue and point its bundle semantics to ADR-0009. Add ADR-0009 to the README table.

- [ ] **Step 5: Run docs-adjacent tests and anonymization lint**

Run:

```bash
rtk npm test -- test/runtime/architecture-guardrails.test.ts
rtk npm run lint:anon
```

Expected: PASS.

- [ ] **Step 6: Commit the architecture decision**

```bash
rtk git add docs/adr test/runtime/architecture-guardrails.test.ts
rtk git commit -m "docs: adopt the unified handoff contract"
```

---

### Task 9: Integrated Verification, Visual Audit, and Generated Artifact

**Files:**
- Modify if assertions require it: `test/runtime/focus-handoff-workflow.test.ts`
- Modify if assertions require it: `test/site/`
- Regenerate: `site/app/index.html`
- Do not commit: `dist/`

**Interfaces:**
- Consumes: Complete unified Handoff implementation.
- Produces: passing focused/full checks, verified responsive UI, and the current self-contained demo artifact.

- [ ] **Step 1: Strengthen the integrated workflow scenario**

Ensure `test/runtime/focus-handoff-workflow.test.ts` covers:

```ts
expect(queue.snapshot().mode).toBe("investigate");
controller.setMissionNote("Keep public APIs stable");
controller.setItemNote("github:issue:42", "The flaky test is unrelated");
controller.setMode("implement");

expect(controller.snapshot().packages).toHaveLength(5);
expect(controller.snapshot().remainingPackages).toBeGreaterThan(0);
expect(controller.snapshot().previewMarkdown)
  .toContain("## Mode: Implement");
expect(controller.snapshot().previewMarkdown)
  .toContain("Keep public APIs stable");
expect(controller.snapshot().previewMarkdown)
  .toContain("The flaky test is unrelated");
```

Retain changed, resolved, unavailable, blocked, more-than-five-package, clipboard success/denial, confirmation, and undo coverage.

- [ ] **Step 2: Run focused workflow and UI suites**

Run:

```bash
rtk npm test -- test/handoff test/layout/handoff-composer.test.ts test/layout/handoff-selection-controls.test.ts test/layout/triage-table.test.ts test/runtime/focus-handoff-workflow.test.ts test/shell/app-shell.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run typecheck and full tests**

Run:

```bash
rtk npm run typecheck
rtk npm test
```

Expected: all non-environmental tests PASS; compare any localStorage failures against the 81 known pre-existing failures documented in `CONTEXT.md` and do not attribute unchanged failures to this work.

- [ ] **Step 4: Run the full repository check**

Run:

```bash
rtk npm run check
```

Expected: typecheck, tests, anonymization lint, single-file build, CSP, and Pages checks PASS.

- [ ] **Step 5: Inspect the generated app in both themes and widths**

Run:

```bash
rtk npm run build:pages
```

Open the generated app using the project’s existing browser workflow and verify:

- Investigate is selected on a new queue.
- Both modes expose descriptive text and keyboard-visible selection.
- Mission note appears once above packages.
- Item Add/Edit note preserves focus.
- No package prompt textareas remain.
- No Generate brief action remains in item detail.
- Primary copy label changes with mode.
- Error, stale, resolved, blocked, clipboard-denied, confirmation, and undo states remain legible.
- Dark/light themes and desktop/narrow widths preserve the sticky transfer action.
- Reduced motion removes non-essential transitions.

Use the explicitly required Impeccable audit and polish flows from the preceding Focus and Delegation design. Resolve every P0/P1 finding within this Handoff surface before completion.

- [ ] **Step 6: Confirm artifact and legacy-string invariants**

Run:

```bash
rtk proxy rg -n -i "Delegation queue|Delegation bundle|Generate brief|Agent brief|triagekit.delegation" src test site/app/index.html
rtk proxy rg -n "triagekit.handoff-bundle|triagekit.handoff.queue.v1|Handoff queue" site/app/index.html
rtk git diff --check
rtk git status --short
```

Expected: first search has no matches; second search finds the new schema, storage key, and UI copy; diff check is clean; only intended files plus the unrelated pre-existing `.impeccable/critique/` artifact appear.

- [ ] **Step 7: Commit verification-driven fixes and generated app**

```bash
rtk git add src test site/app/index.html docs/adr
rtk git commit -m "test: verify unified handoff workflow"
```

If Step 5 required no code or snapshot changes, do not create an empty commit.

