import { checkSafeValue } from "./validator";
import { queueKey } from "./queue";
import type {
  HandoffQueueEntry,
  HandoffQueueRevalidationTransition,
  RevalidateHandoffQueueInput,
  RevalidationResult,
} from "./types";

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonical(nested)]),
    );
  }
  return value;
}

export function fingerprintProjectedTarget(value: unknown): string {
  return JSON.stringify(canonical(value));
}

function changedTopLevelFields(
  before: unknown,
  after: unknown,
): string[] {
  const left = before && typeof before === "object" && !Array.isArray(before)
    ? before as Record<string, unknown>
    : {};
  const right = after && typeof after === "object" && !Array.isArray(after)
    ? after as Record<string, unknown>
    : {};
  return [...new Set([...Object.keys(left), ...Object.keys(right)])]
    .filter((key) =>
      fingerprintProjectedTarget(left[key])
      !== fingerprintProjectedTarget(right[key]))
    .sort();
}

function sliceKey(target: string, kind: string): string {
  return JSON.stringify([target, kind]);
}

function unavailable(
  entry: HandoffQueueEntry,
  reason: string,
): HandoffQueueRevalidationTransition {
  return {
    key: queueKey(entry.identity),
    itemId: entry.identity.itemId,
    status: "unavailable",
    selected: true,
    reason,
  };
}

export async function revalidateHandoffQueue(
  input: RevalidateHandoffQueueInput,
): Promise<RevalidationResult> {
  const selected = input.entries.filter((entry) => entry.selected);
  input.onChecking?.(selected);
  if (!input.session) {
    return {
      transitions: selected.map((entry) =>
        unavailable(entry, "Provider Connection is unavailable")),
    };
  }

  const targets = [...new Set(
    selected.map((entry) => entry.identity.repository),
  )];
  const kinds = [...new Set(
    selected.map((entry) => entry.identity.kind),
  )];
  const beforeItems = new Map(
    input.before.items.map((item) => [item.id, item]),
  );
  const report = await input.session.refresh({ targets, kinds });
  const after = input.session.snapshot();
  const afterItems = new Map(after.items.map((item) => [item.id, item]));
  const refreshed = new Set(
    report.refreshed.map((slice) => sliceKey(slice.target, slice.kind)),
  );
  const retainedStale = new Set(
    report.retainedStale.map((slice) =>
      sliceKey(slice.target, slice.kind)),
  );
  const failed = new Set(
    report.failures
      .filter((failure) => failure.target && failure.kind)
      .map((failure) => sliceKey(failure.target!, failure.kind!)),
  );
  const transitions: HandoffQueueRevalidationTransition[] = [];

  for (const entry of selected) {
    const key = queueKey(entry.identity);
    const identity = entry.identity;
    const slice = sliceKey(identity.repository, identity.kind);
    if (retainedStale.has(slice) || failed.has(slice)) {
      transitions.push(unavailable(
        entry,
        "Refresh failed; retained stale context remains selected",
      ));
      continue;
    }
    if (!refreshed.has(slice)) {
      transitions.push(unavailable(
        entry,
        report.status === "paused"
          ? "Refresh is paused"
          : "Slice was not successfully refreshed",
      ));
      continue;
    }
    const currentItem = afterItems.get(identity.itemId);
    if (!currentItem) {
      transitions.push({
        key,
        itemId: identity.itemId,
        status: "resolved",
        selected: false,
        reason: "No longer present after a successful slice refresh",
      });
      continue;
    }
    try {
      const projected = input.project(currentItem);
      const unsafe: { field: string; message: string }[] = [];
      checkSafeValue(projected, "target", unsafe);
      if (unsafe.length) {
        const first = unsafe[0];
        transitions.push({
          key,
          itemId: identity.itemId,
          status: "blocked",
          selected: true,
          reason: `${first.field}: ${first.message}`,
        });
        continue;
      }
      const beforeItem = beforeItems.get(identity.itemId);
      const beforeProjected = beforeItem
        ? input.project(beforeItem)
        : {};
      const beforeFingerprint = fingerprintProjectedTarget(beforeProjected);
      const currentFingerprint = fingerprintProjectedTarget(projected);
      if (beforeFingerprint === currentFingerprint) {
        transitions.push({
          key,
          itemId: identity.itemId,
          status: "current",
          selected: true,
        });
      } else {
        transitions.push({
          key,
          itemId: identity.itemId,
          status: "changed",
          selected: true,
          changedFields: changedTopLevelFields(beforeProjected, projected),
        });
      }
    } catch (error) {
      transitions.push({
        key,
        itemId: identity.itemId,
        status: "blocked",
        selected: true,
        reason: error instanceof Error
          ? error.message
          : "Target projection failed",
      });
    }
  }
  return { transitions };
}
