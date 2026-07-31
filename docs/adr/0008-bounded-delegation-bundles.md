# ADR-0008: Bounded Delegation Bundles

**Date**: 2026-07-29
**Status**: superseded by ADR-0009
**Deciders**: Patrick

## Context

ADR-0001 intentionally constrains `AgentHandoffV1` to one target, and ADR-0003 deferred batch delegation until the single-target value was understood. Multi-repository triage now needs a faster transfer path, but one unbounded prompt would overload both human review and agent context.

## Decision

Keep `AgentHandoffV1` unchanged and introduce a separate versioned `DelegationBundleV1`.

A bundle contains one to five ordered Work Packages. Each package contains one repository, one Kind-compatible intent, shared outcome/constraints/verification, and one to ten targets. Packages follow Focus Policy repository order; targets follow P level and item score. A transfer therefore contains at most fifty targets.

The human builds a session Delegation Queue, reviews package instructions, and sees background target revalidation before transfer. Resolved targets become deselected but remain visible; stale context may transfer with disclosure; invalid or secret-bearing context blocks only its package.

Only curated, allow-listed context enters the bundle. Raw provider responses, credentials, request headers, comments archives, diffs, and action payloads remain forbidden. Combined Markdown is the primary transport, with individual package copy and Markdown/JSON downloads as fallbacks.

This reopens only the batch-selection and portable-bundle portion of ADR-0003. MCP transport, local companions, result import, vendor-specific prompts, and durable delegation backlogs remain deferred.

## Alternatives Considered

### Relax `AgentHandoffV1` to many targets
- **Pros**: Reuses the existing schema name
- **Cons**: Breaks the exactly-one invariant and obscures new package semantics
- **Why not**: Existing consumers must retain an honest stable contract

### One cross-repository mega-brief
- **Pros**: One copy action and minimal structure
- **Cons**: Mixes intent, ordering, verification, and unrelated repository context
- **Why not**: Reduces agent focus and human reviewability

### One brief per item
- **Pros**: Smallest possible agent task
- **Cons**: Repeats repository context and creates excessive copy/paste work
- **Why not**: Does not solve high-volume triage

### Direct MCP or companion transport
- **Pros**: Removes manual paste
- **Cons**: Requires infrastructure outside the single HTML file
- **Why not**: Transport architecture remains governed by ADR-0002 and ADR-0003

## Consequences

### Positive
- Bounded, deterministic agent context
- Shared instructions reduce repeated human editing
- Existing single-target handoffs remain valid
- Portable clipboard and download workflow remains intact

### Negative
- A large queue may require several transfers
- The system does not track agent completion after transfer
- A new schema, validator, projector, renderer, and contract tests are required
