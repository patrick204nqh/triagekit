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
