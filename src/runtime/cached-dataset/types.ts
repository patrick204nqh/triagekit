import type {
  DiscoveryOption,
  Scope,
  TriageFailure,
} from "../catalog/types";
import type { Kind, TriageItem } from "../dataset/item";

export type RefreshCadence = "off" | 300 | 600 | 900;
export type SliceFreshness =
  | "fresh"
  | "stale"
  | "refreshing"
  | "failed"
  | "requires-refresh";

export interface SliceKey {
  readonly connectionKey: string;
  readonly target: string;
  readonly kind: Kind;
}

export interface SliceState {
  readonly target: string;
  readonly kind: Kind;
  readonly freshness: SliceFreshness;
  readonly validatedAt?: number;
  readonly failure?: TriageFailure;
}

export interface DatasetSnapshot {
  readonly phase: "hydrating" | "ready" | "refreshing" | "partial" | "paused" | "closed";
  readonly provider: string;
  readonly scope: Scope;
  readonly cadence: RefreshCadence;
  readonly items: readonly TriageItem[];
  readonly slices: readonly SliceState[];
  readonly persistence: "indexeddb" | "memory";
  readonly warnings: readonly string[];
  readonly retryAt?: number;
}

export interface RefreshReport {
  readonly status: "complete" | "partial" | "superseded" | "paused";
  readonly refreshed: readonly Omit<SliceKey, "connectionKey">[];
  readonly retainedStale: readonly Omit<SliceKey, "connectionKey">[];
  readonly failures: readonly TriageFailure[];
  readonly retryAt?: number;
}

export type DisconnectMode = "retain-cache" | "erase";

export interface CachedDatasets {
  connect(provider: string, credential: string): Promise<ConnectedProvider>;
  resume(provider: string): Promise<ConnectedProvider | null>;
}

export interface ConnectedProvider {
  discoverScope(signal?: AbortSignal): Promise<readonly DiscoveryOption[]>;
  open(input: {
    scope: Scope;
    kinds: readonly Kind[];
    cadence: RefreshCadence;
  }): DatasetSession;
}

export interface DatasetSession {
  snapshot(): DatasetSnapshot;
  subscribe(observer: (snapshot: DatasetSnapshot) => void): () => void;
  refresh(selection?: {
    targets?: readonly string[];
    kinds?: readonly Kind[];
  }): Promise<RefreshReport>;
  setCadence(cadence: RefreshCadence): void;
  clearCachedData(): Promise<void>;
  disconnect(mode: DisconnectMode): Promise<void>;
}
