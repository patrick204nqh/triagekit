# Context

**Read this at every session start.** The `<GOAL>`…`<GOAL_END>` block is human-authored
and stable — project identity, design system, code conventions. Below it: reference
sections (tooling, PR guidelines) and AI-maintained session state.

<GOAL>

**triagekit** — single self-contained HTML dashboard for repo triage, browser-only
(MIT · `patrick204nqh/triagekit` · Patrick). TypeScript, `tsc`, `vitest`.

## Design identity

`PRODUCT.md` (voice, strategy) and `DESIGN.md` (visual system). Read both before
UI work. `DESIGN.md` wins on visuals; `PRODUCT.md` wins on voice.

- **Palette:** Void Zinc dark bg (`#1a1a1c`), Kelp Teal accent (`#2a7a6c`)
- **Type:** Space Grotesk (UI) + JetBrains Mono (code)
- **Priority ramp:** P0 (critical) → P3 (low)

## Code conventions

- **Never commit real names/tokens.** Examples: `acme-corp`.
- **Use existing CSS classes first.** Button system: `.act` / `.act.primary` / `.act.danger`
  (drawer foot), `.drawer-close` (drawer head), `.btn-primary` / `.btn-ghost` (settings).
- **No trackers in build artifact.** Match surrounding code style.

<GOAL_END>

## Tooling

| Command | Purpose |
|---------|---------|
| `npm run build:cli` | compile CLI (`tsc`) |
| `npm run build:pages` | build demo HTML and Pages site |
| `npm test` | full vitest suite (~450 tests, 81 pre-existing localStorage failures) |
| `npm run lint:anon` | anonymisation lint (run if you touched example data) |
| `npm run pack:smoke` | npm pack smoke test |

Skills: `.claude/skills/` (git-ignored, shared with OpenCode). Primary design skill:
**`impeccable`** (`npx skills add https://github.com/impeccable-software/impeccable`).
OpenCode plugins: `superpowers`. Config: `.claude/settings.json` (committed),
`settings.local.json` (personal), `opencode.json`.

## PR guidelines

- **No AI co-author attribution** — no `Co-Authored-By` or AI footers (also in
  `.claude/settings.json`).
- `npm test` must stay green; run `lint:anon` if you touched example data.
- Keep PRs scoped; note verification in description.

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

