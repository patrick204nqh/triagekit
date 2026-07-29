# ADR-0007: Human-controlled Focus Policy

**Date**: 2026-07-29
**Status**: accepted
**Deciders**: Patrick

## Context

Item score alone cannot express that one repository is operationally more important than another. Include-only label filters also leave known no-work categories—such as items already carrying a tracking-ticket label—in the operator’s queue. Bulk delegation without first reducing this noise would transfer more context while weakening human judgment.

## Decision

Introduce a human-controlled Focus Policy for each provider.

Repository order is absolute and explicitly managed in Settings. Items sort by repository rank first, P level second, item score third, and stable identity last. Newly discovered repositories append to the bottom; removing a repository from scope preserves its rank for later restoration.

Label rules use separate, visible “Show if labelled” and “Hide if labelled” lanes. Included labels match any selected include value; excluded labels hide any matching item; exclusion wins. Rules persist across repositories for that provider and remain visible in the toolbar.

Focused items enter an explicit Delegation Queue through individual selection or `Add visible`. The queue is session-only, stores identities rather than provider payloads, survives same-session reloads, and never changes silently when filters or scope change.

## Alternatives Considered

### Add repository weights to item score
- **Pros**: Preserves one numeric ranking
- **Cons**: Operators cannot predict or explain the resulting order
- **Why not**: Hidden score boosts conflict with triagekit’s transparency principle

### Keep include-only labels
- **Pros**: No filter-state change
- **Cons**: Cannot express common “already handled; skip” policy
- **Why not**: Forces repeated manual scanning

### Persist a long-lived delegation backlog
- **Pros**: Survives browser restarts
- **Cons**: Selections become stale and turn triagekit toward project management
- **Why not**: The queue represents current session intent, not durable work ownership

## Consequences

### Positive
- Core repositories stay focused without obscuring the rule
- Known no-work labels disappear consistently
- `Add visible` has deterministic, explainable membership
- Humans approve what enters delegation

### Negative
- Absolute repository order can place a lower P-level item above a higher P-level item in another repository
- Operators must maintain repository order as scope changes
- Global provider label rules may need per-repository overrides if real label conflicts emerge
