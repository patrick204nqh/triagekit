import type { Kind } from "./item";

// What you triage, independent of where it comes from. This is the top-level
// navigation axis: a provider is a facet within an artifact (GitHub + GitLab both
// feed "Vulnerabilities"), not a tab of its own. Each artifact groups the kinds
// that belong to the same prioritized queue.
export interface Artifact { id: string; label: string; kinds: Kind[]; }

const ARTIFACTS: Artifact[] = [
  { id: "vulnerabilities",   label: "Vulnerabilities",   kinds: ["dependency-vuln", "code-scanning"] },
  { id: "misconfigurations", label: "Misconfigurations", kinds: ["infra-misconfig", "edge-misconfig", "waf-finding"] },
  { id: "secrets",           label: "Secrets",           kinds: ["secret-scanning"] },
  { id: "tickets",           label: "Tickets",           kinds: ["work-item"] },
];

const byKind = new Map<Kind, Artifact>(ARTIFACTS.flatMap(a => a.kinds.map(k => [k, a] as const)));

export function listArtifacts(): Artifact[] { return ARTIFACTS; }
export function artifactOf(kind: Kind): Artifact {
  const a = byKind.get(kind); if (!a) throw new Error(`kind has no artifact: ${kind}`); return a;
}
