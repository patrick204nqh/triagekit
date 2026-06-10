# AGENTS.md

Shared agent instructions for **triagekit**. Read by Claude Code and OpenCode (referenced from `opencode.json` → `instructions`).

## What this project is

`triagekit` compiles into a single, self-contained HTML dashboard for repo triage that
runs entirely in the browser — no backend, no build server, no third-party scripts, and
no token baked in (the user pastes their own at runtime). GitHub is the first provider;
it groups triage into **Findings** (Dependabot alerts, code scanning) and **Work** (pull
requests, issues), each scored, tiered, and sortable.

- Package: `triagekit` (MIT) · author **Patrick (@patrick204nqh)** · repo `patrick204nqh/triagekit`
- CLI entry: `dist-cli/cli/index.js` (`triagekit` bin)
- Stack: TypeScript, compiled with `tsc`; tested with `vitest`; output is a single HTML file.

## Commands

| Task | Command |
|------|---------|
| Build the CLI | `npm run build:cli` |
| Build the demo HTML + Pages site | `npm run build:pages` |
| Run tests | `npm test` (`vitest run`) |
| Anonymisation lint | `npm run lint:anon` |
| Pack smoke test | `npm run pack:smoke` |

## Conventions

- **No AI co-author attribution.** Do not add `Co-Authored-By` lines or AI footers to
  commits or PRs (personal branding). This is also enforced via `includeCoAuthoredBy: false`
  in `.claude/settings.json`.
- **Never ship trackers in the build artifact.** Analytics (GoatCounter) live only on the
  hosted landing/site, never in the CLI output. Build output must stay tracker-free.
- **Never commit real repo names or tokens.** Examples use fictional `acme-corp` data; the
  `lint:anon` check guards against leaks.

## Skills

`.claude/skills/` is **git-ignored** — skills are installed locally per developer, not
committed. OpenCode discovers this same `.claude/skills/` directory, so one local install
serves both Claude Code and OpenCode.

Recommended base skill set for development — install with:

```sh
npx skills add https://github.com/leonxlnx/taste-skill
```

- `design-taste-frontend` — anti-slop frontend skill for landing pages, portfolios, redesigns.
- `redesign-existing-projects` — audit-first redesign workflow.
- `stitch-design-taste` — design-system / DESIGN.md companion.
- `brandkit` — brand and visual identity helpers.

OpenCode also loads these plugins (declared in `opencode.json` → `plugin`):
`superpowers` (github.com/obra/superpowers) and `ecc-universal` (github.com/affaan-m/ECC).

## Config layout

- `.claude/settings.json` — project-scope, committed (team defaults).
- `.claude/settings.local.json` — personal, git-ignored (status line, enabled plugins, etc.).
- `opencode.json` — OpenCode project config (LSP, plugins, skill permissions, this file).
