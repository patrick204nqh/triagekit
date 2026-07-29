import type {
  DiscoveryOption,
  Scope,
  TriageFailure,
} from "../catalog/types";
import type { Kind, TriageItem } from "../dataset/item";

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

export interface BoundProvider {
  discoverScope(signal?: AbortSignal): Promise<readonly DiscoveryOption[]>;
  canonicalizeScope(scope: Scope): Scope;
  targets(scope: Scope): readonly string[];
  fetchSlices(request: {
    scope: Scope;
    slices: readonly SliceRequest[];
    signal: AbortSignal;
  }): AsyncIterable<SliceOutcome>;
  close(): void;
}

export interface ProviderDefinition {
  readonly id: string;
  readonly kinds: readonly Kind[];
  bind(credential: string): Promise<BoundProvider>;
}
