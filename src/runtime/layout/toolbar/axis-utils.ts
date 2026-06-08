// src/runtime/layout/toolbar/axis-utils.ts
import type { ScoredItem } from "../table/kind-renderer";

export function uniqueValues(
  rows: ScoredItem[],
  pick: (r: ScoredItem) => string | string[] | undefined,
  filter: (r: ScoredItem) => boolean = () => true,
): { value: string; label: string }[] {
  const vals = new Set<string>();
  for (const r of rows) {
    if (!filter(r)) continue;
    const v = pick(r);
    if (v == null) continue;
    (Array.isArray(v) ? v : [v]).forEach(x => vals.add(x));
  }
  return [...vals].sort().map(value => ({ value, label: value }));
}
