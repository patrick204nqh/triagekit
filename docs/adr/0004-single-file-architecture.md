# ADR-0004: Single-file architecture as core invariant

**Date**: 2026-07-28
**Status**: accepted
**Deciders**: Patrick

## Context

triagekit ships as a single `triage.html` file that runs entirely in the browser. This is the product's primary differentiator and value proposition. Every architectural decision must preserve this invariant.

## Decision

The build pipeline compiles the CLI (`tsc` → `dist-cli/`) separately from the runtime (Vite + `vite-plugin-singlefile` → `dist/triage.html`). The runtime artifact is a self-contained HTML file with no external scripts, no CDN references, no backend calls, and no third-party runtime dependencies beyond the user's own GitHub token (held in `sessionStorage`). Fonts are inlined as base64 woff2. CSP blocks all external origins except `raw.githubusercontent.com` and `api.github.com`.

## Alternatives Considered

### Alternative 1: Traditional web app with backend
- **Pros**: Server-side token management, database persistence, background jobs
- **Cons**: Requires hosting, database, deployment pipeline; user must trust a third-party server with their token
- **Why not**: Violates the core value proposition — zero setup, zero trust surface

### Alternative 2: PWA with service worker
- **Pros**: Offline support, installable
- **Cons**: Service workers don't work on `file://`; adds complexity to the build pipeline
- **Why not**: Breaks the "open HTML file" workflow that makes the tool instantly usable

## Consequences

### Positive
- Zero setup: open the HTML, paste a token, start triaging
- No server to maintain, no database, no deployment pipeline
- Token never leaves the user's browser
- Easy to share: one file, no install

### Negative
- No server-side processing (all computation is client-side)
- Cannot host an MCP server within the HTML file
- Font inlining increases file size (~400KB for both fonts)
- CI-only features (scheduled scans) require external tooling

### Risks
- Large datasets may strain browser memory — mitigated by paginated rendering
- CSP restrictions make future integrations harder — each new origin must be explicitly allow-listed
