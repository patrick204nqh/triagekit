# ADR-0003: Handoff phase boundaries and deferred work

**Date**: 2026-07-28
**Status**: accepted
**Deciders**: Patrick

## Context

The Agent Handoff feature has many desirable directions: batch selection, MCP hosting, result import, local companion, vendor-specific prompts. Building them all before validating the core handoff value would delay learning what operators actually need.

## Decision

Deliver Phase 1 (portable one-target handoff with clipboard/download transport) first. Explicitly defer batch selection, MCP, local companion, result import, and vendor-specific prompts to later phases. Each deferred item has a trigger condition that must be met before work begins. Boundary is documented in `docs/agent-handoff-foundation.md` (to be archived once ADRs cover all stable decisions).

## Alternatives Considered

### Alternative 1: Start with batch selection
- **Pros**: Operators can delegate multiple items at once
- **Cons**: Adds selection state, batch intent editing, partial success, result correlation before handoff value is proven
- **Why not**: Premature complexity; v1 `targets` array keeps the option open without committing

### Alternative 2: Build MCP server first
- **Pros**: Direct agent integration from day one
- **Cons**: Requires companion process; backend dependency; distracts from handoff content quality
- **Why not**: MCP is a transport detail; handoff content should be validated first

## Consequences

### Positive
- Fastest path to learning whether operators find handoffs useful
- Each deferred feature has a clear trigger condition
- The `targets` array in the data model keeps batch extension possible

### Negative
- Phase 1 operators must copy/paste (no direct agent launch)
- Batch workflows will need a v2 format extension (though array is already there)

### Risks
- Phase 1 might not be compelling enough without direct agent integration — mitigated by making the handoff content rich enough to save real effort
