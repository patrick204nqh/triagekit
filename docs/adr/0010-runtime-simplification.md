# ADR-0010: Runtime simplification through native and established libraries

**Date:** 2026-07-31  
**Status:** accepted  
**Scope:** balanced Ponytail architecture audit, Chrome baseline

## Goal

Reduce custom runtime and tooling code by deleting unused paths, delegating
generic behavior to browser and Node APIs, reusing Zod at trust boundaries,
and adopting `idb` for IndexedDB mechanics. Preserve triagekit's behavior and
its defining output: one self-contained `dist/triage.html` file.

## Constraints

- Chrome is the supported browser baseline for native dialog and popover APIs.
- `dist/` must contain exactly `triage.html` after a production build.
- The artifact must contain no script `src`, stylesheet link, or module-preload
  link. Runtime provider requests are data access, not artifact dependencies.
- `idb` is the only new dependency.
- Existing roadmap providers and Kinds remain visible and unchanged.
- Provider behavior, scoring, cache policy, handoff semantics, and session
  behavior remain unchanged unless this design explicitly says otherwise.
- Invalid browser-controlled or provider-controlled data must still fail safely.
- Existing unrelated worktree content is out of scope.

## Approach

Use surgical, independently verifiable phases. Delete code before replacing
code; use native APIs before dependencies; use installed Zod before writing
additional validators. Do not add compatibility wrappers, registries, or
fallback implementations.

## 1. Remove code without a production responsibility

Delete production-unreachable modules and their dedicated tests:

- `src/runtime/adapters/timer.ts`
- `src/runtime/core/scope-key.ts`
- `src/runtime/handoff/adapters/clipboard.ts`
- `src/runtime/handoff/adapters/types.ts`
- `src/runtime/ingest/github/urls.ts`
- `src/runtime/insights/capabilities.ts`

Delete the unused store implementation in `src/runtime/core/store.ts`. Move
the small `StoreStats` view-model shape to `src/runtime/core/view-model.ts`,
where its only production consumer lives.

Remove these public runtime APIs used only by tests when their underlying
production behavior is already exercised elsewhere:

- `createProductionCatalog`
- `listArtifacts` and `artifactOf`
- `isBot`
- `classOf`
- `permalinkLinkHtml`
- `healthOf`
- `getRefreshInterval` and `setRefreshInterval`
- `listDecorators` and `registerDecorator`
- the unused `ReviewActions` interface
- the legacy `KindRefreshOutcome`, `RefreshRequest`, `ProviderAdapter`, and
  `ProviderDeclaration.adapter` catalog path

Update tests to cover production entry points instead of preserving APIs for
tests.

## 2. Collapse the one-implementation decorator registry

`withBotPolicy` is the only production decorator. `derive` will call it
directly. Delete mutable decorator registration, decorator metadata, and tests
for hypothetical additional decorators. Keep the bot-policy behavior test at
the derivation boundary.

## 3. Replace Commander with Node standard library parsing

The CLI has one command, `build`, and two options. Replace Commander with
`node:util.parseArgs` plus a small explicit command check. Preserve:

- `triagekit build`
- `-c, --config <path>` with `triage.config.yml` as the default
- `--generic`
- short usage output and a non-zero exit code for invalid input

Remove `commander` from runtime dependencies.

## 4. Reuse Zod at trust boundaries

Keep schemas colocated with the state they validate; do not create a schema
registry.

### Handoff queue and focus policy

Parse JSON once, call `safeParse`, and normalize successful values. Malformed
or unknown stored fields return the existing empty/default state without
throwing. Notes continue to be trimmed. Invalid queue entries are discarded
while valid siblings are retained, matching current behavior.

### Handoff bundle validation

Use Zod for structural checks such as required fields, primitive types, enum
values, and collection bounds. Preserve explicit semantic checks for:

- the complete investigate-mode authorization boundary
- unique and deterministic package IDs/order
- target repository and Kind matching its package
- forbidden secret-bearing field names
- string and serialized bundle size ceilings
- the existing structured validation-error result

Runtime-invalid input must produce validation errors rather than throw.

## 5. Delegate IndexedDB mechanics to `idb`

Use `openDB` and its promise-based database/transaction API inside
`indexed-db-persistence.ts`. Remove custom request, transaction-completion, and
database-opening wrappers.

Retain triagekit-owned policy and semantics:

- separate slices and generation stores
- newest-generation-wins commits
- atomic transaction boundaries
- connection hydration and removal
- retention and soft-byte pruning
- immutable copies returned to callers
- fallback to memory persistence with a visible warning

No `idb` object crosses the `DatasetPersistence` interface.

## 6. Replace custom overlay infrastructure with Chrome APIs

Delete `src/runtime/shell/dismissible.ts` after all callers migrate. Do not
replace it with another wrapper.

### Modal surfaces

Settings, item detail, and handoff composer become `<dialog>` elements opened
with `showModal()` and closed with `close()`. Delete their custom scrim elements
and move scrim styling to `::backdrop`.

The dialog `cancel` event, close controls, and backdrop clicks route through
each surface's existing close/discard function. This preserves draft rollback,
controller state, and detail-selection state. Native Chrome behavior owns
modality, background inertness, focus trapping, and normal focus restoration.
The handoff composer keeps its existing explicit focus-return behavior.

### Light-dismiss menus

Toolbar filter/sort menus and repository overflow use `popover="auto"` and the
native popover show/hide APIs. The application continues to synchronize
`aria-expanded` and perform selection callbacks; Chrome owns Escape,
outside-click dismissal, and top-layer ordering.

## Data flow

No domain flow changes:

1. Provider data is fetched and normalized as today.
2. Cached Dataset persistence still implements `DatasetPersistence`; only its
   IndexedDB mechanics change.
3. Core derivation applies bot policy directly, scores, filters, and renders.
4. Shell controllers continue to own settings, detail, and handoff state;
   dialogs and popovers only replace presentation mechanics.
5. Vite bundles all runtime modules and dependencies, then
   `vite-plugin-singlefile` inlines JavaScript, CSS, fonts, Zod, `idb`, Marked,
   and DOMPurify into `triage.html`.

## Error handling

- Storage schema failures degrade to empty/default state, never startup failure.
- IndexedDB open or transaction failures still activate memory fallback.
- Handoff validation continues to return field-addressable errors.
- Dialog dismissal always passes through existing state-owner functions.
- CLI parse failures print usage and exit non-zero.
- No security, accessibility, or data-loss guard is removed for line-count
  reduction.

## Testing strategy

Implementation follows red-green-refactor with the smallest relevant Vitest
file per phase.

- Add architecture guards that fail while dead files, Commander, the decorator
  registry, and custom IndexedDB promise wrappers remain.
- Keep a derivation-level bot-policy test before deleting registry tests.
- Add CLI tests for supported arguments and invalid command/option handling.
- Add storage tests proving unknown focus-policy fields reset safely and mixed
  queue entries retain only valid entries.
- Add handoff tests proving malformed runtime shapes return errors rather than
  throwing, while semantic and secret-field checks remain.
- Add overlay tests that stub native Chrome methods and verify dialogs and
  popovers are opened/closed through the expected application state owners.
- Retain IndexedDB behavior tests against `fake-indexeddb` while changing the
  implementation to `idb`.
- Strengthen the build smoke check to assert that `dist/` contains only
  `triage.html`, with no script `src`, stylesheet link, or module-preload link.

Final verification runs `npm run typecheck`, `npm test`, `npm run lint:anon`,
and a fresh CLI/generic build plus the strengthened artifact check.

## Acceptance criteria

- All scoped custom infrastructure is deleted or delegated as described.
- Existing user-visible workflows and roadmap entries remain intact.
- Malformed trust-boundary data fails safely.
- Modal and light-dismiss behavior uses native Chrome APIs.
- `idb` is the only added dependency and Commander is removed.
- A fresh production build produces exactly one self-contained
  `dist/triage.html` artifact.
- Typechecking, tests, anonymisation lint, and artifact checks pass.

## Out of scope

- Removing roadmap providers or upcoming Kinds
- Introducing Lit, Preact, `p-queue`, or `p-retry`
- Redesigning UI appearance or copy
- Changing GitHub scheduling, cache policy, scoring, or handoff contracts
- Adding non-Chrome fallbacks
