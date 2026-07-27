import type { Artifact } from "../../dataset/artifact";
import type { ScoredItem } from "../table/kind-renderer";

// Extra tabs beyond built-ins. Tabs consume already-loaded, already-scored rows.
export interface TabModule {
  id: string;
  label: string;
  order: number;
  appliesTo(artifact: Artifact, rows: ScoredItem[]): boolean;
  render(root: HTMLElement, rows: ScoredItem[]): void;
}
