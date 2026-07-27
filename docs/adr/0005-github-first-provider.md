# ADR-0005: GitHub-first provider with provider-neutral model

**Date**: 2026-07-28
**Status**: accepted
**Deciders**: Patrick

## Context

triagekit needs data to triage. GitHub is the obvious first provider due to Dependabot, code scanning, issues, and PRs being the most common triage surface. The architecture should not couple to GitHub's data model so that future providers (GitLab, Bitbucket, self-hosted forges) can be added without rewriting the triage engine.

## Decision

Build GitHub as the first provider adapter, but model all data through a provider-neutral abstraction layer. The `Kind` system (`dependency-vuln`, `code-scanning`, `change-request`, `issue`) defines the item types, scoring fields, and renderers. Each provider implements adapters that map its API responses into these neutral types. The core triage engine (`derive` → `score` → `render`) never references GitHub-specific types. Provider adapters live in `src/runtime/providers/`; Kind definitions in `src/runtime/kinds/`.

## Alternatives Considered

### Alternative 1: GitHub-coupled model throughout
- **Pros**: Simpler initial implementation; no abstraction overhead
- **Cons**: Every future provider requires rewriting core logic; GitHub API shapes leak into views
- **Why not**: The abstraction cost is low (one interface per Kind) and pays for itself on the second provider

### Alternative 2: Multiple providers from day one
- **Pros**: Validates the abstraction immediately
- **Cons**: Doubles initial scope; delays shipping; no data to validate provider-neutral model against
- **Why not**: Premature generality; one provider proves the model, two proves the abstraction

## Consequences

### Positive
- Adding a new provider means writing one adapter, not forking the codebase
- Scoring and rendering logic is provider-independent and reusable
- Tests use neutral test fixtures, not GitHub API mocks

### Negative
- GitHub-specific features that don't map to the Kind model require abstraction extensions
- Provider adapter has some mapping overhead (GitHub REST → neutral model)
- Some provider-specific details may be lost in the neutral projection

### Risks
- Over-abstraction (designing for providers that never come) — mitigated by keeping the Kind model minimal and extending only when a real provider needs it
