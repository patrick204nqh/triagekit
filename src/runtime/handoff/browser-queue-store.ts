import type { StoragePort } from "../core/ports";
import type { Kind } from "../dataset/item";
import type {
  HandoffQueueStore,
  HandoffMode,
  HandoffQueueState,
  HandoffQueueEntry,
  HandoffQueueStatus,
} from "./types";

const QUEUE_KEY = "triagekit.handoff.queue.v1";
const MODES = new Set<HandoffMode>(["investigate", "implement"]);
const EMPTY_STATE: HandoffQueueState = {
  mode: "investigate",
  entries: [],
};
const KINDS = new Set<Kind>([
  "dependency-vuln",
  "code-scanning",
  "secret-scanning",
  "cloud-misconfig",
  "edge-misconfig",
  "waf-finding",
  "runtime-threat",
  "change-request",
  "issue",
  "email",
  "task",
]);
const STATUSES = new Set<HandoffQueueStatus>([
  "queued",
  "checking",
  "current",
  "changed",
  "resolved",
  "unavailable",
  "blocked",
  "transferred",
]);
const ENTRY_KEYS = new Set([
  "identity",
  "selectedAt",
  "selected",
  "status",
  "note",
  "reason",
  "changedFields",
  "transferredAt",
]);

function parseEntry(value: unknown): HandoffQueueEntry | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const entry = value as Record<string, unknown>;
  if (Object.keys(entry).some((key) => !ENTRY_KEYS.has(key))) return null;
  const identity = entry.identity as Record<string, unknown> | undefined;
  if (
    !identity
    || Object.keys(identity).some((key) =>
      !["provider", "itemId", "kind", "repository"].includes(key))
    || typeof identity.provider !== "string"
    || !identity.provider
    || typeof identity.itemId !== "string"
    || !identity.itemId
    || typeof identity.kind !== "string"
    || !KINDS.has(identity.kind as Kind)
    || typeof identity.repository !== "string"
    || !identity.repository
    || typeof entry.selectedAt !== "number"
    || !Number.isFinite(entry.selectedAt)
    || typeof entry.selected !== "boolean"
    || typeof entry.status !== "string"
    || !STATUSES.has(entry.status as HandoffQueueStatus)
    || (entry.note !== undefined && typeof entry.note !== "string")
    || (entry.reason !== undefined && typeof entry.reason !== "string")
    || (
      entry.changedFields !== undefined
      && (
        !Array.isArray(entry.changedFields)
        || !entry.changedFields.every((field) => typeof field === "string")
      )
    )
    || (
      entry.transferredAt !== undefined
      && (
        typeof entry.transferredAt !== "number"
        || !Number.isFinite(entry.transferredAt)
      )
    )
  ) return null;
  return {
    identity: {
      provider: identity.provider,
      itemId: identity.itemId,
      kind: identity.kind as Kind,
      repository: identity.repository,
    },
    selectedAt: entry.selectedAt,
    selected: entry.selected,
    status: entry.status as HandoffQueueStatus,
    ...(typeof entry.note === "string" && entry.note.trim()
      ? { note: entry.note.trim() }
      : {}),
    ...(entry.reason === undefined ? {} : { reason: entry.reason }),
    ...(entry.changedFields === undefined
      ? {}
      : { changedFields: entry.changedFields as string[] }),
    ...(entry.transferredAt === undefined
      ? {}
      : { transferredAt: entry.transferredAt }),
  };
}

export function createBrowserHandoffQueueStore(
  storage: StoragePort,
): HandoffQueueStore {
  return {
    load() {
      try {
        const parsed = JSON.parse(storage.get(QUEUE_KEY) ?? "null");
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          return EMPTY_STATE;
        }
        const state = parsed as Record<string, unknown>;
        if (
          Object.keys(state).some((key) =>
            !["mode", "missionNote", "entries"].includes(key))
          || typeof state.mode !== "string"
          || !MODES.has(state.mode as HandoffMode)
          || (
            state.missionNote !== undefined
            && typeof state.missionNote !== "string"
          )
          || !Array.isArray(state.entries)
        ) return EMPTY_STATE;
        const entries = state.entries.flatMap((entry) => {
          const safe = parseEntry(entry);
          return safe ? [safe] : [];
        });
        const missionNote = typeof state.missionNote === "string"
          ? state.missionNote.trim()
          : "";
        return {
          mode: state.mode as HandoffMode,
          ...(missionNote ? { missionNote } : {}),
          entries,
        };
      } catch {
        return EMPTY_STATE;
      }
    },
    save(state) {
      storage.set(QUEUE_KEY, JSON.stringify(state));
    },
  };
}
