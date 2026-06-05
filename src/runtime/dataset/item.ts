export type Kind =
  | "dependency-vuln"   // code-security (ported now)
  | "code-scanning"     // code-security (roadmap)
  | "secret-scanning"   // code-security (roadmap)
  | "infra-misconfig"   // cloud-posture (roadmap)
  | "edge-misconfig"    // edge-security (roadmap)
  | "waf-finding"       // edge-security (roadmap)
  | "pull-request"      // work (review surface)
  | "issue"             // work (review surface)
  | "work-item";        // work-items (roadmap)

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
