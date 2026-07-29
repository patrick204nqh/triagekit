# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.3] — 2026-07-29

### Added
- Cross-dashboard insights that group related findings and route operators back into
  the relevant triage workflow.
- Browser-managed Cached Datasets with IndexedDB persistence, provider isolation,
  atomic Dataset Slice refreshes, and visible stale-data handling.
- Rate-aware GitHub request scheduling and provider-neutral Triage Actions for
  supported GitHub mutations.
- Provider-scoped focus policies for repository priority and visible include/exclude
  label rules.
- A bounded Delegation queue with editable work packages, target revalidation,
  Markdown/JSON export, and retained handoff history.
- Repository workspace controls, accessible repository ordering, and connection
  status navigation.

### Changed
- Delegation exports now leave the queue unchanged until the operator explicitly
  confirms handoff; confirmed handoffs can be undone.
- Provider failures are scoped to the active finding kind, collapsed when repeated,
  and quieter during normal cadence refreshes.
- Visible rows can be selected or deselected in bulk for delegation.
- Repository and connection controls, product documentation, and screenshots were
  refreshed for the expanded workflow.

### Fixed
- Closing the Delegation panel reliably releases its modal layer so the dashboard
  remains interactive.
- Dependency label filters no longer show redundant copy or inherit layout problems
  from unrelated controls.
- Insights navigation and refresh state remain stable across view changes.
- Repository row actions stay within their intended layout, browser fetch keeps its
  receiver binding, and parallel workflow tests are stable.

## [0.1.2] — 2026-07-28

### Added
- Dev server (`npm run dev:server`): Vite HMR on port 5173 for live editing
- Parallel check pipeline (`npm run check`): typecheck, test, lint, build in parallel
- `test:watch`, `typecheck:watch`, `check:dist` scripts for faster iteration
- `triage.hooks.example.ts` — documented example for the scoring hooks API
- Config auto-fallback: `triage.config.example.yml` loaded when `triage.config.yml` doesn't exist

### Accessibility
- Table rows now keyboard accessible via Tab/Enter/Space (`role="button"`, `tabindex="0"`)
- Drawer has `role="dialog"`, `aria-modal`, `aria-label`
- Popover triggers toggle `aria-expanded` and have `aria-controls`
- Brand wordmark is now `<h1>` for screen reader landmark navigation
- CSS heading reset ensures no unintended default styling leaks

### Changed
- `check:pages` is now a pure check (no build) — caller runs `build:pages` first
- `check:build` removed (subsumed by `check:dist`)
- `npm run dev` removed (use `dev:server` or `test:watch` individually)

## [0.1.1] — 2026-06-09

### Fixed
- Repo scoping is now consistent: the **Labels** filter options and the item count
  follow the selected repository (they were drawn from all repos). Switching repos
  prunes filter selections that don't exist in the new repo, instead of silently
  emptying the list against an option you can no longer see to clear.
- Filter-popover checkboxes rendered as oversized full-width boxes (the global input
  styling leaked onto them); they are native controls again.
- Removed a duplicate **Label** filter, a redundant review-specific axis that
  appeared alongside the generic **Labels** axis.
- **Filter**, **Sort**, and the repo overflow popovers now close on an outside click,
  not only on Escape.
- Review detail: the issue/PR **number links** to the source; the **author's name**
  is shown (it was reachable only via the tooltip), with the noisy `[bot]` suffix
  dropped from the visible name; and the misaligned "no conflicts" byline is fixed.

### Changed
- Detail drawer: wider, with a dimming scrim and a sticky close control.
- Settings: the full-screen surface now uses a responsive multi-column card grid
  instead of a single narrow column.

## [0.1.0] — 2026-06-08

### Added
- First public release. `npx triagekit build [--generic]` compiles a config into a single,
  self-contained, backend-free HTML triage dashboard.
- GitHub provider: **Findings** (Dependencies, Code scanning) and **Work** (Pull requests,
  Issues), each scored and tiered, with a data-driven filter/sort toolbar and an optional
  Insights view.
- Runtime token model (fine-grained PAT, `sessionStorage`-only, never embedded) and a
  strict hash-based CSP with no external scripts.
- Branded landing page + hosted generic dashboard on GitHub Pages.

[Unreleased]: https://github.com/patrick204nqh/triagekit/compare/v0.1.3...HEAD
[0.1.3]: https://github.com/patrick204nqh/triagekit/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/patrick204nqh/triagekit/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/patrick204nqh/triagekit/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/patrick204nqh/triagekit/releases/tag/v0.1.0
