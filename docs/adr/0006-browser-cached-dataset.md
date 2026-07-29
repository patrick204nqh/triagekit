# ADR-0006: Browser-local Cached Dataset

**Date**: 2026-07-29
**Status**: accepted
**Deciders**: Patrick

## Context

triagekit must remain a single browser-only HTML file, but repeatedly fetching large multi-repository scopes slows triage and makes temporary provider failures erase useful context. Provider credentials are secret and session-bound, while normalized triage data may safely outlive one browser session when its storage and visibility rules are explicit.

## Decision

Persist validated, provider-neutral Dataset Slices in IndexedDB with a hot in-memory projection. A Slice belongs to one provider, one credential fingerprint, one canonical scope, one provider target, and one Kind; raw credentials and provider responses never enter the cache.

Credentials remain in `sessionStorage` and gate hydration. Slices use stale-while-refresh, newest-generation-wins commits, seven-day retention, and a 50 MiB soft cap. Schema mismatch invalidates and refetches the affected Slice rather than migrating it. IndexedDB failure degrades to memory-only operation with a visible warning.

Cached data is not application-encrypted in v1: token-derived encryption would strand data after credential rotation and would not protect against code executing in the same browser page. Cache locality, credential-gated visibility, bounded retention, explicit erase, CSP, and the absence of third-party runtime code are the privacy controls.

## Alternatives Considered

### Session-only data
- **Pros**: Simplest privacy model
- **Cons**: Every browser restart requires a complete refetch; offline and partial-failure continuity disappear
- **Why not**: Undermines fast multi-repository triage

### Cache raw provider responses
- **Pros**: Easy replay and remapping
- **Cons**: Persists unnecessary provider-specific and potentially sensitive fields
- **Why not**: Violates data minimization and ADR-0005’s provider-neutral model

### Token-derived encryption
- **Pros**: Obscures IndexedDB contents at rest
- **Cons**: Rotation makes cached data unreadable and same-page execution can access both token and plaintext
- **Why not**: Complexity and failure modes outweigh the limited protection

## Consequences

### Positive
- Fast startup from browser-local data
- Per-target partial refresh without erasing stale usable work
- Credentials stay session-only
- List, Insights, and future handoff workflows share freshness semantics

### Negative
- Repository data remains readable to the owning browser profile
- Moving the HTML to another origin or file location starts with an empty cache
- IndexedDB schema and quota behavior require dedicated tests
