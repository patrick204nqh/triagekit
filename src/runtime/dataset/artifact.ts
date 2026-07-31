import type { Kind } from "./item";
import type { Class } from "./taxonomy";

// What you triage. This is the top-level navigation axis: KIND is a tab, and a
// PROVIDER is a filter within a tab (github + gitlab both feed the neutral
// change-request artifact, displayed as "Change requests"), never a tab of its
// own. Each artifact is derived from the taxonomy (one per kind), so the rail
// tracks taxonomy changes automatically.
//
// Artifacts cluster into two classes the rail groups under a heading:
//   - finding: machine-detected risk, scored by severity × exploitability × fix
//   - work:    human items, scored by priority × age × blocker

export type ArtifactGroup = Class;             // "finding" | "work"
export interface Artifact {
  id: Kind;
  label: string;
  group: ArtifactGroup;
  kinds: readonly Kind[];
}

export const GROUP_LABEL: Record<ArtifactGroup, string> = { finding: "Findings", work: "Work" };
export const GROUP_ORDER: ArtifactGroup[] = ["finding", "work"];
