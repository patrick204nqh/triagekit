import type { Kind } from "./item";

// What you triage. This is the top-level navigation axis: KIND is a tab, and a
// PROVIDER is a facet within a tab (github + gitlab both feed "Pull requests"),
// never a tab of its own. Each artifact is one kind, so the rail reads as a flat
// list of finding/work types under two group headings.
//
// Artifacts cluster into two classes the rail groups under a heading:
//   - findings: machine-detected risk, scored by severity × exploitability × fix
//   - work:     human items, scored by priority × age × blocker
export type ArtifactGroup = "findings" | "work";
export interface Artifact { id: string; label: string; group: ArtifactGroup; kinds: Kind[]; }

export const GROUP_LABEL: Record<ArtifactGroup, string> = { findings: "Findings", work: "Work" };
export const GROUP_ORDER: ArtifactGroup[] = ["findings", "work"];

const ARTIFACTS: Artifact[] = [
  { id: "dependencies",      label: "Dependencies",      group: "findings", kinds: ["dependency-vuln"] },
  { id: "code-scanning",     label: "Code scanning",     group: "findings", kinds: ["code-scanning"] },
  { id: "secrets",           label: "Secrets",           group: "findings", kinds: ["secret-scanning"] },
  { id: "misconfigurations", label: "Misconfigurations", group: "findings", kinds: ["infra-misconfig", "edge-misconfig", "waf-finding"] },
  { id: "threats",           label: "Threats",           group: "findings", kinds: ["runtime-threat"] },
  { id: "pull-requests",     label: "Pull requests",     group: "work",     kinds: ["pull-request"] },
  { id: "issues",            label: "Issues",            group: "work",     kinds: ["issue"] },
  { id: "tasks",             label: "Tasks",             group: "work",     kinds: ["work-item"] },
];

const byKind = new Map<Kind, Artifact>(ARTIFACTS.flatMap(a => a.kinds.map(k => [k, a] as const)));

export function listArtifacts(): Artifact[] { return ARTIFACTS; }
export function artifactOf(kind: Kind): Artifact {
  const a = byKind.get(kind); if (!a) throw new Error(`kind has no artifact: ${kind}`); return a;
}
