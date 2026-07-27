# Agent Handoff — implementation spec

**Based on:** `docs/agent-handoff-foundation.md` (product and architecture design)
**Date:** 2026-07-27
**Status:** Implementation spec (post-brainstorm, ready for planning)

## Overview

This spec captures the implementation decisions from the Agent Handoff brainstorm. It assumes the foundation doc's domain model, data contract, design principles, security requirements, accessibility rules, and testing strategy — this file covers only what changed or was decided during the brainstorm.

## File layout

New `src/runtime/handoff/` directory:

```
handoff/
  types.ts              // AgentHandoffV1 and all supporting types
  projector.ts          // pure: (ScoredItem, explanation?, session, intent) → AgentHandoffV1
  validator.ts          // pure: (handoff) → { valid: true } | { valid: false, errors: string[] }
  markdown.ts           // pure: (handoff) → string (deterministic Markdown)
  context.ts            // builds HandoffContextV1 from session snapshot
  intent.ts             // generates default outcome/constraints/verification from Kind
  controller.ts         // impure: wires projector → validator → brief-surface lifecycle
  brief-surface.ts      // DOM component: stacked drawer, editable fields, preview, transport
  adapters/
    clipboard.ts        // navigator.clipboard.writeText(markdown)
    download.ts         // Blob → programmatic anchor click
    types.ts            // TransportResult = { ok: boolean; error?: string }
```

## Integration seam

The handoff feature augments the existing detail-panel drawer, not the core rendering pipeline.

### Entry point

`detail-panel.ts` appends a "Continue with agent" button to the drawer footer (`foot` element) after the kind-specific actions. It is always present when a complete `ScoredItem` is open. The button is a ghost-style button (per DESIGN.md) with a Kelp Teal icon.

### Brief surface

A stacked drawer that overlays the detail-panel drawer:

```
z-index hierarchy:
  scrim          → page dim (existing)
  detail drawer  → existing
  brief scrim    → thinner overlay (~20% opacity)
  brief drawer   → narrower: min(460px, 80vw)
```

The brief surface slides in from the right with the same spring easing as the detail drawer. Closing it restores focus to the "Continue with agent" button.

### Controller lifecycle

```
openBrief(item, explanation, session):
  1. project(item, explanation, session, currentIntent)
  2. validate(handoff)
  3. briefSurface.render(handoff, errors)
  4. briefSurface.open()  → slides in, focuses heading

onEdit(field, value):
  1. Merge edited intent (outcome, constraints, verification)
  2. Re-render preview via markdown.ts
  3. No re-validation until transport attempted

onCopy():
  1. markdown(handoff) → text
  2. clipboard.writeText(text)
  3. Show accessible status message

onDownload(format):
  1. content = format === 'md' ? markdown(handoff) : JSON.stringify(handoff)
  2. blob = new Blob([content], { type })
  3. triggerDownload(filenameFor(handoff, format))

onClose():
  1. briefSurface.close()
  2. Focus returns to "Continue with agent" button
  3. Handoff state is ephemeral — discarded on close
```

The controller maintains `currentIntent` as a reactive object so edits flow back into the preview without creating a new handoff from scratch.

The ViewModel and ViewPort do not change. The controller lives outside `createCore` — it is instantiated by the shell module that owns the detail panel.

## Kind projection

Each `KindDeclaration` in `catalog/types.ts` grows an optional field:

```ts
projectTarget?: (item: TriageItem) => Omit<HandoffTargetV1, 'id' | 'kind' | 'provider' | 'url'>;
```

The `projector.ts` implementation:

1. Build base target from `TriageItem` (id, kind, provider, url)
2. Call kind's `projectTarget()` for kind-specific fields (title, location, providerReference, priority, details)
3. If no `projectTarget`, fill from item's surface fields only (minimal fallback)
4. Build `HandoffContextV1` from session snapshot
5. Apply intent (defaults overridden by operator edits)
6. Return immutable `AgentHandoffV1`

For phase 1, every ready kind needs a `projectTarget`. Non-ready/roadmap kinds produce a minimal fallback.

## Intent defaults

`handoff/intent.ts` provides per-kind defaults:

```
dependency-vuln → "Review and remediate the vulnerable dependency"
code-scanning   → "Review and address the code scanning alert"
change-request  → "Review and merge the pull request"
issue           → "Triage and respond to the issue"
```

Fallback: `"Review this item"`. Defaults must not fabricate details — they use only fields guaranteed on the `TriageItem` surface.

## Validation

```
- schema === "triagekit.agent-handoff" AND version === 1
- targets.length === 1
- outcome is non-empty after trim
- target.url is a non-empty valid URL
- target.id is non-empty
- target.provider is non-empty and matches a known provider in the catalog
- all string values ≤ 10KB each
- handoff JSON ≤ 500KB total
- no known secret-shaped keys in providerReference or details
  (reject keys matching /token|secret|key|password|auth/i)
```

Errors are field-level, shown inline, and disable all transport. Non-blocking warnings show as a note in the preview.

## Transport adapters

### clipboard.ts
- Calls `navigator.clipboard.writeText(markdown)`
- Catches `NotAllowedError` → `{ ok: false, error: "Clipboard access denied." }`
- Preview text remains selectable as fallback

### download.ts
- `downloadMarkdown(handoff)` — Blob with `text/markdown`
- `downloadJSON(handoff)` — Blob with `application/json`
- Filename: `triagekit-{kind}-{providerId}.{md|json}`
- Components sanitized and length-bounded
- Button shows exact filename before activation
- Falls back gracefully if download is blocked (sandboxed context)

## What's not in Phase 1

Per the foundation doc: no batch targets, no related items, no MCP, no local companion, no browser extension, no deep links, no result import, no arbitrary filesystem writes. The existing `docs/agent-handoff-foundation.md` roadmap (Phases 2–5) remains the forward plan.

## Changes to existing modules

### catalog/types.ts
- Add `projectTarget?: (item: TriageItem) => Omit<HandoffTargetV1, 'id' | 'kind' | 'provider' | 'url'>` to `KindDeclaration`

### layout/table/detail-panel.ts
- Append "Continue with agent" button to `foot` element
- Import and wire handoff controller

### No other changes to existing modules
- ViewModel unchanged
- ViewPort unchanged
- No new ports
- No new store dependencies
