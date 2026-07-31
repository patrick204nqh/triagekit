import { z } from "zod";
import type { StoragePort } from "../core/ports";
import { KINDS } from "../dataset/item";
import type {
  HandoffQueueStore,
  HandoffQueueState,
} from "./types";

const QUEUE_KEY = "triagekit.handoff.queue.v1";
const EMPTY_STATE: HandoffQueueState = {
  mode: "investigate",
  entries: [],
};
const kindSchema = z.enum(KINDS);
const identitySchema = z.strictObject({
  provider: z.string().min(1),
  itemId: z.string().min(1),
  kind: kindSchema,
  repository: z.string().min(1),
});
const entrySchema = z.strictObject({
  identity: identitySchema,
  selectedAt: z.number().finite(),
  selected: z.boolean(),
  status: z.enum([
    "queued",
    "checking",
    "current",
    "changed",
    "resolved",
    "unavailable",
    "blocked",
    "transferred",
  ]),
  note: z.string().optional(),
  reason: z.string().optional(),
  changedFields: z.array(z.string()).optional(),
  transferredAt: z.number().finite().optional(),
});
const aggregateSchema = z.strictObject({
  mode: z.enum(["investigate", "implement"]),
  missionNote: z.string().optional(),
  entries: z.array(z.unknown()),
});

function normalizeEntry(entry: z.infer<typeof entrySchema>) {
  return {
    identity: entry.identity,
    selectedAt: entry.selectedAt,
    selected: entry.selected,
    status: entry.status,
    ...(entry.note?.trim()
      ? { note: entry.note.trim() }
      : {}),
    ...(entry.reason === undefined ? {} : { reason: entry.reason }),
    ...(entry.changedFields === undefined
      ? {}
      : { changedFields: entry.changedFields }),
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
        const parsed = aggregateSchema.safeParse(
          JSON.parse(storage.get(QUEUE_KEY) ?? "null"),
        );
        if (!parsed.success) return EMPTY_STATE;
        const entries = parsed.data.entries.flatMap((candidate) => {
          const entry = entrySchema.safeParse(candidate);
          return entry.success ? [normalizeEntry(entry.data)] : [];
        });
        const missionNote = parsed.data.missionNote?.trim() ?? "";
        return {
          mode: parsed.data.mode,
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
