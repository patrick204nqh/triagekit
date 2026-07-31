import type { Kind } from "../dataset/item";
import type { Tier } from "../scoring/tier";
import type { ScoredItem } from "../layout/table/kind-renderer";
import type {
  DatasetSession,
  DatasetSnapshot,
} from "../cached-dataset/types";
import type { TriageItem } from "../dataset/item";

export type HandoffMode = "investigate" | "implement";

export type HandoffValueV1 =
  | string
  | number
  | boolean
  | null
  | readonly HandoffValueV1[]
  | { readonly [key: string]: HandoffValueV1 };

export interface HandoffEvidenceV1 {
  readonly label: string;
  readonly value: string | number | boolean;
  readonly reason?: string;
}

export interface HandoffTargetV1 {
  readonly id: string;
  readonly kind: Kind;
  readonly provider: string;
  readonly providerReference: Readonly<
    Record<string, string | number | boolean>
  >;
  readonly title: string;
  readonly location: string;
  readonly url: string;
  readonly createdAt: string;
  readonly priority: {
    readonly signal: number;
    readonly score: number;
    readonly tier: Tier;
    readonly explanation?: readonly HandoffEvidenceV1[];
  };
  readonly note?: string;
  readonly details: Readonly<Record<string, HandoffValueV1>>;
}

export interface HandoffIntent {
  readonly outcome: string;
  readonly constraints: readonly string[];
  readonly verification: readonly string[];
}

export interface TransportResult {
  readonly ok: boolean;
  readonly error?: string;
}

export interface HandoffIdentity {
  readonly provider: string;
  readonly itemId: string;
  readonly kind: Kind;
  readonly repository: string;
}

export type HandoffQueueStatus =
  | "queued"
  | "checking"
  | "current"
  | "changed"
  | "resolved"
  | "unavailable"
  | "blocked"
  | "transferred";

export interface HandoffQueueEntry {
  readonly identity: HandoffIdentity;
  readonly selectedAt: number;
  readonly selected: boolean;
  readonly status: HandoffQueueStatus;
  readonly note?: string;
  readonly reason?: string;
  readonly changedFields?: readonly string[];
  readonly transferredAt?: number;
}

export interface HandoffQueueSnapshot {
  readonly mode: HandoffMode;
  readonly missionNote?: string;
  readonly entries: readonly HandoffQueueEntry[];
  readonly selectedCount: number;
}

export interface HandoffQueueState {
  readonly mode: HandoffMode;
  readonly missionNote?: string;
  readonly entries: readonly HandoffQueueEntry[];
}

export interface HandoffQueueTransition {
  readonly status: HandoffQueueStatus;
  readonly selected?: boolean;
  readonly reason?: string;
  readonly changedFields?: readonly string[];
  readonly transferredAt?: number | null;
}

export interface HandoffQueueStore {
  load(): HandoffQueueState;
  save(state: HandoffQueueState): void;
}

export interface HandoffQueue {
  setMode(mode: HandoffMode): boolean;
  setMissionNote(note: string): boolean;
  setItemNote(key: string, note: string): boolean;
  add(identity: HandoffIdentity, selectedAt: number): boolean;
  addMany(identities: readonly HandoffIdentity[], selectedAt: number): number;
  setSelectedMany(
    identities: readonly HandoffIdentity[],
    selected: boolean,
    selectedAt: number,
  ): number;
  remove(key: string): boolean;
  setSelected(key: string, selected: boolean): boolean;
  transition(key: string, transition: HandoffQueueTransition): boolean;
  transitionMany(
    transitions: readonly {
      readonly key: string;
      readonly transition: HandoffQueueTransition;
    }[],
  ): number;
  markTransferred(keys: readonly string[], transferredAt: number): number;
  snapshot(): HandoffQueueSnapshot;
  serialize(): readonly HandoffQueueEntry[];
  subscribe(listener: (snapshot: HandoffQueueSnapshot) => void): () => void;
}

export interface PlannedHandoffPackage {
  readonly id: string;
  readonly provider: string;
  readonly repository: string;
  readonly kind: Kind;
  readonly generatedIntent: HandoffIntent;
  readonly targets: readonly ScoredItem[];
  readonly selectionReason: string;
}

export interface HandoffPlanResult {
  readonly transfer: readonly PlannedHandoffPackage[];
  readonly remaining: readonly PlannedHandoffPackage[];
  readonly remainingPackages: number;
}

export interface HandoffPlanPackagesInput {
  readonly items: readonly ScoredItem[];
  readonly repositoryOrder: readonly string[];
 readonly mode: HandoffMode;
  readonly includeLabels?: readonly string[];
  readonly excludeLabels?: readonly string[];
}

export interface HandoffFocusV1 {
  readonly provider: string;
  readonly repositoryOrder: readonly string[];
  readonly includeLabels: readonly string[];
  readonly excludeLabels: readonly string[];
}

export interface HandoffInstructionsV1 {
  readonly mode?: HandoffMode;
  readonly missionNote?: string;
 readonly generatedBoundary: readonly string[];
  readonly processPackagesInOrder: true;
  readonly generatedFrom: "explicit-session-queue";
}

export interface HandoffPackageV1 {
  readonly id: string;
  readonly order: number;
  readonly repository: string;
  readonly kind: Kind;
  readonly generatedIntent: HandoffIntent;
  readonly targets: readonly HandoffTargetV1[];
  readonly selectionReason: string;
}

export interface HandoffBundleV1 {
  readonly schema: "triagekit.handoff-bundle";
  readonly version: 1;
  readonly createdAt: string;
  readonly focus: HandoffFocusV1;
  readonly instructions: HandoffInstructionsV1;
  readonly packages: readonly HandoffPackageV1[];
}

export interface HandoffValidationError {
  readonly packageId?: string;
  readonly field: string;
  readonly message: string;
}

export type HandoffValidationResult =
  | { readonly valid: true }
  | {
    readonly valid: false;
    readonly errors: readonly HandoffValidationError[];
  };

export interface HandoffQueueRevalidationTransition {
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
  readonly transitions: readonly HandoffQueueRevalidationTransition[];
}

export interface HandoffQueueSummaryItem {
  readonly key: string;
  readonly itemId: string;
  readonly title: string;
  readonly repository: string;
  readonly kind: Kind;
  readonly status: HandoffQueueStatus;
  readonly reason?: string;
  readonly transferredAt?: number;
}

export interface RevalidateHandoffQueueInput {
  readonly entries: readonly HandoffQueueEntry[];
  readonly before: DatasetSnapshot;
  readonly session: DatasetSession | null;
  readonly project: (item: TriageItem) => unknown;
  readonly onChecking?: (entries: readonly HandoffQueueEntry[]) => void;
}

export interface HandoffControllerSnapshot {
  readonly open: boolean;
  readonly mode: HandoffMode;
  readonly missionNote?: string;
  readonly selectedCount: number;
  readonly retainedCount: number;
  readonly remainingPackages: number;
  readonly packages: readonly HandoffPackageV1[];
  readonly errors: readonly HandoffValidationError[];
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
  readonly notInNextBundle: readonly HandoffQueueSummaryItem[];
  readonly handedOff: readonly HandoffQueueSummaryItem[];
}

export interface HandoffController {
  snapshot(): HandoffControllerSnapshot;
  subscribe(listener: (snapshot: HandoffControllerSnapshot) => void): () => void;
  open(): void;
  close(): void;
  setMode(mode: HandoffMode): void;
  setMissionNote(note: string): void;
  setItemNote(itemId: string, note: string): void;
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
