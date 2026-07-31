# ADR-0009: Unified Handoff Queue and explicit agent authorization

**Date**: 2026-07-31  
**Status**: accepted  
**Deciders**: Patrick

## Context

The product had two overlapping transfer concepts: a single-target Agent
Handoff and a multi-target Delegation Bundle. The split made operators repeat
instructions per item or package, obscured which surface was authoritative, and
encouraged write-capable agent work without an explicit confidence boundary.

Operators usually want to select a set of focus items, state shared guidance
once, and then choose whether the agent should investigate or implement.
Per-target nuance remains useful, but it should be optional rather than required
human work.

## Decision

Replace the single-target Agent Handoff and multi-target Delegation Bundle with
one breaking `HandoffBundleV1` contract and one session Handoff Queue.

Every queue has one explicit mode:

- `investigate` is the default. It authorizes read-only analysis, evidence
  gathering, reporting, and an action plan. It forbids file changes, commits,
  pushes, provider mutations, and other external actions.
- `implement` authorizes scoped local changes for the selected targets. It does
  not authorize commits, pushes, merges, deployments, or provider mutations
  unless the human instructions explicitly request them.

Human guidance consists of one optional mission note for the queue plus optional
target notes. Repository-and-Kind packages remain generated, bounded, validated,
ordered, and independently transferable. There is no editable per-package
prompt.

The browser-local contract is:

- storage key `triagekit.handoff.queue.v1`
- bundle schema `triagekit.handoff-bundle`
- runtime modules under `src/runtime/handoff/`
- UI modules under `src/runtime/layout/handoff/`
- host element `handoff-host`

This is a breaking cutover. No aliases, migrations, or parallel legacy flow are
kept.

## Consequences

- Operators state intent once and can review the authorization boundary before
  transfer.
- Investigation-first becomes the safe default for production-sensitive work.
- Item actions only add to or remove from the Handoff Queue; they do not
  generate standalone briefs.
- Each generated package receives the same mode and mission note while retaining
  optional target-specific notes.
- Existing stored legacy queue payloads and legacy bundle consumers must adopt
  the new contract.

## Rejected alternatives

- Preserve both single-target and multi-target flows: rejected because it keeps
  duplicate mental models and code paths.
- Add compatibility aliases: rejected because the project accepts a breaking
  change in exchange for a smaller, clearer API.
- Add per-repository prompts: rejected because shared guidance is the common
  case and repeated prompt editing creates avoidable human work.
- Keep package prompt editors: rejected because generated package instructions
  should be deterministic and mode-bound.
- Automatically authorize write actions: rejected because production-sensitive
  work needs an explicit human choice.
