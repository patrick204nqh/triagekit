import type { Kind } from "../dataset/item";
import type { ListState } from "../layout/toolbar/filter-state";
import type { ScoredItem } from "../layout/table/kind-renderer";

export type WorkIntent = "refresh" | "rederive" | "present" | "none";

export interface SessionState {
  kind: Kind;
  provider: string;
  preferredRepository: string;
  effectiveRepository: string;
  view: string;
  filters: ListState;
}

export interface SerializedSession {
  kind?: string;
  provider?: string;
  repository?: string;
  view?: string;
  sort?: string;
  axes?: Readonly<Record<string, readonly string[]>>;
}

export interface SessionAvailability {
  repositories: readonly string[];
  views: readonly string[];
}

export interface SessionUpdate {
  state: Readonly<SessionState>;
  serialized: Readonly<SerializedSession>;
  work: WorkIntent;
}

export interface TriageSession {
  snapshot(): Readonly<SessionState>;
  serialize(): Readonly<SerializedSession>;
  selectKind(kind: Kind): SessionUpdate;
  selectProvider(provider: string): SessionUpdate;
  selectRepository(
    repository: string,
    rows: readonly ScoredItem[],
  ): SessionUpdate;
  selectView(view: string): SessionUpdate;
  changeFilters(filters: ListState): SessionUpdate;
  restore(serialized: SerializedSession): SessionUpdate;
  reconcile(
    availability: SessionAvailability,
    rows: readonly ScoredItem[],
  ): SessionUpdate;
}
