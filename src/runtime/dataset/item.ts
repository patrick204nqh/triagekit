// Vocabulary (see Phase 5c):
//   provider  - user-facing identity (ProviderManifest, icons, switch). github, gitlab...
//   source    - one adapter feeding specific kinds; a provider may expose several
//               (github -> change-request + dependency-vuln + ...).
//   signal    - raw 0-100 input from the adapter (TriageItem.signal below).
//   score     - the computed rank after a scorer/model runs (NOT carried on TriageItem).
//   scope     - provider-owned fetch configuration (for example, repositories).
//   repoView  - the repo display filter you are currently viewing (NOT scope).

export const KINDS = [
  "dependency-vuln", // code-security
  "code-scanning", // code-security
  "secret-scanning", // code-security (roadmap)
  "cloud-misconfig", // cloud-posture (roadmap)
  "edge-misconfig", // edge-security (roadmap)
  "waf-finding", // edge-security (roadmap)
  "runtime-threat", // threat-detection (roadmap)
  "change-request", // work / code-review
  "issue", // work / tracking
  "email", // work / inbox (roadmap)
  "task", // work / tasks (roadmap)
] as const;

export type Kind = (typeof KINDS)[number];

export interface TriageItem<D = unknown> {
  id: string;          // `${provider}:${native id}`
  provider: string;    // "github" | "aws" | "jira"
  providerRef: unknown;
  kind: Kind;
  title: string;       // package / resource / ticket summary
  location: string;    // repo / account:region / board
  signal: number;      // 0–100 normalized rank input
  createdAt: string;   // ISO
  url: string;
  details: D;          // kind-specific, adapter-extracted (NOT raw passthrough)
}
