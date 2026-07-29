# Context

**Read this at every session start.** The `<GOAL>`…`<GOAL_END>` block is human-authored
and stable — project identity, design system, code conventions. Below it: reference
sections (tooling, PR guidelines). This file tracks stable context only — active work
state lives in the current conversation.

<GOAL>

**triagekit** — single self-contained HTML dashboard for repo triage, browser-only
(MIT · `patrick204nqh/triagekit` · Patrick). TypeScript, `tsc`, `vitest`.

## Design identity

Read `PRODUCT.md` (voice, strategy) and `DESIGN.md` (visual system) before UI work.
`DESIGN.md` wins on visuals; `PRODUCT.md` wins on voice.
Architecture decisions: `docs/adr/README.md`. Load relevant ADRs per task.

## Code conventions

- **Never commit real names/tokens.** Examples: `acme-corp`.
- **Use existing CSS classes first.** Button system: `.act` / `.act.primary` / `.act.danger`
  (drawer foot), `.drawer-close` (drawer head), `.btn-primary` / `.btn-ghost` (settings).
- **No trackers in build artifact.** Match surrounding code style.

<GOAL_END>

## Domain language

**Cached Dataset**:
Provider-fetched triage data retained in browser-controlled storage across sessions. It is partitioned by provider and scope, has bounded retention, and never contains provider credentials.
_Avoid_: response cache, offline copy, persisted token data

**Provider Connection**:
A user-authorized relationship with one provider, one credential identity, and a selected triage scope. A Cached Dataset belongs to exactly one Provider Connection and is never visible through another.
_Avoid_: account, integration, source

**Dataset Slice**:
The portion of a Cached Dataset for one Kind and one provider target within one Provider Connection. A refresh replaces each Dataset Slice atomically; a failed target leaves its prior Slice available and visibly stale while other targets can become fresh.
_Avoid_: response page, result batch

**Triage Action**:
A provider-neutral operator intent applied to one triage item, such as merge, close, comment, label, or assign. Its availability, validation, and provider implementation are defined together.
_Avoid_: provider command, raw request, mutation payload

## Source architecture

triagekit has 4 layers compiled into 2 artifacts:

| Directory | Purpose | Artifact |
|-----------|---------|----------|
| `src/cli/` | CLI entry point + `build` command | `dist-cli/` (Node binary) |
| `src/config/` | YAML schema + loading (shared by CLI & runtime) | inlined into CLI |
| `src/runtime/` | Browser-side application (Vite-built) | `dist/triage.html` (single-file artifact) |
| `src/vite/` | Vite plugins (singlefile + CSP) | inlined at build time |

**Runtime architecture (`src/runtime/`):**

```
core/         → state management (createCore → derive → render)
dataset/      → data model (items, kinds, scoring)
providers/    → GitHub API adapters (one per provider)
kinds/        → item types (dependency-vuln, code-scanning, issue, PR)
scoring/      → scoring engine (tier, weights, formulas)
views/        → UI views (table, insights, detail)
shell/        → app shell (command bar, sidebars, theme)
layout/       → layout components (toolbar, panels, drawers)
session/      → URL/session state persistence
catalog/      → error/failure types
adapters/     → transport adapters (clipboard, downloads)
handoff/      → agent handoff (projector, validator, renderer)
bootstrap.ts  → app initialization
main.ts       → entry point
```

## Testing conventions

- Mirror layout with `src/`: `src/runtime/core/core.ts` → `test/runtime/core/core.test.ts`
- Framework: Vitest with `describe` / `it` / `expect`
- One test file per source file; at least one test per exported function
- `test/helpers/` for shared utilities across tests
- `test/support/` for test fixtures and factories
- `test/site/` for e2e-style build artifact tests
- Known: 81 pre-existing localStorage test failures (not blocking merge)
- New features must include tests; pure refactors maintain current test coverage

## Naming conventions

- Files: kebab-case (`score-model.ts`, `author-policy.ts`)
- Functions/variables: camelCase (`derive()`, `createCore()`)
- Types/interfaces: PascalCase, usually with domain suffix (`CoreDeps`, `TriageFailure`, `ScoreContext`)
- Exports: named exports preferred, except for a few known Vite plugin entry points
- Constants: SCREAMING_SNAKE_CASE (`testExclude` in vitest.config.ts)

## Tooling

| Command | Purpose |
|---------|---------|
| `npm run build:cli` | compile CLI (`tsc`) |
| `npm run build:pages` | build demo HTML and Pages site |
| `npm test` | full vitest suite (~450 tests, 81 pre-existing localStorage failures) |
| `npm run lint:anon` | anonymisation lint (run if you touched example data) |
| `npm run pack:smoke` | npm pack smoke test |
| `npm run typecheck` | typecheck both CLI and runtime |
| `npm run check` | full pre-commit suite: typecheck + test + lint + build + pages |

Skills: `.claude/skills/` (git-ignored). Design: `impeccable`. Plugins: `superpowers`.
Config: `opencode.json`, `.claude/settings.json`.

## PR guidelines

- **No AI co-author attribution** — no `Co-Authored-By` or AI footers (also in
  `.claude/settings.json`).
- `npm test` must stay green; run `lint:anon` if you touched example data.
- Keep PRs scoped; note verification in description.

## Inline planning pattern

For multi-step tasks, emit a lightweight plan before executing:

```
PLAN:
1. Step one — brief
2. Step two — brief
→ Executing unless you redirect.
```

This catches wrong directions before work is baked in.

## Confusion management

When spec and existing code conflict, surface it explicitly rather than silently picking:

```
CONFUSION:
Spec says X, but existing code does Y.

Options:
A) Follow spec — change code
B) Follow existing pattern — update spec
C) Ask — seems intentional

→ Which approach?
```
