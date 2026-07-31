# ADR-0002: Transport adapters for agent handoff

**Date**: 2026-07-28
**Status**: accepted

> **Supersession note:** ADR-0009 replaces the `AgentHandoffV1` transport
> payload with `HandoffBundleV1`. The browser clipboard and download adapter
> boundary remains in force.
**Deciders**: Patrick

## Context

A validated Agent Handoff must leave triagekit and reach an agent. Transport mechanisms vary in browser support, security properties, and portability. The self-contained HTML must work under `file://`, static hosting, and future browser extensions without requiring backend infrastructure.

## Decision

Ship clipboard Markdown, Markdown download, and JSON download as the initial transport adapters. Each adapter receives only a validated `AgentHandoffV1` or its rendered Markdown. Adapters report success, cancellation, unsupported capability, and failure through a common `TransportResult` shape. No MCP server, no deep links, no dotfile writes, no browser extension APIs in v1. Implemented in `src/runtime/handoff/adapters/`.

## Alternatives Considered

### Alternative 1: Direct MCP server
- **Pros**: Agents can pull context directly; no copy/paste
- **Cons**: Requires a local TCP listener; `file://` pages cannot host stdio MCP; needs companion process
- **Why not**: Breaks the self-contained promise; deferred to phase 4

### Alternative 2: Deep links with encoded handoff
- **Pros**: One-click launch into agent
- **Cons**: URLs leak through history, logs, screenshots, referrers; length limits; version-dependent
- **Why not**: Security and portability concerns outweigh convenience

### Alternative 3: Write `.triagekit/` dotfiles
- **Pros**: Filesystem persistence without copy/paste
- **Cons**: Not portable across browser security models; `file://` pages have restricted FS access
- **Why not**: Portability constraint; deferred to local companion in phase 4

## Consequences

### Positive
- Works in every browser without permissions beyond clipboard (when available)
- No backend, no companion process needed
- Each adapter is independently testable

### Negative
- User must manually paste into their agent (extra step)
- Clipboard API may be denied — fallback to selectable preview + downloads

### Risks
- Clipboard-denied state must be handled gracefully with clear fallback instructions
