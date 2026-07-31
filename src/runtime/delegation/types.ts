import type { Kind } from "../dataset/item";
import type {
  HandoffIntent,
  HandoffMode,
  HandoffTargetV1,
  TransportResult,
} from "../handoff/types";
import type { ScoredItem } from "../layout/table/kind-renderer";
import type {
  DatasetSession,
  DatasetSnapshot,
} from "../cached-dataset/types";
import type { TriageItem } from "../dataset/item";

export interface QueueIdentity {
  readonly provider: string;
  readonly itemId: string;
  readonly kind: Kind;
  readonly repository: string;
}

export type { HandoffMode } from "../handoff/types";

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
  readonly note?: string;
  readonly reason?: string;
  readonly changedFields?: readonly string[];
  readonly transferredAt?: number;
}

export interface QueueSnapshot {
  readonly mode: HandoffMode;
  readonly missionNote?: string;
  readonly entries: readonly QueueEntry[];
  readonly selectedCount: number;
}

export interface HandoffQueueState {
  readonly mode: HandoffMode;
  readonly missionNote?: string;
  readonly entries: readonly QueueEntry[];
}

export interface QueueTransition {
  readonly status: QueueStatus;
  readonly selected?: boolean;
  readonly reason?: string;
  readonly changedFields?: readonly string[];
  readonly transferredAt?: number | null;
}

export interface DelegationQueueStore {
  load(): HandoffQueueState;
  save(state: HandoffQueueState): void;
}

export interface DelegationQueue {
  setMode(mode: HandoffMode): boolean;
  setMissionNote(note: string): boolean;
  setItemNote(key: string, note: string): boolean;
  add(identity: QueueIdentity, selectedAt: number): boolean;
  addMany(identities: readonly QueueIdentity[], selectedAt: number): number;
  setSelectedMany(
    identities: readonly QueueIdentity[],
    selected: boolean,
    selectedAt: number,
  ): number;
  remove(key: string): boolean;
  setSelected(key: string, selected: boolean): boolean;
  transition(key: string, transition: QueueTransition): boolean;
  transitionMany(
    transitions: readonly {
      readonly key: string;
      readonly transition: QueueTransition;
    }[],
  ): number;
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
  readonly generatedIntent: HandoffIntent;
  /** Transitional until the breaking Handoff cutover. */
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
  readonly mode?: HandoffMode;
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
  readonly mode?: HandoffMode;
  readonly missionNote?: string;
  readonly generatedBoundary?: readonly string[];
  readonly processPackagesInOrder: true;
  readonly generatedFrom: "explicit-session-queue";
}

export interface WorkPackageV1 {
  readonly id: string;
  readonly order: number;
  readonly repository: string;
  readonly kind: Kind;
  readonly generatedIntent: HandoffIntent;
  /** Transitional until the breaking Handoff cutover. */
  readonly intent: HandoffIntent;
  readonly targets: readonly HandoffTargetV1[];
  readonly selectionReason: string;
}

export interface DelegationBundleV1 {
  readonly schema:
    | "triagekit.handoff-bundle"
    | "triagekit.delegation-bundle";
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

export interface QueueRevalidationTransition {
  readonly key: string;
  readonly itemId: string;
  readonly status:
    | "current"
    | "changed"
    | "resolved"
    | "unavailable"
    | "blocked";
  readonly selected: boolean;
  readonly reason?: string;
  readonly changedFields?: readonly string[];
}

export interface RevalidationResult {
  readonly transitions: readonly QueueRevalidationTransition[];
}

export interface DelegationQueueSummaryItem {
  readonly key: string;
  readonly itemId: string;
  readonly title: string;
  readonly repository: string;
  readonly kind: Kind;
  readonly status: QueueStatus;
  readonly reason?: string;
  readonly transferredAt?: number;
}

export interface RevalidateQueueInput {
  readonly entries: readonly QueueEntry[];
  readonly before: DatasetSnapshot;
  readonly session: DatasetSession | null;
  readonly project: (item: TriageItem) => unknown;
  readonly onChecking?: (entries: readonly QueueEntry[]) => void;
}

export interface DelegationControllerSnapshot {
  readonly open: boolean;
  readonly selectedCount: number;
  readonly retainedCount: number;
  readonly remainingPackages: number;
  readonly packages: readonly WorkPackageV1[];
  readonly errors: readonly DelegationValidationError[];
  readonly previewMarkdown: string;
  readonly canDownload: boolean;
  readonly error: string | null;
  readonly notice: {
    readonly tone: "success" | "error" | "info";
    readonly message: string;
  } | null;
  readonly pendingConfirmation: {
    readonly packageCount: number;
    readonly targetCount: number;
  } | null;
  readonly canUndoHandoff: boolean;
  readonly busyAction: "copy" | "revalidate" | null;
  readonly notInNextBundle: readonly DelegationQueueSummaryItem[];
  readonly handedOff: readonly DelegationQueueSummaryItem[];
}

export interface DelegationController {
  snapshot(): DelegationControllerSnapshot;
  subscribe(listener: (snapshot: DelegationControllerSnapshot) => void): () => void;
  open(): void;
  close(): void;
  updateIntent(packageId: string, intent: Partial<HandoffIntent>): void;
  removeTarget(itemId: string): void;
  removeQueueItem(key: string): boolean;
  revalidate(): Promise<void>;
  copyBundle(): Promise<TransportResult>;
  copyPackage(packageId: string): Promise<TransportResult>;
  confirmHandoff(): boolean;
  undoHandoff(): boolean;
  downloadBundle(format?: "md" | "json"): TransportResult;
  downloadPackage(
    packageId: string,
    format?: "md" | "json",
  ): TransportResult;
}
