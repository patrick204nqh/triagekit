# Product

## Register

product

## Users

Developers and security-conscious engineers who own or maintain GitHub repositories. They come to triagekit in a focused triage-session mindset: they have a backlog of Dependabot alerts, code-scanning findings, pull requests, and issues to process, and they want to move through it efficiently. They're comfortable with dense interfaces — they live in terminals and editors — and they expect a tool to respect their time. They paste a token once, pick their repos, and work.

Secondary users: team leads who hand a compiled dashboard to their team so everyone triages against the same scope without setup friction.

## Product Purpose

triagekit compiles into a single, self-contained HTML file that runs entirely in the browser — no backend, no build server, no third-party scripts, no token baked in. GitHub is the first provider. It groups what you triage into Findings (Dependabot alerts, code scanning) and Work (pull requests, issues), each scored, tiered, and sortable from a data-driven toolbar. The detail panel renders full-Markdown bodies; an optional Insights view adds compositional charts.

Success looks like: a developer opens the HTML, pastes a token, and is triaging actual alerts within 30 seconds. The interface earns trust by being transparent about what it shows and how it scores.

## Brand Personality

Sharp · Honest · Trustworthy

A security-adjacent tool that earns confidence through clinical clarity. It doesn't soften data — P0 is red because P0 is critical. It doesn't hide constraints — the token stays in the tab, the CSP is explicit. It doesn't dress up data as insights it isn't. Design serves comprehension, not engagement.

Voice: direct, technical, never corporate. Zero marketing language inside the tool.

## Anti-references

- **GitHub's own UI** — triagekit has its own identity; it should not feel like a GitHub reskin or a feature you'd expect GitHub to ship natively.
- **Generic dev-tool dark mode** — the VSCode-grey (#1e1e1e) / Tailwind dark-mode convention with predictable blue accents. Visually inert, industry default.
- **Security vendor dashboards** — Snyk, GitLab Security, Dependabot's own UI: corporate, badge-heavy, chart-overloaded, padded. Designed to impress procurement, not to speed up triage.
- **SaaS-slick tools** — Linear, Notion: gradient cards, generous whitespace, marketing-grade animations. Optimized for onboarding and brand, not for a user already in the cockpit.

## Design Principles

1. **The cockpit principle** — every pixel on screen should help the operator make a decision or take an action. Decoration that doesn't carry information is a distraction inside the tool.
2. **Earned trust over asserted trust** — don't label things "secure" or "private"; show the architecture (single file, no CDN, token in sessionStorage only). Transparency is the brand.
3. **Respect the data's own language** — severity has a natural ramp (critical → high → medium → low); color, weight, and position should reinforce that ramp, not override it with brand aesthetics.
4. **Constraints are features** — the single-HTML, no-backend model is the product's core value proposition. Design decisions (self-hosted fonts, inline everything, strict CSP) should be legible as intentional, not apologized for.
5. **Density without noise** — the interface is deliberately information-dense. The goal is signal-to-noise ratio, not minimalism for its own sake. If reducing ink makes a decision harder, keep the ink.

## Accessibility & Inclusion

WCAG 2.1 AA. Keyboard navigation throughout. All interactive elements reachable via Tab with visible focus rings. `prefers-reduced-motion` respected (already implemented; maintain as a hard requirement). Color is never the sole differentiator for priority — tier labels (P0–P3) accompany color ramps. Contrast targets: body text ≥ 4.5:1, large/bold text ≥ 3:1.
