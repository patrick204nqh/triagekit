# Context

**Read this at every session start.** The `<GOAL>`…`<GOAL_END>` block (top) is
human-authored and stable — project identity, design system, CSS conventions, test
commands. Below it is AI-maintained session state — update when work shifts.

<GOAL>

`triagekit` (MIT) · repo `patrick204nqh/triagekit` · author **Patrick (@patrick204nqh)**
— single self-contained HTML dashboard for repo triage, runs entirely in the browser.
TypeScript, compiled with `tsc`; tested with `vitest`.

## Build and test commands

| Command | Purpose |
|---------|---------|
| `npm run build:cli` | compile CLI (`tsc`) |
| `npm run build:pages` | build demo HTML and Pages site |
| `npm test` | full vitest suite (~450 tests, 81 pre-existing localStorage failures) |
| `npm run lint:anon` | anonymisation lint (run if you touched example data) |
| `npm run pack:smoke` | npm pack smoke test |

PR checklist: `npm test` must stay green; run `lint:anon` if you touched example data.

## Code style and conventions

- **Never commit real repo names or tokens.** Examples use fictional `acme-corp` data.
- **No trackers in build artifact.** Analytics live only on the hosted landing/site.
- **Use existing CSS classes first** — never write new CSS before checking what exists.
  Button system: `.act` / `.act.primary` / `.act.danger` (drawer foot),
  `.drawer-close` (drawer head), `.btn-primary` / `.btn-ghost` (settings panels).
- Match surrounding code style; output is a single self-contained HTML file.

## PR and commit guidelines

- **No AI co-author attribution** — no `Co-Authored-By` or AI footers (also enforced
  in `.claude/settings.json`).
- Keep PRs scoped; note verification (e.g. `npm test` result) in the description.

## Design context

`PRODUCT.md` (register, users, brand personality, voice) and `DESIGN.md` (visual system:
Void Zinc palette, Kelp Teal accent, Space Grotesk + JetBrains Mono, P0–P3 priority
ramp, component specs). Read both before UI/design work. `DESIGN.md` wins on visual
decisions; `PRODUCT.md` wins on strategic/voice decisions.

## Skills and config

- `.claude/skills/` is git-ignored; OpenCode shares the same directory.
- Primary design skill: **`impeccable`** (`npx skills add https://github.com/impeccable-software/impeccable`).
- OpenCode plugins: `superpowers` (github.com/obra/superpowers).
- Config: `.claude/settings.json` (team, committed), `settings.local.json` (personal, ignored), `opencode.json`.

<GOAL_END>

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
