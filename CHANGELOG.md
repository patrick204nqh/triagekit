# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/patrick204nqh/triagekit/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/patrick204nqh/triagekit/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/patrick204nqh/triagekit/releases/tag/v0.1.0
