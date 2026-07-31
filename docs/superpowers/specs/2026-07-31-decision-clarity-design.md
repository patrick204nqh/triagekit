# Decision Clarity Design

**Date:** 2026-07-31  
**Status:** approved  
**Scope:** Insights scope, Kind-owned table columns, priority explanation, and Handoff summary copy

## Context

triagekit already has a strong operator-focused visual system, provider-neutral data model, browser-local Cached Dataset, configurable scoring, and bounded Handoff Queue. The next improvement is not a visual restyle. It is making each triage surface answer four questions more directly:

1. What scope am I looking at?
2. What needs attention?
3. Why does it have this priority?
4. What is ready to hand off?

The current UI weakens those answers in four places:

- Insights presents a global cross-surface briefing while retaining list-only repository, filter, sort, and Handoff controls.
- Shared table columns force every Kind to show Location, Title, Signal, Score, and Tier, producing duplicate or low-value columns.
- Built-in scoring shows a score and tier without the factor explanation available to configured scoring.
- The toolbar exposes the Handoff Queue's internal retained-entry count instead of its actionable ready count.

## Goals

- Make Insights scope explicit and consistent with the data used to compute it.
- Let each ready Kind show the columns needed for its triage decision.
- Present one compact Priority value in lists and a trustworthy explanation in details.
- Summarize Handoff work using operator language.
- Preserve the Chrome baseline and single self-contained HTML artifact.

## Non-goals

- Dependency-alert to pull-request correlation
- Persistent or non-modal detail inspection
- Keyboard next/previous navigation
- Progressive or virtualized table rendering
- New providers, Kinds, actions, or scoring formulas
- General runtime, shell, settings, or CSS refactoring
- New runtime dependencies

## Design

### 1. Global Insights presentation

Insights remains an operator briefing across every ready Kind and selected repository in the active Provider Connection. It does not inherit the active list's repository or filters.

While Insights is active, the toolbar replaces list controls with a read-only scope summary:

```text
GitHub · 3 repositories · all supported surfaces
```

Repository tabs, label summaries, filter, sort, bulk selection, and Handoff controls are not rendered in Insights. The count beside the Insights tab reflects the global snapshot's open item count; it must not reuse the active Kind's list count. If a reliable global count is unavailable, the count is omitted rather than inferred.

Insight actions continue to resolve to an explicit List route. The route selects its Kind, repository, and filters through the existing session API.

Partial refresh remains visible. The scope summary describes configured scope, while the existing partial-state warning identifies surfaces that did not refresh.

### 2. Kind-owned decision columns

The shared table owns semantic table structure, the optional Handoff selection column, row identity, and accessible interaction. It no longer mandates Location, Title, Signal, Score, and Tier.

Each ready `KindRenderer` declares its complete visible column set. Reusable shared column builders provide consistent repository, title, and priority cells without duplicating markup.

Initial column sets are:

#### Dependencies

```text
Repository | Dependency | Severity | Fix | Priority
```

`Fix` renders the patched version when known, `Available` when a fix exists without a version, and `No fix` otherwise.

#### Code scanning

```text
Repository | Finding | Rule | Severity | State | Priority
```

The finding title remains the detail-opening control. File or source location stays in the detail view and is not a list column in this iteration.

#### Change requests and issues

```text
Repository | Title | # | Author | Priority
```

The existing title remains the detail-opening control.

The Priority cell renders tier and numeric score together, for example `P0 · 178`. Tier color remains semantic and is never the sole indicator. Raw provider signal is removed from the list but remains available as scoring evidence.

Loading skeletons derive their column shape from the active Kind or use a neutral matching column count. They must not retain a dependency-specific Severity header on other surfaces.

### 3. Unified priority explanation

Scored items expose a single explanation contract for both configured and built-in scoring.

A configured model retains its current normalized signal evidence. A built-in scorer exposes the factors used by that scorer, including their raw values and contribution or reason. The explanation is produced from the same factor functions, constants, and evaluation time used to calculate the numeric score; views must not reverse-engineer scorer behavior.

The detail panel always shows:

- numeric score
- P0–P3 tier
- scorer source (`Built-in` or `Configured`)
- contributing factors in plain language

Example dependency explanation:

```text
Built-in priority · score 178 · P0
Critical severity + CVSS 9.8 + patched version available + runtime dependency
```

Configured models retain their factor table. Handoff projections continue receiving the same score evidence through the unified explanation contract.

If factor explanation cannot be produced because normalized data is missing or invalid, rendering falls back to:

```text
Built-in score · 178 · P0
```

Explanation failure never blocks list or detail rendering.

### 4. Actionable Handoff summary

The toolbar summarizes only work ready for the next Handoff bundle:

- No ready entries: `Handoff`
- Ready entries: `Handoff · 3 ready`

The accessible label continues to identify the control as opening the Handoff Queue and includes the ready count.

`Ready` means a selected entry whose status is `queued`, `current`, or `changed`. One shared eligibility predicate supplies both this count and Handoff package planning. Entries being checked are temporarily excluded until revalidation completes.

The composer remains the authoritative place for ready, changed, blocked, unavailable, and handed-off entry states. This iteration does not add a second composer summary. No queue persistence or transition behavior changes.

## Architecture

The existing provider → Cached Dataset → derivation → presentation pipeline remains intact.

- Toolbar rendering branches explicitly between List and Insights presentation.
- `KindRenderer` becomes the owner of all visible data columns.
- Shared column builders preserve consistent markup and accessibility.
- Derivation attaches or makes available the unified score explanation without rescoring in individual views.
- The current Handoff Queue and shared transfer-eligibility predicate supply the ready count; no second queue state is introduced.

These are targeted changes to existing seams. No generic enrichment framework, component system, state manager, or table library is added.

## State and navigation

Switching from List to Insights preserves repository, filters, sort, and queue state in the existing session and policy stores even though those controls are hidden. Switching back restores them unchanged.

Opening an Insight route remains an explicit state transition. The destination List receives only the route's declared repository and filters.

## Accessibility and responsive behavior

- Existing tab roles, keyboard navigation, visible focus, reduced-motion behavior, and native Chrome overlays remain unchanged.
- Priority always includes the textual P0–P3 tier.
- Table regions remain keyboard-focusable and horizontally scrollable at narrow widths.
- This iteration does not replace tables with mobile cards.
- Hidden Insights controls are absent from the accessibility tree, not visually concealed.

## Error handling

- Partial provider failures retain the existing visible warnings.
- Missing explanation data degrades to score and tier.
- A ready Kind must declare at least one column. Catalog construction rejects an empty column definition so the table cannot render a malformed header/body pair.
- All provider-derived cell and explanation content continues through existing escaping and sanitization boundaries.

## Verification

Tests must cover:

1. Insights renders global scope and global count from the same snapshot.
2. Insights omits repository, filter, sort, and Handoff controls.
3. Insight routes restore an explicitly scoped List state.
4. Every ready Kind renders matching headers and body cells.
5. Dependencies and code scanning no longer duplicate generic Title or Location data.
6. Priority renders tier and numeric score without a standalone Signal column.
7. Built-in scorers expose factors consistent with their calculated score.
8. Configured scoring retains normalized factor evidence.
9. Missing explanation data falls back without throwing.
10. The Handoff toolbar shows only ready state while the composer retains detailed states.
11. Keyboard, focus, reduced-motion, empty, partial, and loading behavior remains valid.
12. A production build still produces exactly one self-contained `dist/triage.html` with no external scripts, stylesheets, or module-preload links.

## Success criteria

- An operator can tell from Insights exactly what data the briefing covers.
- Every list column contributes to deciding what to inspect or act on.
- A default score is understandable without configuring a custom model.
- The Handoff toolbar communicates actionable work without internal queue terminology.
- No existing provider, Cached Dataset, action, Handoff transition, or single-file behavior regresses.
