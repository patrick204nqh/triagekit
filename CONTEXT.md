# Context

**Read this at every session start.** ↓ North Star (human, stable) stays above the line;
↓ Session State (AI-maintained) tracks active work.

---

## North Star — Project Identity

`triagekit` compiles into a single self-contained HTML dashboard for repo triage that runs
entirely in the browser — no backend, no build server, no third-party scripts. GitHub is
the first provider; it groups triage into **Findings** (Dependabot alerts, code scanning)
and **Work** (pull requests, issues), each scored, tiered, and sortable.

- TypeScript, compiled with `tsc`; tested with `vitest`
- Package `triagekit` (MIT) · repo `patrick204nqh/triagekit` · author Patrick (@patrick204nqh)

## Design

- **Palette:** Void Zinc (dark bg: `#1a1a1c`), Kelp Teal accent (`#2a7a6c`)
- **Type:** Space Grotesk (UI) + JetBrains Mono (code)
- **Priority ramp:** P0 (critical) → P1 (high) → P2 (medium) → P3 (low)
- Full system: `PRODUCT.md` (strategy/voice) and `DESIGN.md` (visual specs)

## CSS conventions

Never write new CSS before checking existing classes. Button system:
- Drawer foot actions → `.act` / `.act.primary` / `.act.danger`
- Drawer head icon buttons → `.drawer-close`
- Settings panels → `.btn-primary` / `.btn-ghost` / `.btn-ghost.mini`
- Toolbar → `.icon-btn`

## Key test commands

- `npm test` — full vitest suite (~450 tests, 81 pre-existing localStorage failures)
- `npm run build:cli` — compile `tsc`
- `npm run lint:anon` — anonymisation guard (run if you touch example data)
- `npm run build:pages` — rebuild demo HTML + Pages site

---

## Session State — Current Work

| Property | Value |
|----------|-------|
| **Branch** | `feat/agent-handoff` |
| **PR** | [#14](https://github.com/patrick204nqh/triagekit/pull/14) |
| **Status** | Feature implementation complete, iterative UX polish |

### Active work

**Agent Handoff** — "Generate brief" produces a reviewable handoff (Markdown + JSON)
inline inside the existing detail drawer. Mode switch: brief replaces body/foot,
`‹` back button restores the original detail view.

### Architecture snapshot

Four-unit pipeline: projector → validator → markdown renderer → transport (controller
wires them). Per-kind intent defaults in `handoff/intent.ts`. `kind-renderer.ts` carries
`HandoffController` on `DetailCtx`. `app-shell.ts` instantiates the controller.

### Recent commits (newest → oldest)

| Commit | What |
|--------|------|
| 2edfb1f | add CONTEXT.md as north star file, enforce reading at session start |
| c9be210 | back button: use drawer-close class + text entity, remove custom CSS |
| 2872b9c | fix brief button consistency: use .act system to match drawer footer pattern |
| 511717f | brief: add back arrow to restore original detail view |
| 8d7d56a | agent handoff: inline brief in detail drawer, remove separate brief-surface panel |
