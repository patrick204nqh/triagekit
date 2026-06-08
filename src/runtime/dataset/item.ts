// Vocabulary (see Phase 5c):
//   provider  - user-facing identity (ProviderManifest, icons, switch). github, gitlab...
//   source    - one adapter feeding specific kinds; a provider may expose several
//               (github -> change-request-source + dependency-vuln-source + ...).
//   signal    - raw 0-100 input from the adapter (TriageItem.signal below).
//   score     - the computed rank after a scorer/model runs (NOT carried on TriageItem).
//   scope     - fetch config (which repos a source pulls); see ingest/source.ts Scope.
//   repoView  - the repo display filter you are currently viewing (NOT scope).

export type Kind =
  | "dependency-vuln"   // code-security
  | "code-scanning"     // code-security
  | "secret-scanning"   // code-security (roadmap)
  | "cloud-misconfig"   // cloud-posture (roadmap)
  | "edge-misconfig"    // edge-security (roadmap)
  | "waf-finding"       // edge-security (roadmap)
  | "runtime-threat"    // threat-detection (roadmap)
  | "change-request"    // work / code-review
  | "issue"             // work / tracking
  | "email"             // work / inbox (roadmap)
  | "task";             // work / tasks (roadmap)

export interface TriageItem<D = unknown> {
  id: string;          // `${source}:${native id}`
  source: string;      // "github" | "aws" | "jira"
  kind: Kind;
  title: string;       // package / resource / ticket summary
  location: string;    // repo / account:region / board
  signal: number;      // 0–100 normalized rank input
  createdAt: string;   // ISO
  url: string;
  details: D;          // kind-specific, adapter-extracted (NOT raw passthrough)
}
