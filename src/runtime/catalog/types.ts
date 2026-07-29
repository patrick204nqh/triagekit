import type { Kind, TriageItem } from "../dataset/item";
import type { Artifact } from "../dataset/artifact";
import type { DomainId } from "../dataset/taxonomy";
import type { FieldDef } from "../scoring/field-catalog";
import type { ScoreModel } from "../scoring/score-model";
import type { KindRenderer } from "../layout/table/kind-renderer";
import type {
  FilterAxis,
  SortKey,
} from "../layout/toolbar/axis-registry";
import type { TriageChart } from "../layout/charts/registry";
import type { ViewModule } from "../views/registry";
import type { TabModule } from "../layout/navigation/tab-registry";
import type { HandoffTargetV1 } from "../handoff/types";
import type { InsightCapabilities } from "../insights/types";

export type Scope = Readonly<Record<string, unknown>>;
export type Scorer = (item: TriageItem) => number;
export type FailureCategory =
  | "auth"
  | "scope"
  | "rate-limit"
  | "network"
  | "not-found"
  | "provider";

export interface TriageFailure {
  provider: string;
  kind?: Kind;
  target?: string;
  category: FailureCategory;
  message: string;
}

export interface KindRefreshOutcome {
  kind: Kind;
  status: "success" | "partial" | "failed";
  items: readonly TriageItem[];
  failures: readonly TriageFailure[];
}

export interface RefreshRequest {
  credential: string;
  scope: Scope;
  kinds: readonly Kind[];
}

export interface DiscoveryOption {
  value: string;
  label: string;
  group?: string;
}

export interface ProviderAdapter {
  refresh(request: RefreshRequest): Promise<readonly KindRefreshOutcome[]>;
  discoverScope?(credential: string): Promise<readonly DiscoveryOption[]>;
  enrich?(
    kind: Kind,
    ref: unknown,
    credential: string,
  ): Promise<unknown>;
}

export interface ScopeField {
  key: string;
  label: string;
  type: "multiselect" | "text" | "select";
  discoverable?: boolean;
  required?: boolean;
}

export interface ProviderCapabilities {
  discoverScope: boolean;
  enrich: readonly Kind[];
  actions: Readonly<Partial<Record<Kind, readonly string[]>>>;
}

export interface ProviderDeclaration {
  id: string;
  label: string;
  status: "ready" | "upcoming";
  kinds: readonly Kind[];
  connection: {
    setupHint: string;
    setupUrl?: string;
    scopeFields: readonly ScopeField[];
  };
  capabilities: ProviderCapabilities;
  adapter?: ProviderAdapter;
}

export interface ReadyKindDeclaration {
  kind: Kind;
  domain: DomainId;
  label: string;
  status: "ready";
  fields: readonly FieldDef[];
  builtInScorer: Scorer;
  defaultModel?: ScoreModel;
  renderer: KindRenderer;
  filters: readonly FilterAxis[];
  sorts: readonly SortKey[];
  charts: readonly TriageChart[];
  views: readonly ViewModule[];
  insights?: InsightCapabilities;
  projectTarget?: (item: TriageItem) => Omit<HandoffTargetV1, "id" | "kind" | "provider" | "url">;
}

export interface UpcomingKindDeclaration {
  kind: Kind;
  domain: DomainId;
  label: string;
  status: "upcoming";
}

export type KindDeclaration =
  | ReadyKindDeclaration
  | UpcomingKindDeclaration;

export interface RuntimeDefaults {
  filters: readonly FilterAxis[];
  sorts: readonly SortKey[];
  charts: readonly TriageChart[];
  tabs: readonly TabModule[];
}

export interface RuntimeCatalog {
  kind(id: Kind): KindDeclaration | undefined;
  readyKind(id: Kind): ReadyKindDeclaration | undefined;
  insightsFor(kind: Kind): InsightCapabilities | undefined;
  kinds(): readonly KindDeclaration[];
  artifact(id: Kind): Artifact | undefined;
  artifacts(): readonly Artifact[];
  provider(id: string): ProviderDeclaration | undefined;
  providers(): readonly ProviderDeclaration[];
  providersFor(kind: Kind): readonly ProviderDeclaration[];
  fieldsFor(kind: Kind): readonly FieldDef[];
  filter(id: string): FilterAxis | undefined;
  sort(id: string): SortKey | undefined;
  filtersFor(kind: Kind): readonly FilterAxis[];
  sortsFor(kind: Kind): readonly SortKey[];
  chartsFor(kinds: readonly Kind[]): readonly TriageChart[];
  viewsFor(kind: Kind): readonly ViewModule[];
  tabs(): readonly TabModule[];
}
