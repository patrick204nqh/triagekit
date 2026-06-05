import type { Kind } from "../../dataset/item";
import type { ScoredItem } from "../triage-table";

export interface TriageChart {
  id: string;
  title: string;
  kinds: Kind[] | "*";          // "*" = generic
  span?: boolean;               // full-width in the grid
  meta?(rows: ScoredItem[]): string;   // optional headline stat (may contain <b>…</b>)
  render(rows: ScoredItem[], el: HTMLElement): void;   // CSS/SVG only — no time-series
}
const charts: TriageChart[] = [];
export function registerChart(c: TriageChart) { charts.push(c); }
export function chartsFor(kinds: Kind[]): TriageChart[] {
  return charts.filter(c => c.kinds === "*" || (c.kinds as Kind[]).some(k => kinds.includes(k)));
}
