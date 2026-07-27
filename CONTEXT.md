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
