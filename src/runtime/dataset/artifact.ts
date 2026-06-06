import type { Kind } from "./item";

// What you triage, independent of where it comes from. This is the top-level
// navigation axis: a provider is a facet within an artifact (GitHub + GitLab both
// feed "Vulnerabilities"), not a tab of its own. Each artifact groups the kinds
// that belong to the same prioritized queue.
//
// Artifacts cluster into two classes the rail groups under a heading:
//   - findings: machine-detected risk, scored by severity × exploitability × fix
//   - work:     human items, scored by priority × age × blocker
// A provider stays a facet within an artifact, so adding a similar provider
// (gitlab next to github) never adds a nav entry — it just lights up a facet chip.
export type ArtifactGroup = "findings" | "work";
export interface Artifact { id: string; label: string; group: ArtifactGroup; kinds: Kind[]; }

export const GROUP_LABEL: Record<ArtifactGroup, string> = { findings: "Findings", work: "Work" };
export const GROUP_ORDER: ArtifactGroup[] = ["findings", "work"];

const ARTIFACTS: Artifact[] = [
  { id: "vulnerabilities",   label: "Vulnerabilities",   group: "findings", kinds: ["dependency-vuln", "code-scanning"] },
  { id: "secrets",           label: "Secrets",           group: "findings", kinds: ["secret-scanning"] },
  { id: "misconfigurations", label: "Misconfigurations", group: "findings", kinds: ["infra-misconfig", "edge-misconfig", "waf-finding"] },
  { id: "threats",           label: "Threats",           group: "findings", kinds: ["runtime-threat"] },
  { id: "review",            label: "Review",            group: "work",     kinds: ["pull-request", "issue"] },
  { id: "tasks",             label: "Tasks",             group: "work",     kinds: ["work-item"] },
];

const byKind = new Map<Kind, Artifact>(ARTIFACTS.flatMap(a => a.kinds.map(k => [k, a] as const)));

export function listArtifacts(): Artifact[] { return ARTIFACTS; }
export function artifactOf(kind: Kind): Artifact {
  const a = byKind.get(kind); if (!a) throw new Error(`kind has no artifact: ${kind}`); return a;
}
