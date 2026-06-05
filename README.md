<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/logo.svg" />
    <img alt="triagekit" src="assets/logo-light.svg" width="300" />
  </picture>
</p>

<p align="center"><em>Compile a config into a shareable, backend-free repo-triage dashboard.</em></p>

`triagekit` builds a single, self-contained HTML triage dashboard that runs entirely in
the browser — no backend, no build server, no third-party scripts. You paste your own
token at runtime; nothing is ever embedded at build time.

GitHub is the first provider, shipping with a **security-alerts** view that scores and
tiers your open Dependabot alerts.

## Two build modes

| Mode | Command | scope | Artifact |
| --- | --- | --- | --- |
| **Generic** | `triagekit build --generic` | chosen at runtime in **Settings** | nothing baked in → **safe to share or commit publicly** |
| **Compiled** | `triagekit build` | a `scope` bag baked from `triage.config.yml` | contains your repo names → team-internal only |

Generic mode is the general-purpose tool: build it once, hand the HTML to anyone, and
each user connects a token and picks their repos in **Settings** (⚙). Compiled mode
pre-bakes a specific scope for a turnkey team dashboard. **Neither mode ever embeds a
token.**

## The public / private boundary

This repository is the **engine** — adapters, views, theme, and CLI. It contains **no**
real org names, repo names, hostnames, or tokens. Everything that identifies *you* lives
in inputs that are gitignored:

| File | Tracked? | Contains |
| --- | --- | --- |
| `triage.config.example.yml` | ✅ committed | fictional `acme-corp` example |
| `triage.config.yml` | 🚫 gitignored | your real scope (repo names) |
| `triage.hooks.ts` | 🚫 gitignored | your optional scoring overrides |
| `dist/triage.html` | 🚫 gitignored | the built dashboard (your repo names) |

The engine has **zero** code path that reads or embeds a credential.

## Quickstart — generic (no config)

```bash
# 1. Build the general-purpose dashboard
npx triagekit build --generic    # writes dist/triage.html

# 2. Open it
open dist/triage.html            # or double-click — it's just a file
```

In the page, open **Settings** (⚙) and connect a **fine-grained personal access token**
with read access to Dependabot alerts, then use **"Find repositories I can access"** to
pick your repos and click **Load**. Your scope persists locally for convenience; the
token stays in this tab only.

### Hosted version

A prebuilt generic dashboard is committed at [`docs/index.html`](docs/index.html) and
can be served via GitHub Pages (Settings → Pages → Source: `main` / `/docs`). It is
regenerated with `npm run build:pages`, and CI fails if the committed copy drifts from a
fresh build.

## Quickstart — compiled (config-baked)

```bash
# 1. Configure (the copy is gitignored)
cp triage.config.example.yml triage.config.yml
$EDITOR triage.config.yml        # set your scope (repos) + branding

# 2. Build the single-file dashboard
npx triagekit build              # writes dist/triage.html

# 3. Open it, connect a token in Settings, and click Load
open dist/triage.html
```

### Example config

```yaml
source: github
# Compiled mode bakes a per-source scope bag (no token is ever embedded).
scope:
  repos:
    - acme-corp/web-app
    - acme-corp/api-gateway
    - acme-corp/billing-service
views:
  - security-alerts
branding:
  title: "Acme Triage"
# Optional: a JS/TS module exporting scoring overrides.
# logicHooks: ./triage.hooks.ts
```

## The token model

- **You** paste your own token at runtime; it is never read at build time and never
  embedded in the HTML.
- Credentials are managed **per source** in Settings and stored in **`sessionStorage`** —
  cleared when you close the tab, never persisted across browser sessions or embedded.
- Use a **fine-grained PAT** scoped to only the repos you triage, with the minimum
  Dependabot-alert read permission.
- Never paste a token into a tracked file, a screenshot, or a commit.

## Sharing the built HTML

- **Generic build (`--generic`)** bakes in nothing source-specific — safe to share or
  commit to a public repo. Each user supplies their scope and token at runtime in Settings.
- **Compiled build** ⚠ contains the **repo names** in your baked `scope`. Safe to share
  within your team, but **do not commit it to a public repository**.

Neither build embeds a token — each user always pastes their own.

## Settings & connections

All configuration lives in the **Settings** slide-over (⚙ in the command bar). The
command bar carries a scope/health status chip plus a **manual refresh** and a **theme**
toggle; everything else lives in Settings:

- **Integrations catalog** — sources split into **Connected** (a credential is set) and
  **Available** (ready to add, or `upcoming`), filterable by name or domain, so the list
  scales as providers grow.
- **Per-source credential** — provider-appropriate (GitHub fine-grained PAT, …),
  **session-only** (`sessionStorage`), one per source, never persisted or embedded.
- **Schema-driven scope** — each source declares its own scope fields; discoverable
  fields (e.g. GitHub repositories) offer **"Find … I can access"**, which calls the
  source's `discover()` and lists the targets your credential can reach. Results are
  **cached** per credential (filter and re-select without re-querying; "Re-scan" forces a
  refresh), and the picker is a filterable multi-select with select-all / clear and a live
  count. Scope is non-secret, so it persists in `localStorage` keyed per source.
- **Auto-refresh** — optionally re-fetch every **5 or 10 minutes** (snapshot-only; there
  is no backend history to trend). The command bar shows an "updated *N*m ago" stamp.
- **Appearance** — `Auto` (follow the OS) / `Light` / `Dark`; the top-right toggle cycles
  the same three so an `Auto` preference is never silently lost.

Compiled builds seed their baked `scope` automatically, so a turnkey dashboard only needs
a token.

## Customizing the scoring

The default scoring model is transparent and lives in
`src/runtime/scoring/dependency-vuln.ts`. To override it without forking the engine,
point `logicHooks` at a module that exports a `score` function:

```ts
// triage.hooks.ts  (gitignored)
import type { TriageItem } from "./src/runtime/dataset/item";
import type { DependencyVulnDetails } from "./src/runtime/dataset/kinds/dependency-vuln";
export const score = (item: TriageItem): number => {
  const d = item.details as DependencyVulnDetails;
  // your weighting…
  return d.severity === "critical" ? 1000 : item.signal;
};
```

It is bundled into the HTML at build time.

## Insights

Alongside the table, the **Insights** view (add `insights` to `views`) renders a grid of
charts for the loaded items — a separate surface so the table stays a clean cockpit.

- **Snapshot-only.** Every chart is compositional (distribution / ranking / ratio) —
  never a time-series. A backend-free fetch has no history to trend.
- **Contributed per kind/source.** Charts register against a kind: generic ones
  (priority distribution, age buckets tinted by worst tier, top locations) apply to
  everything; `dependency-vuln` adds a fix-available "quick wins" ratio and a runtime-vs-
  development split. New sources light up their own charts automatically — the Insights
  view itself never changes.
- Switching to Insights reuses the rows already loaded for the table (no refetch).

## Security posture

- **Single file, no external scripts.** The build inlines everything; CI fails if any
  `src="http…"` reference appears.
- **Strict, hash-based CSP** is computed at build time: `default-src 'none'`, a
  `script-src` allowing only the inlined script by its `sha256` hash (no
  `unsafe-inline`), and a `connect-src` limited to the configured provider's API origin.

## Design

The visual language — a dark-first operations cockpit (Void Zinc canvas, a single Kelp
Teal accent, a semantic P0–P3 ramp, monospace numerals, divider-based tables) — is
documented in [`DESIGN.md`](DESIGN.md). The runtime theme in `src/runtime/theme/` is the
implementation of that language; JetBrains Mono is self-hosted and inlined (no CDN), and
the strict CSP allows fonts only via `font-src 'self' data:`.

## Development

```bash
npm install
npm test            # vitest
npm run build:cli   # compile the CLI to dist-cli/
npm run lint:anon   # anonymity guardrail
```

## License

MIT
