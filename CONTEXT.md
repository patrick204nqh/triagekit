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

Skills: `.claude/skills/` (git-ignored). Design: `impeccable`. Plugins: `superpowers`.
Config: `opencode.json`, `.claude/settings.json`.

## PR guidelines

- **No AI co-author attribution** — no `Co-Authored-By` or AI footers (also in
  `.claude/settings.json`).
- `npm test` must stay green; run `lint:anon` if you touched example data.
- Keep PRs scoped; note verification in description.




