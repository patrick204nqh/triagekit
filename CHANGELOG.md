# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/patrick204nqh/triagekit/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/patrick204nqh/triagekit/releases/tag/v0.1.0
