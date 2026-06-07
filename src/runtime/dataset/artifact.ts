import type { Kind } from "./item";
import { listDomains, type Class } from "./taxonomy";

// What you triage. This is the top-level navigation axis: KIND is a tab, and a
// PROVIDER is a facet within a tab (github + gitlab both feed "Pull requests"),
// never a tab of its own. Each artifact is derived from the taxonomy (one per
// kind), so the rail tracks taxonomy changes automatically.
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
  "change-request": "Pull requests",  // dominant-provider noun; per-provider override is ProviderManifest.labels (fallback when a provider declares no label)
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
