# Triage

Triagekit normalizes repository work and findings so they can be assessed consistently without losing their provider identity.

## Language

**Triage Item**:
A normalized finding or piece of work that can be scored, filtered, and acted upon.
_Avoid_: Record, entry

**Kind**:
A provider-neutral category of Triage Item with shared meaning, fields, scoring, and presentation.
_Avoid_: Type, resource

**Provider**:
An external repository system that supplies Triage Items and may support actions on them.
_Avoid_: Source, integration

**Provider Reference**:
An opaque provider-owned identity retained with a Triage Item so the Provider can later enrich or act on it. Triagekit stores and returns it but does not interpret it.
_Avoid_: Provider metadata, raw payload

**Triage Session**:
A focused period in which an operator selects what to triage and narrows the visible Triage Items while preserving useful navigation choices.
_Avoid_: Workspace, page state

**Agent Handoff**:
A portable, human-approved request that gives an agent one bounded outcome, its Triage Item targets, and enough supporting context to continue the work outside triagekit.
_Avoid_: Prompt, export, agent session

**Handoff Target**:
A Triage Item the agent is explicitly expected to act on as part of an Agent Handoff. The first handoff workflow has exactly one Handoff Target.
_Avoid_: Selected item, task

**Handoff Context**:
Supporting information included in an Agent Handoff that helps the agent understand the target but does not independently authorize work on another Triage Item.
_Avoid_: Extra targets, page state

**Agent Brief**:
The human-readable projection of an Agent Handoff that an operator reviews before copying, downloading, or sending it.
_Avoid_: Agent mode, prompt preview
