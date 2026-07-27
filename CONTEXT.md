# Context

This file is the North Star for coding agents. Read it at session start — it contains
active project state, current work, and critical conventions not covered by AGENTS.md.

## Active branch
- `feat/agent-handoff` — Agent Handoff feature for triage items
- PR #14 open at https://github.com/patrick204nqh/triagekit/pull/14

## Feature summary
"Generate brief" produces a reviewable agent handoff (Markdown + JSON) for a triage item.
The brief renders inline inside the existing detail drawer (mode switch, no stacked panel).

### UX flow
1. Click a row → detail drawer slides in
2. Click "Generate brief" → drawer body/foot replaced with brief content
3. A `‹` back button in the drawer head restores the original detail view
4. Actions: Copy Markdown (primary), Download .md, Download .json

### Architecture
Four-unit handoff pipeline: projector → validator → markdown renderer → transport
(controller wires them). Per-kind intent defaults in `handoff/intent.ts`.

## Key files
- `src/runtime/handoff/controller.ts` — data/transport methods, no surface management
- `src/runtime/layout/table/detail-panel.ts` — `showBriefInDrawer()` inline render
- `src/runtime/layout/table/kind-renderer.ts` — `HandoffController` field on `DetailCtx`
- `src/runtime/shell/app-shell.ts` — controller instantiation

## CSS conventions
- Buttons: `.act` / `.act.primary` / `.act.danger` (drawer foot), `.btn-primary` / `.btn-ghost` (settings)
- Icon buttons in drawer head: `.drawer-close`
- Toolbar icon buttons: `.icon-btn`
- Never write new CSS before checking existing classes

## Design
- Void Zinc palette, Kelp Teal accent
- Space Grotesk (UI) + JetBrains Mono (code)
- P0–P3 priority ramp
- See `PRODUCT.md` and `DESIGN.md` for full design system

## Tests
- `npm test` — full vitest suite (~450 tests)
- 81 pre-existing localStorage failures (unrelated to this work)
- All handoff+dashboard tests pass
