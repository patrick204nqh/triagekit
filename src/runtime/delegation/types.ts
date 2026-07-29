import type { Kind } from "../dataset/item";

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
