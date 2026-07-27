# ADR-0001: Handoff data model

**Date**: 2026-07-28
**Status**: accepted
**Deciders**: Patrick

## Context

The Agent Handoff feature needs a portable, human-approved data model that carries one bounded outcome from triagekit to any agent. The model must be provider-neutral, safe to share (no tokens), and forward-compatible with batch workflows. The spec is defined in `src/runtime/handoff/types.ts`.

## Decision

Use `AgentHandoffV1` with a `targets` array that v1 validation constrains to exactly one element. The model is split into four concerns:

- **intent** — what the agent should do (outcome, constraints, verification)
- **targets** — what the agent acts on (exactly one in v1)
- **context** — supporting information that does not authorize work
- **metadata** — schema identifier, version, creation timestamp

Provider references and details use explicit allow-listed projections per Kind, never raw serialization. The projector (`src/runtime/handoff/projector.ts`) is a pure function with no DOM, network, or storage access.

## Alternatives Considered

### Alternative 1: Singular `target` field instead of `targets` array
- **Pros**: Simpler type, no validation needed for "exactly one"
- **Cons**: Breaking change when batch is added; forces a v2 schema bump
- **Why not**: The `targets` array with v1 validation is forward-compatible without a format break

### Alternative 2: Raw provider response serialization
- **Pros**: No projection logic needed; all data available
- **Cons**: Leaks tokens, internal IDs, and unspecified fields; non-deterministic output
- **Why not**: Security and determinism require explicit projection per Kind

## Consequences

### Positive
- Schema versioning is explicit and safely extensible
- Projector is testable without browser APIs
- Provider secrets never enter the handoff by construction

### Negative
- Each Kind must implement its own `projectTarget` projection
- The `targets` array adds one validation rule to enforce exactly-one

### Risks
- A future Kind might forget to implement `projectTarget` — mitigated by catalog fallback to item-level fields
