import type { Artifact } from "../dataset/artifact";
import type { ScoredItem } from "./table/kind-renderer";

// Extra tabs beyond the built-in List + Insights. Each renders the already-loaded,
// already-scored rows for the active artifact (no fetch).
export interface TabModule {
  id: string;
  label: string;
  order: number;
  appliesTo(artifact: Artifact, rows: ScoredItem[]): boolean;
  render(root: HTMLElement, rows: ScoredItem[]): void;
}

const tabs = new Map<string, TabModule>();
export function registerTab(t: TabModule): void { tabs.set(t.id, t); }
export function getTab(id: string): TabModule | undefined { return tabs.get(id); }
export function applicableTabs(artifact: Artifact, rows: ScoredItem[]): TabModule[] {
  return [...tabs.values()].filter(t => t.appliesTo(artifact, rows)).sort((a, b) => a.order - b.order);
}
export function _resetTabs(): void { tabs.clear(); }   // test-only
