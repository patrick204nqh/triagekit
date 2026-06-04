# triagekit

> Compile a config into a shareable, backend-free repo-triage dashboard.

`triagekit` is a vendor-agnostic engine that compiles a private config plus optional
domain logic into a single, self-contained HTML triage dashboard. The built file runs
entirely in the browser — no backend, no build server, no third-party scripts. You
paste your own token at runtime; nothing is ever embedded at build time.

GitHub is the first provider, shipping with a **security-alerts** view that scores and
tiers your open Dependabot alerts.

## The public / private boundary

This repository is the **engine** — adapters, views, theme, and CLI. It contains **no**
real org names, repo names, hostnames, or tokens. Everything that identifies *you* lives
in inputs that are gitignored:

| File | Tracked? | Contains |
| --- | --- | --- |
| `triage.config.example.yml` | ✅ committed | fictional `acme-corp` example |
| `triage.config.yml` | 🚫 gitignored | your real org + repos |
| `triage.hooks.ts` | 🚫 gitignored | your optional scoring overrides |
| `dist/triage.html` | 🚫 gitignored | the built dashboard (your org/repo names) |

The engine has **zero** code path that reads or embeds a credential.

## Quickstart

```bash
# 1. Configure (the copy is gitignored)
cp triage.config.example.yml triage.config.yml
$EDITOR triage.config.yml        # set your org, repos, branding

# 2. Build the single-file dashboard
npx triagekit build              # writes dist/triage.html

# 3. Open it
open dist/triage.html            # or double-click — it's just a file
```

Then paste a **fine-grained personal access token** with read access to Dependabot
alerts, and click **Refresh**.

### Example config

```yaml
org: acme-corp
provider: github
repos:
  - web-app
  - api-gateway
  - billing-service
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
- Tokens are stored in **`sessionStorage` by default** — cleared when you close the tab,
  never persisted across browser sessions.
- Use a **fine-grained PAT** scoped to only the repos you triage, with the minimum
  Dependabot-alert read permission.
- Never paste a token into a tracked file, a screenshot, or a commit.

## ⚠ The built HTML is sensitive-by-default

`dist/triage.html` contains the **org and repo names** you configured. It is safe to
share within your team, but **do not commit it to a public repository**. No token is
embedded — each user pastes their own.

## Customizing the scoring

The default scoring model is transparent and lives in
`src/runtime/views/security-alerts/score.ts`. To override it without forking the engine,
point `logicHooks` at a module that exports a `score` function:

```ts
// triage.hooks.ts  (gitignored)
import type { Alert } from "./src/runtime/providers/registry";
export const score = (a: Alert): number => {
  // your weighting…
  return a.severity === "critical" ? 1000 : 0;
};
```

It is bundled into the HTML at build time.

## Security posture

- **Single file, no external scripts.** The build inlines everything; CI fails if any
  `src="http…"` reference appears.
- **Strict, hash-based CSP** is computed at build time: `default-src 'none'`, a
  `script-src` allowing only the inlined script by its `sha256` hash (no
  `unsafe-inline`), and a `connect-src` limited to the configured provider's API origin.

## Development

```bash
npm install
npm test            # vitest
npm run build:cli   # compile the CLI to dist-cli/
npm run lint:anon   # anonymity guardrail
```

## License

MIT
