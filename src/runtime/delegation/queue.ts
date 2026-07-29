import type {
  DelegationQueue,
  DelegationQueueStore,
  QueueEntry,
  QueueIdentity,
  QueueSnapshot,
  QueueTransition,
} from "./types";

export function queueKey(identity: QueueIdentity): string {
  return JSON.stringify([
    identity.provider,
    identity.kind,
    identity.repository,
    identity.itemId,
  ]);
}

function freezeEntry(entry: QueueEntry): QueueEntry {
  const changedFields = entry.changedFields
    ? Object.freeze([...entry.changedFields])
    : undefined;
  return Object.freeze({
    ...entry,
    identity: Object.freeze({ ...entry.identity }),
    ...(changedFields ? { changedFields } : {}),
  });
}

function withSelection(entry: QueueEntry, selected: boolean): QueueEntry {
  if (!selected || entry.status !== "transferred") {
    return { ...entry, selected };
  }
  const { transferredAt: _transferredAt, ...ready } = entry;
  return { ...ready, selected: true, status: "queued" };
}

export function createDelegationQueue(
  store?: DelegationQueueStore,
): DelegationQueue {
  const entries = new Map<string, QueueEntry>();
  for (const entry of store?.load() ?? []) {
    entries.set(queueKey(entry.identity), freezeEntry(entry));
  }
  const listeners = new Set<(snapshot: QueueSnapshot) => void>();

  const serialized = (): readonly QueueEntry[] =>
    Object.freeze([...entries.values()].map(freezeEntry));
  const snapshot = (): QueueSnapshot => {
    const current = serialized();
    return Object.freeze({
      entries: current,
      selectedCount: current.filter((entry) => entry.selected).length,
    });
  };
  const publish = () => {
    const current = snapshot();
    store?.save(current.entries);
    for (const listener of listeners) listener(current);
  };
  const replace = (key: string, entry: QueueEntry): boolean => {
    if (!entries.has(key)) return false;
    entries.set(key, freezeEntry(entry));
    publish();
    return true;
  };
  const transitioned = (
    key: string,
    transition: QueueTransition,
  ): boolean => {
    const entry = entries.get(key);
    if (!entry) return false;
    const transferredAt = transition.transferredAt === undefined
      ? entry.transferredAt
      : transition.transferredAt;
    const {
      transferredAt: _previousTransferredAt,
      ...entryWithoutTransferredAt
    } = entry;
    entries.set(key, freezeEntry({
      ...entryWithoutTransferredAt,
      status: transition.status,
      selected: transition.selected ?? entry.selected,
      ...(transition.reason === undefined
        ? {}
        : { reason: transition.reason }),
      ...(transition.changedFields === undefined
        ? {}
        : { changedFields: transition.changedFields }),
      ...(transferredAt === null || transferredAt === undefined
        ? {}
        : { transferredAt }),
    }));
    return true;
  };

  return {
    add(identity, selectedAt) {
      const key = queueKey(identity);
      if (entries.has(key)) return false;
      entries.set(key, freezeEntry({
        identity,
        selectedAt,
        selected: true,
        status: "queued",
      }));
      publish();
      return true;
    },
    addMany(identities, selectedAt) {
      let added = 0;
      for (const identity of identities) {
        const key = queueKey(identity);
        if (entries.has(key)) continue;
        entries.set(key, freezeEntry({
          identity,
          selectedAt,
          selected: true,
          status: "queued",
        }));
        added += 1;
      }
      if (added > 0) publish();
      return added;
    },
    setSelectedMany(identities, selected, selectedAt) {
      let changed = 0;
      const visited = new Set<string>();
      for (const identity of identities) {
        const key = queueKey(identity);
        if (visited.has(key)) continue;
        visited.add(key);
        const entry = entries.get(key);
        if (entry) {
          if (entry.selected === selected) continue;
          entries.set(key, freezeEntry(withSelection(entry, selected)));
          changed += 1;
          continue;
        }
        if (!selected) continue;
        entries.set(key, freezeEntry({
          identity,
          selectedAt,
          selected: true,
          status: "queued",
        }));
        changed += 1;
      }
      if (changed > 0) publish();
      return changed;
    },
    remove(key) {
      const removed = entries.delete(key);
      if (removed) publish();
      return removed;
    },
    setSelected(key, selected) {
      const entry = entries.get(key);
      if (!entry || entry.selected === selected) return false;
      return replace(key, withSelection(entry, selected));
    },
    transition(key, transition: QueueTransition) {
      const changed = transitioned(key, transition);
      if (changed) publish();
      return changed;
    },
    transitionMany(transitions) {
      let changed = 0;
      for (const { key, transition } of transitions) {
        if (transitioned(key, transition)) changed += 1;
      }
      if (changed > 0) publish();
      return changed;
    },
    markTransferred(keys, transferredAt) {
      let changed = 0;
      for (const key of new Set(keys)) {
        const entry = entries.get(key);
        if (!entry) continue;
        entries.set(key, freezeEntry({
          ...entry,
          selected: false,
          status: "transferred",
          transferredAt,
        }));
        changed += 1;
      }
      if (changed > 0) publish();
      return changed;
    },
    snapshot,
    serialize: serialized,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
