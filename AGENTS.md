# AGENTS.md

Guidance for coding agents working in **triagekit**. Read automatically by Claude Code and
by OpenCode (via `opencode.json` → `instructions`). Plain Markdown, per <https://agents.md>.

## Project overview

`triagekit` compiles into a single, self-contained HTML dashboard for repo triage that runs
entirely in the browser — no backend, no build server, no third-party scripts, and no token
baked in (the user pastes their own at runtime). GitHub is the first provider; it groups
triage into **Findings** (Dependabot alerts, code scanning) and **Work** (pull requests,
issues), each scored, tiered, and sortable.

- Package `triagekit` (MIT) · repo `patrick204nqh/triagekit` · author **Patrick (@patrick204nqh)**
- TypeScript, compiled with `tsc`; tested with `vitest`; CLI entry `dist-cli/cli/index.js`.

## Build and test commands

- `npm run build:cli` — compile the CLI (`tsc`).
- `npm run build:pages` — build the demo HTML and the Pages site.
- `npm test` — run the full suite (`vitest run`).
- `npm run lint:anon` — anonymisation lint (guards against leaking real repo names/tokens).
- `npm run pack:smoke` — npm pack smoke test.

## Testing instructions

- Run `npm test` before opening a PR; it must stay green (vitest, ~450 tests).
- CI lives in `.github/workflows/`. Run `npm run lint:anon` if you touched example data.

## Code style and conventions

- **Never commit real repo names or tokens.** Examples use fictional `acme-corp` data.
- **No trackers in the build artifact.** Analytics (GoatCounter) live only on the hosted
  landing/site, never in the CLI output — build output must stay tracker-free.
- Match the style of surrounding code; keep the output a single self-contained HTML file.

## PR and commit guidelines

- **No AI co-author attribution** — do not add `Co-Authored-By` lines or AI footers to
  commits or PRs (also enforced via `includeCoAuthoredBy: false` in `.claude/settings.json`).
- Keep PRs scoped; note verification (e.g. `npm test` result) in the description.

## Design context

`PRODUCT.md` (register, users, brand personality, design principles) and `DESIGN.md`
(visual system: Void Zinc palette, Kelp Teal accent, Space Grotesk + JetBrains Mono,
P0–P3 priority ramp, component specs) live at the project root. Read both before any
UI or design work. `DESIGN.md` wins on visual decisions; `PRODUCT.md` wins on
strategic and voice decisions.

## Skills

`.claude/skills/` is **git-ignored** — skills are installed locally per developer, not
committed. OpenCode discovers this same directory, so one local install serves both tools.

The primary design workflow skill is **`impeccable`** (install:
`npx skills add https://github.com/impeccable-software/impeccable`). Use it for any UI
work — `/impeccable craft`, `/impeccable polish`, `/impeccable audit`, etc. It reads
`PRODUCT.md` and `DESIGN.md` automatically and keeps output on-brand.

OpenCode also loads these plugins (`opencode.json` → `plugin`): `superpowers`
(github.com/obra/superpowers).

## Config layout

- `.claude/settings.json` — project-scope, committed (team defaults).
- `.claude/settings.local.json` — personal, git-ignored (status line, enabled plugins).
- `opencode.json` — OpenCode project config (plugins, skill permissions, this file).
