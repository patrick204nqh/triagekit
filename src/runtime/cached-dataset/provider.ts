import type {
  DiscoveryOption,
  Scope,
  TriageFailure,
} from "../catalog/types";
import type { Kind, TriageItem } from "../dataset/item";
import type { ActionDefinition } from "../actions/types";

export interface SliceRequest {
  readonly target: string;
  readonly kind: Kind;
  readonly validator?: string;
}

export type SliceOutcome =
  | {
    readonly type: "changed";
    readonly target: string;
    readonly kind: Kind;
    readonly items: readonly TriageItem[];
    readonly validator?: string;
  }
  | {
    readonly type: "unchanged";
    readonly target: string;
    readonly kind: Kind;
    readonly validator: string;
  }
  | {
    readonly type: "failed";
    readonly target: string;
    readonly kind: Kind;
    readonly failure: TriageFailure;
  };

export interface ProviderConnectionStatus {
  readonly paused: boolean;
  readonly retryAt?: number;
  readonly reason?: string;
}

export interface BoundProvider {
  readonly actions?: readonly ActionDefinition[];
  discoverScope(signal?: AbortSignal): Promise<readonly DiscoveryOption[]>;
  canonicalizeScope(scope: Scope): Scope;
  targets(scope: Scope): readonly string[];
  fetchSlices(request: {
    scope: Scope;
    slices: readonly SliceRequest[];
    signal: AbortSignal;
  }): AsyncIterable<SliceOutcome>;
  status?(): ProviderConnectionStatus;
  subscribeStatus?(
    observer: (status: ProviderConnectionStatus) => void,
  ): () => void;
  close(): void;
}

export interface ProviderDefinition {
  readonly id: string;
  readonly kinds: readonly Kind[];
  bind(credential: string): Promise<BoundProvider>;
}
