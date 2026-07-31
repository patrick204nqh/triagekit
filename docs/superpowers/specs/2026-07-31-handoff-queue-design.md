# Handoff Queue Design

**Date:** 2026-07-31  
**Status:** Design approved; written spec awaiting review  
**Supersedes:** The product-facing single-item Agent Handoff flow and Delegation Queue/Bundle model described by ADR-0001 and ADR-0008

## Summary

triagekit will replace its two overlapping agent-transfer concepts with one Handoff Queue.

The operator selects focused items, chooses whether the agent may only investigate or may implement changes, optionally adds one mission note, and copies a bounded handoff. triagekit supplies safe generated instructions and organizes targets by repository and Kind. The human does not write the same prompt for every package.

```text
select focused work
  → review the Handoff Queue
  → choose Investigate or Implement
  → optionally add one mission note or item exceptions
  → copy a bounded Handoff Bundle
  → confirm handed off
```

## Problem

The current experience has two transfer paths:

- an item drawer can generate and transfer a single-target Agent Handoff;
- the Delegation Queue can compose a multi-package Delegation Bundle.

The queue also exposes Outcome, Constraints, and Verification fields on every repository-and-Kind package. When several packages need the same treatment, the operator must repeat the same instruction. This makes prompt authoring the dominant task even though triagekit already knows the selected Kind, repository, priority, and safe context.

The current wording also splits one user intention across “handoff,” “delegation,” “brief,” “target,” and “package.” The product needs one transfer model and one clear permission boundary.

## Goals

- Make one Handoff Queue the only agent-transfer workflow.
- Let an operator hand off selected focus items without writing a prompt.
- Make agent authorization explicit: investigate only or implement changes.
- Apply one optional human mission note to the whole handoff.
- Allow a concise optional note for an exceptional target.
- Keep repository and Kind boundaries for context quality and safety.
- Preserve bounded packages, target revalidation, safe projection, portable transport, confirmation, and undo.
- Keep the browser-only, single-file architecture and Operator’s Cockpit design.
- Remove legacy concepts rather than maintaining compatibility aliases.

## Non-goals

- Durable handoff backlogs or project management.
- Direct agent execution, MCP transport, or result import.
- Per-repository prompt templates.
- Per-package Outcome, Constraints, or Verification editors.
- Vendor-specific prompt formats.
- Multi-user assignment.
- Automatic escalation from Investigate to Implement.

## Product Language

Use these terms in product copy, source names, contracts, and tests:

- **Handoff Queue:** session-scoped selection for one agent mission.
- **Handoff Bundle:** the portable Markdown or JSON transfer.
- **Handoff Package:** one bounded repository-and-Kind group inside a bundle.
- **Handoff mode:** the queue-wide agent authorization boundary.
- **Mission note:** optional human guidance that applies to every package.
- **Item note:** optional human guidance for one selected target.

Remove product-facing uses of:

- Delegation Queue
- Delegation Bundle
- Work Package
- Agent brief
- Generate brief

“Package” remains valid only as a structural unit inside a Handoff Bundle.

## Core Model

One Handoff Queue represents one mission. It may contain several repositories and Kinds, but every selected target shares:

- one Handoff mode;
- one optional mission note;
- one transfer lifecycle.

triagekit groups targets by repository and Kind so each package remains coherent and independently usable. Grouping organizes context; it does not create another prompt form.

### Handoff modes

The queue has two modes:

#### Investigate

Investigate is the default for every new queue.

The generated handoff tells the agent to:

- inspect and analyze the selected targets;
- gather evidence and identify risks or uncertainty;
- report findings and unanswered questions;
- outline a concrete action plan;
- make no file changes;
- create no commits or pushes;
- perform no provider mutations or other external actions.

Running read-only inspection commands is allowed. Commands that normally produce incidental local caches or test artifacts are outside the default investigation request; the agent should avoid them unless required to obtain evidence and should disclose any such side effects.

#### Implement

Implement explicitly authorizes scoped changes for the selected targets.

The generated handoff tells the agent to:

- make only changes needed for the selected targets;
- respect repository and package boundaries;
- preserve unrelated behavior;
- run proportionate verification;
- report changes, verification, remaining risks, and blockers;
- avoid external publication or deployment unless the handoff explicitly requests it.

Implement does not implicitly authorize commits, pushes, pull requests, merges, deployments, or provider mutations. Those actions require explicit text in the mission or item note.

### Mode presentation

The mode control appears at the top of the Handoff Queue:

```text
Handoff mode

[ Investigate ]  Analyze and propose a plan. Make no changes.
[ Implement   ]  Make scoped changes and verify the result.
```

Mode is also visible in:

- the queue header;
- the Markdown preview;
- JSON instructions;
- every package’s generated instruction;
- the primary action label.

The primary action reads:

- `Copy investigation handoff`
- `Copy implementation handoff`

Switching mode never changes queue membership or notes. No confirmation modal is added for switching. The persistent control, generated preview, and explicit copy label make the authorization visible.

## Prompt and Instruction Hierarchy

The final instruction is assembled in this order:

1. **Mode boundary:** generated, mandatory, and queue-wide.
2. **Generated Kind instruction:** derived from the package Kind.
3. **Mission note:** optional human text applied to every package.
4. **Item note:** optional human text applied only to its target.
5. **Projected target context:** generated allow-listed facts and freshness disclosures.

Later layers add specificity but cannot weaken the mode boundary. In Investigate mode, a note such as “fix this” does not authorize changes. Validation rejects an Investigate bundle if its generated no-change boundary is absent.

Initial generated Kind instructions:

- dependency vulnerability: investigate or remediate the vulnerable dependency;
- code scanning: investigate or address the scanning finding;
- change request: review the proposed change or implement the requested adjustment;
- issue: investigate the issue or implement the scoped resolution.

The exact verb follows the selected mode. Empty notes do not appear in Markdown or JSON.

## End-to-End Experience

### Select

Remove the item drawer’s `Generate brief` action and its separate brief view, preview, copy, and download controls.

The table and item drawer use:

- `Add to handoff`
- `Remove from handoff`

The focused list retains individual selection and `Add visible`. Selection continues to respect the current Provider Connection scope, repository order, Kind, and active filters.

### Review

Opening the Handoff Queue shows:

1. queue title and selected/retained counts;
2. Investigate/Implement mode;
3. one optional mission note;
4. revalidation and transfer status;
5. repository groups in Focus Policy order;
6. Kind groups within each repository;
7. compact targets with priority, freshness, status, and optional note action;
8. targets not eligible for the next bundle;
9. handed-off targets;
10. preview only when needed for disclosure or transport fallback;
11. download menu and one primary copy action.

Every target exposes `Add note`. After a note exists, the control becomes `Edit note`, and the note is visible inline. Removing all note text removes the note from stored and exported data.

The queue does not render editable Outcome, Constraints, or Verification fields per package.

### Package

The planner remains pure and deterministic:

1. resolve selected queue identities against the current Cached Dataset;
2. follow repository priority;
3. group by repository and Kind;
4. sort targets by P level, score, and stable identity;
5. split after ten targets;
6. include at most five packages in one Handoff Bundle.

More than five packages remain selected for the next transfer.

### Revalidate

Existing states and behavior remain:

- queued
- checking
- current
- changed
- resolved
- unavailable
- blocked
- handed off

Resolved targets become deselected but remain visible. Unavailable targets may use disclosed stale context. A blocked target blocks only its package. Revalidation never silently deletes a queue entry.

### Transfer

Combined Markdown remains the primary transport. JSON and Markdown downloads remain available. Individual package copy/download remains available as a secondary action when a bundle has multiple packages.

A successful copy does not immediately clear or remove targets. The queue asks the operator to `Confirm handed off`; confirmation moves transferred targets to the handed-off section. Undo restores the previous queue state.

Clipboard denial keeps a selectable Markdown preview and download actions available.

## Data and Contracts

This is an intentional breaking replacement. Do not keep compatibility aliases.

```ts
type HandoffMode = "investigate" | "implement";

interface HandoffQueueEntry {
  readonly identity: HandoffIdentity;
  readonly selectedAt: number;
  readonly selected: boolean;
  readonly status: HandoffQueueStatus;
  readonly note?: string;
  readonly reason?: string;
  readonly changedFields?: readonly string[];
  readonly handedOffAt?: number;
}

interface HandoffQueueState {
  readonly mode: HandoffMode;
  readonly missionNote?: string;
  readonly entries: readonly HandoffQueueEntry[];
}

interface HandoffInstructionsV1 {
  readonly mode: HandoffMode;
  readonly missionNote?: string;
  readonly generatedFrom: "explicit-session-queue";
  readonly processPackagesInOrder: true;
}

interface HandoffPackageV1 {
  readonly id: string;
  readonly order: number;
  readonly repository: string;
  readonly kind: Kind;
  readonly generatedIntent: HandoffIntent;
  readonly targets: readonly HandoffTargetV1[];
}

interface HandoffBundleV1 {
  readonly schema: "triagekit.handoff-bundle";
  readonly version: 1;
  readonly createdAt: string;
  readonly focus: HandoffFocusV1;
  readonly instructions: HandoffInstructionsV1;
  readonly packages: readonly HandoffPackageV1[];
}
```

Each `HandoffTargetV1` has an optional explicit `note` field. Human notes are not hidden inside provider details.

Replace the queue storage key with:

```text
triagekit.handoff.queue.v1
```

Queue mode, mission note, target notes, membership, and status are session-only. No migration reads the old delegation key. Losing an open pre-upgrade queue is acceptable because the data is intentionally ephemeral and contains no durable work ownership.

## Source Architecture

Consolidate the workflow under `src/runtime/handoff/`:

```text
handoff/
  browser-queue-store.ts
  controller.ts
  intent.ts
  markdown.ts
  planner.ts
  projector.ts
  queue.ts
  revalidation.ts
  types.ts
  validator.ts
  adapters/
```

Move the queue composer to `src/runtime/layout/handoff/`.

Delete the legacy single-target controller, contract, drawer brief renderer, and duplicate Markdown path. Rename delegation-specific controller methods, CSS classes, data attributes, fixtures, and tests where they describe the product concept. Shared safe-value validation and transport adapters remain, but use Handoff names.

The DOM stays an adapter. Mode rules, prompt assembly, package planning, projection, and validation remain pure and independently testable.

Add a new ADR that supersedes ADR-0001 and ADR-0008. Historical ADRs remain in the repository as records and point readers to the new decision.

## Safety and Validation

- Every bundle contains one to five packages.
- Every package contains one to ten targets from one repository and one Kind.
- Investigate bundles include the generated no-change boundary.
- Human notes cannot weaken generated mode authorization.
- Implement authorizes local scoped changes only unless notes explicitly expand external actions.
- Credentials, raw headers, raw provider responses, comments archives, diffs, and action payloads remain forbidden.
- Human-authored and provider-authored text is escaped in rendered HTML and Markdown.
- Body fields remain bounded with explicit truncation disclosure.
- Secret-suggesting fields block only the affected package.
- Mode, mission note, target notes, freshness, and truncation are present in JSON and Markdown consistently.

## Visual and Accessibility Requirements

`PRODUCT.md` and `DESIGN.md` remain authoritative.

- Preserve the dense Operator’s Cockpit composition.
- Use existing button and input systems.
- Use Kelp Teal only for interaction and positive state.
- Do not use P0–P3 colors to distinguish Handoff modes.
- Render the mode as a clear two-option control with text descriptions, not color alone.
- Keep repository names, counts, priority, scores, and timestamps in JetBrains Mono.
- Keep interface prose and notes in Space Grotesk.
- Every action is keyboard reachable with a visible focus ring.
- Mode exposes its selected state with native or equivalent accessible semantics.
- Item note editing returns focus to the originating item.
- Queue state changes use the existing polite live region.
- At narrow widths, the queue is full-width and keeps mode plus the primary action reachable.
- Existing reduced-motion behavior remains.

## Testing

### Pure behavior

- New queues default to Investigate.
- Mode switching preserves selection and notes.
- Prompt assembly follows mode, Kind, mission note, item note, and context order.
- Investigate validation requires the no-change boundary.
- Human text cannot override Investigate authorization.
- Implement output authorizes scoped local edits but not external publication.
- Empty notes are omitted.
- Repository-and-Kind grouping and bundle limits remain deterministic.
- Markdown and JSON represent the same mode and notes.

### Queue behavior

- Individual add/remove and `Add visible`.
- Mission note and item notes persist in session storage.
- Clearing note text removes stored note data.
- Revalidation preserves notes and mode.
- Copy, confirmation, handed-off history, and undo preserve correct mode-independent queue state.
- The obsolete delegation storage key is ignored.

### Integration

- No `Generate brief` action or single-item brief surface remains.
- `Add to handoff` from table and drawer updates the same queue.
- Investigate and Implement produce visibly different primary labels and generated output.
- Mixed repositories and Kinds produce bounded ordered packages without repeated prompt fields.
- Blocked, resolved, unavailable, stale, and clipboard-denied paths remain usable.
- The single-file build and CSP remain valid.

### Accessibility and visual verification

- Keyboard operation for selection, mode, notes, package actions, and transfer.
- Accessible selected state and descriptive mode text.
- Focus restoration after note editing and item removal.
- Dark/light themes at desktop and narrow widths.
- Reduced-motion verification.

## Acceptance Criteria

- The app exposes one Handoff Queue and no Agent Brief or Delegation Queue workflow.
- A selected focused item can reach a useful handoff without human-authored prompt text.
- Every new queue defaults to Investigate.
- Investigate clearly prohibits changes and requests findings plus an action plan.
- Implement clearly authorizes scoped local changes and verification.
- The operator writes a repeated instruction at most once as a mission note.
- An exceptional target can carry one optional item note.
- No package-level prompt fields appear.
- Packages remain bounded by repository, Kind, target count, and bundle count.
- Existing revalidation, safe projection, download, confirmation, and undo guarantees remain.
- Old session queue data is not migrated.
- The single-file build, CSP, anonymization rules, keyboard access, and WCAG 2.1 AA requirements remain valid.
