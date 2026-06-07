import type { Kind } from "./item";
import { listDomains, type Class } from "./taxonomy";

// What you triage. This is the top-level navigation axis: KIND is a tab, and a
// PROVIDER is a facet within a tab (github + gitlab both feed the neutral
// change-request artifact, displayed as "Change requests"), never a tab of its
// own. Each artifact is derived from the taxonomy (one per kind), so the rail
// tracks taxonomy changes automatically.
//
// Artifacts cluster into two classes the rail groups under a heading:
//   - finding: machine-detected risk, scored by severity × exploitability × fix
//   - work:    human items, scored by priority × age × blocker

export type ArtifactGroup = Class;             // "finding" | "work"
export interface Artifact { id: string; label: string; group: ArtifactGroup; kinds: Kind[]; }

export const GROUP_LABEL: Record<ArtifactGroup, string> = { finding: "Findings", work: "Work" };
export const GROUP_ORDER: ArtifactGroup[] = ["finding", "work"];

// One artifact per kind, derived from the taxonomy. The nav rail groups by class
// (GROUP_ORDER) -> domain order -> kind. No hand-listed second partition.
const KIND_LABEL: Partial<Record<Kind, string>> = {
  "dependency-vuln": "Dependencies", "code-scanning": "Code scanning", "secret-scanning": "Secrets",
  "cloud-misconfig": "Cloud misconfig", "edge-misconfig": "Edge misconfig", "waf-finding": "WAF",
  "runtime-threat": "Threats",
  "change-request": "Change requests",  // neutral display noun for the change-request artifact; GitHub "Pull requests" / GitLab "Merge requests" are per-provider nouns declared in ProviderManifest.labels (not shown in the neutral sidebar)
  issue: "Issues",
  email: "Inbox", task: "Tasks",
};

const ARTIFACTS: Artifact[] = listDomains().flatMap(d =>
  d.kinds.map<Artifact>(k => ({ id: k, label: KIND_LABEL[k] ?? k, group: d.class, kinds: [k] })));

const byKind = new Map<Kind, Artifact>(ARTIFACTS.map(a => [a.kinds[0], a] as const));

export function listArtifacts(): Artifact[] { return ARTIFACTS; }
export function artifactOf(kind: Kind): Artifact {
  const a = byKind.get(kind); if (!a) throw new Error(`kind has no artifact: ${kind}`); return a;
}
