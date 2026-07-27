import type { Kind } from "../../dataset/item";
import type { ScoredItem } from "../table/kind-renderer";

export interface TriageChart {
  id: string;
  title: string;
  kinds: readonly Kind[] | "*";
  span?: boolean;
  meta?(rows: ScoredItem[]): string;
  render(rows: ScoredItem[], el: HTMLElement): void;
}
