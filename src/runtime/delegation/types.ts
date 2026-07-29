import type { Kind } from "../dataset/item";
import type {
  HandoffIntent,
  HandoffTargetV1,
} from "../handoff/types";
import type { ScoredItem } from "../layout/table/kind-renderer";

export interface QueueIdentity {
  readonly provider: string;
  readonly itemId: string;
  readonly kind: Kind;
  readonly repository: string;
}

export type QueueStatus =
  | "queued"
  | "checking"
  | "current"
  | "changed"
  | "resolved"
  | "unavailable"
  | "blocked"
  | "transferred";

export interface QueueEntry {
  readonly identity: QueueIdentity;
  readonly selectedAt: number;
  readonly selected: boolean;
  readonly status: QueueStatus;
  readonly reason?: string;
  readonly changedFields?: readonly string[];
  readonly transferredAt?: number;
}

export interface QueueSnapshot {
  readonly entries: readonly QueueEntry[];
  readonly selectedCount: number;
}

export interface QueueTransition {
  readonly status: QueueStatus;
  readonly selected?: boolean;
  readonly reason?: string;
  readonly changedFields?: readonly string[];
}

export interface DelegationQueueStore {
  load(): readonly QueueEntry[];
  save(entries: readonly QueueEntry[]): void;
}

export interface DelegationQueue {
  add(identity: QueueIdentity, selectedAt: number): boolean;
  addMany(identities: readonly QueueIdentity[], selectedAt: number): number;
  remove(key: string): boolean;
  setSelected(key: string, selected: boolean): boolean;
  transition(key: string, transition: QueueTransition): boolean;
  markTransferred(keys: readonly string[], transferredAt: number): number;
  snapshot(): QueueSnapshot;
  serialize(): readonly QueueEntry[];
  subscribe(listener: (snapshot: QueueSnapshot) => void): () => void;
}

export interface PlannedPackage {
  readonly id: string;
  readonly provider: string;
  readonly repository: string;
  readonly kind: Kind;
  readonly intent: HandoffIntent;
  readonly targets: readonly ScoredItem[];
  readonly selectionReason: string;
}

export interface PlanResult {
  readonly transfer: readonly PlannedPackage[];
  readonly remaining: readonly PlannedPackage[];
  readonly remainingPackages: number;
}

export interface PlanPackagesInput {
  readonly items: readonly ScoredItem[];
  readonly repositoryOrder: readonly string[];
  readonly includeLabels?: readonly string[];
  readonly excludeLabels?: readonly string[];
}

export interface DelegationFocusV1 {
  readonly provider: string;
  readonly repositoryOrder: readonly string[];
  readonly includeLabels: readonly string[];
  readonly excludeLabels: readonly string[];
}

export interface DelegationInstructionsV1 {
  readonly processPackagesInOrder: true;
  readonly generatedFrom: "explicit-session-queue";
}

export interface WorkPackageV1 {
  readonly id: string;
  readonly order: number;
  readonly repository: string;
  readonly kind: Kind;
  readonly intent: HandoffIntent;
  readonly targets: readonly HandoffTargetV1[];
  readonly selectionReason: string;
}

export interface DelegationBundleV1 {
  readonly schema: "triagekit.delegation-bundle";
  readonly version: 1;
  readonly createdAt: string;
  readonly focus: DelegationFocusV1;
  readonly instructions: DelegationInstructionsV1;
  readonly packages: readonly WorkPackageV1[];
}

export interface DelegationValidationError {
  readonly packageId?: string;
  readonly field: string;
  readonly message: string;
}

export type DelegationValidationResult =
  | { readonly valid: true }
  | {
    readonly valid: false;
    readonly errors: readonly DelegationValidationError[];
  };
