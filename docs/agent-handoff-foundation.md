# Agent Handoff foundation

**Repo:** triagekit  
**Date:** 2026-07-27  
**Type:** Product and architecture design  
**Status:** Design approved. Implementation planning pending review.

## Summary

Triagekit will let an operator continue work with an agent without manually reconstructing what they saw in the visual interface.

The first release adds a reviewable Agent Brief for one currently opened Triage Item. The brief is generated from a provider-neutral Agent Handoff and can be copied as Markdown or downloaded as Markdown or JSON. It does not write arbitrary local files, launch an MCP server, or depend on a backend.

The Agent Handoff is the stable product boundary. Clipboard, downloads, deep links, browser extensions, local companions, and MCP are adapters around that boundary.

## Problem

The visual dashboard helps an operator identify an important problem, but the context required to continue with an agent is distributed across:

- the opened Triage Item;
- its provider identity and URL;
- its normalized score and tier;
- the repository currently in scope;
- the operator's interpretation of the desired outcome;
- relevant constraints and verification expectations.

Today the operator must manually copy and explain that context. This is slow, easy to omit, and inconsistent across agents.

## Product outcome

From an opened Triage Item, the operator can:

1. choose **Continue with agent**;
2. review an Agent Brief derived from the current item and session;
3. state or edit the desired outcome;
4. copy or download a portable representation;
5. use that representation with any agent without triagekit knowing which agent receives it.

The flow should add less than one minute between identifying a problem and beginning agent work.

## Design principles

### One target, one bounded outcome

The first release creates an Agent Handoff for exactly one Handoff Target. A singular target keeps ownership, review, retry, and returned evidence unambiguous.

The serialized model uses a `targets` collection so a later batch workflow does not require a format break. Version 1 validation requires `targets.length === 1`.

### Context does not grant authority

Repository details, current filters, score explanations, and related links can help the agent understand the target. They are Handoff Context, not additional targets. Their presence must not imply permission to modify other Triage Items.

### Human approval before transport

The operator sees the complete Agent Brief before anything leaves the page. Generation is deterministic. No agent call, network request, or filesystem write occurs when the brief opens.

### Portable core, optional adapters

The self-contained HTML remains useful under static hosting, a local `file://` URL, and a browser extension. The initial transport options use browser capabilities that degrade safely:

- clipboard copy;
- Markdown download;
- JSON download.

Future integrations attach through adapters. They do not change the Agent Handoff model.

### No hidden credentials

The handoff never includes the GitHub token, browser storage, authorization headers, raw provider responses, or configuration secrets. Provider References are projected into explicit, allow-listed fields.

## Domain language

### Agent Handoff

A portable, human-approved request that gives an agent one bounded outcome, its targets, and supporting context.

### Handoff Target

A Triage Item the agent is explicitly expected to act on. Version 1 has exactly one.

### Handoff Context

Supporting information that explains the target but does not independently authorize work.

### Agent Brief

The human-readable projection of an Agent Handoff. This is the surface the operator reviews.

### Transport Adapter

A mechanism that moves an Agent Handoff out of triagekit. Examples include clipboard, download, a deep link, a browser extension bridge, or a local companion.

The UI should not call this surface "Agent mode." The operator is still the user. The application is presenting a different projection of the same triage state.

## Interaction design

### Entry point

The opened detail panel gains a **Continue with agent** action. It is available only when the panel has a complete Triage Item with a stable provider reference or URL.

The action opens the Agent Brief as a focused right-edge surface that follows the existing drawer behavior and visual system.

### Agent Brief structure

The surface contains:

1. **Target**: title, kind, provider, location, tier, score, stable URL, and provider identity.
2. **Outcome**: an editable, required statement of what the agent should accomplish.
3. **Evidence**: provider-neutral facts and available score explanation.
4. **Constraints**: editable instructions that limit the work.
5. **Verification**: editable expectations for tests or checks.
6. **Session context**: repository and current kind, presented as context rather than authority.
7. **Preview**: the exact Markdown or JSON that will be transported.

The initial outcome is generated from the item's Kind using plain, functional language. It must not claim facts that are absent from the Triage Item.

### Actions

The primary action is **Copy Markdown**. Secondary actions are:

- Download Markdown
- Download JSON

Copy success is announced through an accessible status message. Download actions show the exact filename before activation.

If clipboard access is unavailable, the Markdown preview remains selectable and the download actions remain available.

### Naming

The top-level navigation does not gain a global `Human | Agent` toggle in version 1. The handoff belongs to the opened item, not to the whole application.

If a persistent alternate projection becomes useful later, use `Triage | Agent brief` or `Visual | Context`. Do not imply that an agent is directly operating the browser UI.

## Data contract

The contract is provider-neutral and versioned.

```ts
interface AgentHandoffV1 {
  schema: "triagekit.agent-handoff";
  version: 1;
  createdAt: string;
  intent: {
    outcome: string;
    constraints: readonly string[];
    verification: readonly string[];
  };
  targets: readonly HandoffTargetV1[];
  context: HandoffContextV1;
}

interface HandoffTargetV1 {
  id: string;
  kind: Kind;
  provider: string;
  providerReference: Readonly<Record<string, string | number | boolean>>;
  title: string;
  location: string;
  url: string;
  createdAt: string;
  priority: {
    signal: number;
    score: number;
    tier: Tier;
    explanation?: readonly HandoffEvidenceV1[];
  };
  details: Readonly<Record<string, HandoffValueV1>>;
}

interface HandoffContextV1 {
  session: {
    kind: Kind;
    provider: string;
    repository?: string;
  };
  relatedItems: readonly HandoffRelatedItemV1[];
}

interface HandoffEvidenceV1 {
  label: string;
  value: string | number | boolean;
  reason?: string;
}

interface HandoffRelatedItemV1 {
  id: string;
  kind: Kind;
  provider: string;
  title: string;
  location: string;
  url: string;
  relationship: string;
}

type HandoffValueV1 =
  | string
  | number
  | boolean
  | null
  | readonly HandoffValueV1[]
  | Readonly<{ [key: string]: HandoffValueV1 }>;
```

`providerReference` and `details` are not raw serialization escape hatches. Each Kind or Provider supplies an explicit projection of safe, useful fields. Unknown fields are omitted.

`relatedItems` is empty in the initial implementation. It reserves the distinction between additional context and additional targets without adding a related-item UI prematurely.

## Generation boundaries

The feature should be separated into four units:

### Handoff projector

Inputs:

- one `ScoredItem`;
- an optional score explanation;
- the minimal serialized Triage Session;
- operator-authored intent fields;
- a creation timestamp supplied by the caller;
- provider and Kind projection rules.

Output:

- an immutable `AgentHandoffV1`.

The projector is pure and must not access the DOM, clipboard, downloads, provider network APIs, or browser storage.

### Validator

The validator checks:

- supported schema and version;
- exactly one target;
- non-empty outcome;
- stable target identity and URL;
- JSON-safe values;
- absence of known secret-bearing fields;
- maximum size limits.

Validation errors are shown inline and prevent transport.

### Renderer

The renderer converts a validated Agent Handoff into deterministic Markdown. Given the same handoff object, it must produce the same text apart from the explicit `createdAt` value.

Markdown sections use the domain distinction directly:

```md
# Agent handoff

## Outcome
...

## Target
...

## Evidence
...

## Constraints
...

## Verification
...

## Context
...
```

### Transport adapters

Each adapter receives only a validated Agent Handoff or its rendered projection.

Initial adapters:

- clipboard Markdown;
- downloadable Markdown Blob;
- downloadable JSON Blob.

Adapters report success, cancellation, unsupported capability, and failure through a common result shape.

## Portability and browser constraints

### Local files

Version 1 does not attempt to write `.triagekit/` or any other arbitrary path.

Direct filesystem access is not sufficiently portable across browsers and hosting modes. A future file-picker adapter may be added as progressive enhancement, but it must require explicit user selection and retain download as a fallback.

Suggested filenames are visible and non-sensitive:

```text
triagekit-<kind>-<provider-id>.md
triagekit-<kind>-<provider-id>.json
```

Filename components are sanitized and length-bounded.

### URLs

The full handoff is not placed in a query string or URL fragment. URLs leak through history, screenshots, logs, referrers, and copy operations, and they have inconsistent length limits.

A future deep-link adapter may include a small non-sensitive identifier or launch instruction, but not the full handoff or token.

### Browser extension

An extension may become a Transport Adapter. It can receive the same validated handoff and forward it through extension storage, downloads, or native messaging. The self-contained HTML must not require extension APIs.

### MCP

MCP is deferred until a process exists that can reliably host a transport.

A static HTML page cannot provide a local stdio server. A remote Streamable HTTP server would require hosted infrastructure and synchronization of the page's transient state, which conflicts with the current backend-free promise.

The preferred future shape is an optional local companion:

```text
self-contained HTML
  -> localhost bridge
  -> local companion
  -> filesystem and MCP adapters
  -> agent client
```

The companion is not part of the first implementation. If pursued, it must:

- bind to loopback only;
- use an explicit origin allow-list;
- require a short-lived pairing secret;
- expose no GitHub token;
- show the operator what handoff is being shared;
- preserve the same Agent Handoff schema.

## Security and privacy

Before transport, the UI shows a concise disclosure:

> This brief contains the selected item's repository context and provider link. It does not contain your GitHub token.

Security requirements:

- project safe fields through allow-lists;
- never serialize session storage;
- never include request headers or provider fetch errors with raw response bodies;
- escape Markdown control sequences where values could alter section structure;
- neutralize formula-like prefixes only if a future tabular export is introduced;
- cap rendered output size;
- preserve the existing CSP;
- make all transport actions user initiated.

For private repositories, the generated handoff may still contain sensitive code-security information. Triagekit cannot determine whether a destination agent is approved. The review step and disclosure make this boundary explicit.

## Failure states

### Item cannot be projected

Disable **Continue with agent** and explain which stable field is missing.

### Unsafe or unsupported fields

Omit the fields and show a non-blocking note in the preview. Do not serialize unknown provider payloads.

### Validation failure

Keep the Agent Brief open, show field-level errors, and disable all transport actions.

### Clipboard denied

Show a contextual error and keep the preview selectable. Offer both downloads.

### Download unavailable

Keep Copy Markdown available. Do not claim the file was saved.

### Oversized handoff

Block transport with a size explanation. Do not silently truncate evidence or details.

## Accessibility

- Opening the Agent Brief moves focus to its heading.
- Closing it restores focus to **Continue with agent**.
- All fields have visible labels.
- Validation errors are associated with their fields.
- Copy and download results use an `aria-live="polite"` region.
- Keyboard operation matches the existing detail drawer.
- No meaning relies on color alone.
- Reduced-motion behavior follows the existing drawer rules.

## Testing strategy

### Unit tests

- projection for every ready Kind;
- stable Markdown rendering;
- exactly-one-target validation;
- safe provider reference projection;
- unknown field omission;
- secret-shaped key rejection;
- filename sanitization;
- output size enforcement;
- adapter result normalization.

### Integration tests

- opened item to Agent Brief;
- edited outcome to copied Markdown;
- download MIME type, filename, and contents;
- clipboard-denied fallback;
- focus management and keyboard close;
- theme parity;
- no GitHub token in any rendered output.

### Artifact checks

- the compiled result remains one self-contained HTML file;
- no new third-party runtime scripts;
- CSP remains tracker-free and backend-free;
- anonymization lint covers example handoffs;
- existing tests remain green.

## Delivery roadmap

### Phase 1: Portable Agent Brief

- add the pure handoff projector and validator;
- add explicit safe projections for ready Kinds;
- add the detail-panel entry point;
- add the review surface;
- support copy Markdown and Markdown/JSON downloads;
- add unit, integration, anonymization, and artifact tests.

This phase validates whether operators find the handoff useful without coupling the product to an agent vendor.

### Phase 2: Destination adapters

Add adapters only where the destination offers a stable, documented handoff mechanism. Candidate actions include:

- Open in an agent application;
- copy a destination-specific command;
- send through a browser extension bridge.

Every adapter remains optional and receives the same validated handoff.

### Phase 3: Return envelope

Define an importable result format containing:

- target identity;
- summary of work;
- evidence and verification;
- changed-file or pull-request references;
- unresolved questions;
- status such as completed, partial, blocked, or declined.

Do not build result import until at least one real destination can produce the envelope reliably.

### Phase 4: Optional local companion and MCP

Evaluate a local companion only after portable handoffs and at least one direct adapter demonstrate repeated use. The companion may write `.triagekit/`, host MCP, or launch local agents, but it must remain optional.

### Phase 5: Batch handoffs

Add explicit selection state and multiple Handoff Targets only when users need to delegate related items together.

Batch design must define:

- whether targets share one outcome;
- partial success representation;
- per-target verification;
- retry behavior;
- returned result correlation.

The version 1 `targets` collection keeps this extension possible without committing to its interaction model.

## Alternatives considered

### Start with batch selection

Rejected for the first release. It adds selection state, batch intent editing, partial success, and result correlation before the basic handoff value is known.

### Export the entire filtered view

Rejected. A Triage Session expresses what the operator is examining. It does not authorize work on every visible item.

### Write a dotfile directly

Rejected as a baseline capability. Browser permissions and compatibility would make the core workflow dependent on execution context.

### Make the HTML an MCP server

Rejected. The static page cannot provide the local process and transport expected by agent clients without an extension, companion, or remote service.

### Build vendor-specific prompts first

Rejected. Vendor coupling would shape the data model around transport details and make portability harder.

## Decisions

- The canonical domain object is **Agent Handoff**.
- The review surface is **Agent Brief**.
- Version 1 has exactly one Handoff Target.
- The serialized field is `targets` for forward compatibility.
- Session state is Handoff Context, not target selection.
- The first transports are copy Markdown and Markdown/JSON downloads.
- Arbitrary dotfile writes, direct MCP hosting, result import, and batch selection are deferred.
- Provider References and details use explicit safe projections rather than raw serialization.

## Implementation-plan boundary

The first implementation plan should cover Phase 1 only. It should not include:

- vendor-specific deep links;
- browser extension APIs;
- a local companion;
- MCP;
- result import;
- batch selection.
