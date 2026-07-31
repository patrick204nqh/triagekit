import type { RuntimeCatalog } from "../catalog/types";
import type { FocusPolicySnapshot } from "../focus/types";
import type { HandoffValueV1, TransportResult } from "./types";
import {
  IMPLEMENT_BOUNDARY,
  INVESTIGATE_BOUNDARY,
} from "./intent";
import type { ScoreExplanation } from "../scoring/score-model";
import type { ScoredItem } from "../layout/table/kind-renderer";
import { planHandoffPackages } from "./planner";
import { projectHandoffTarget } from "./projector";
import {
  renderHandoffBundleMarkdown,
  renderHandoffPackageMarkdown,
} from "./markdown";
import { validateHandoffBundle } from "./validator";
import { queueKey } from "./queue";
import type {
  HandoffBundleV1,
  HandoffController,
  HandoffControllerSnapshot,
  HandoffQueue,
  HandoffValidationError,
  HandoffQueueStatus,
  RevalidationResult,
  HandoffPackageV1,
} from "./types";

export interface HandoffControllerDeps {
  readonly queue: HandoffQueue;
  readonly items: () => readonly ScoredItem[];
  readonly focusPolicy: () => FocusPolicySnapshot;
  readonly catalog: RuntimeCatalog;
  readonly scoreExplain: (item: ScoredItem) => ScoreExplanation | null;
  readonly clock?: () => Date;
  readonly clipboard: { writeText(text: string): Promise<void> };
  readonly downloads: {
    text(filename: string, text: string, mime: string): TransportResult;
    json(filename: string, value: unknown): TransportResult;
  };
  readonly revalidateHandoffQueue?: () => Promise<RevalidationResult>;
}

interface Projection {
  readonly bundle: HandoffBundleV1;
  readonly remainingPackages: number;
  readonly errors: readonly HandoffValidationError[];
}

export function createHandoffController(
  deps: HandoffControllerDeps,
): HandoffController {
  const clock = deps.clock ?? (() => new Date());
  const listeners = new Set<
    (snapshot: HandoffControllerSnapshot) => void
  >();
  let isOpen = false;
  let lastError: string | null = null;
  let lastNotice: HandoffControllerSnapshot["notice"] = null;
  let pendingTransferKeys: string[] = [];
  let pendingConfirmation:
    HandoffControllerSnapshot["pendingConfirmation"] = null;
  let lastHandoffUndo: {
    readonly key: string;
    readonly status: HandoffQueueStatus;
    readonly selected: boolean;
  }[] = [];
  let busyAction: HandoffControllerSnapshot["busyAction"] = null;

  const publish = () => {
    const current = snapshot();
    for (const listener of listeners) listener(current);
  };
  deps.queue.subscribe(() => publish());

  const projection = (): Projection => {
    const queueSnapshot = deps.queue.snapshot();
    const selected = queueSnapshot.entries.filter((entry) =>
      entry.selected
      && entry.status !== "resolved"
      && entry.status !== "transferred"
      && entry.status !== "blocked"
      && entry.status !== "unavailable");
    const selectedKeys = new Set(selected.map((entry) =>
      queueKey(entry.identity)));
    const selectedItems = deps.items().filter((item) =>
      selectedKeys.has(queueKey({
        provider: item.provider,
        itemId: item.id,
        kind: item.kind,
        repository: item.location,
      })));
    const focus = deps.focusPolicy();
    const plan = planHandoffPackages({
      items: selectedItems,
      repositoryOrder: focus.repositoryOrder,
      mode: queueSnapshot.mode,
      includeLabels: focus.labels.include,
      excludeLabels: focus.labels.exclude,
    });
    const projectionErrors: HandoffValidationError[] = [];
    const packages: HandoffPackageV1[] = plan.transfer.map(
      (planned, index) => {
      const targets = planned.targets.flatMap((item) => {
        try {
          const entry = selected.find(
            (candidate) => candidate.identity.itemId === item.id,
          );
          const projected = projectHandoffTarget({
            item,
            explanation: deps.scoreExplain(item),
            catalog: deps.catalog,
            ...(entry?.note ? { note: entry.note } : {}),
          });
          const queueDetails: Record<string, HandoffValueV1> | undefined =
            entry
              ? {
                  status: entry.status,
                  ...(entry.reason ? { reason: entry.reason } : {}),
                  ...(entry.changedFields?.length
                    ? { changedFields: entry.changedFields }
                    : {}),
                }
              : undefined;
          return [{
            ...projected,
            details: {
              ...projected.details,
              ...(queueDetails ? { queue: queueDetails } : {}),
            },
          }];
        } catch (error) {
            projectionErrors.push({
              packageId: planned.id,
              field: `targets.${item.id}`,
              message: error instanceof Error
                ? error.message
                : "Target projection failed",
            });
            return [];
          }
        });
        return {
          id: planned.id,
          order: index + 1,
          repository: planned.repository,
          kind: planned.kind,
          generatedIntent: planned.generatedIntent,
          targets,
          selectionReason: planned.selectionReason,
        };
      },
    );
    const bundle: HandoffBundleV1 = {
      schema: "triagekit.handoff-bundle",
      version: 1,
      createdAt: clock().toISOString(),
      focus: {
        provider: focus.provider,
        repositoryOrder: focus.repositoryOrder,
        includeLabels: focus.labels.include,
        excludeLabels: focus.labels.exclude,
      },
      instructions: {
        mode: queueSnapshot.mode,
        ...(queueSnapshot.missionNote
          ? { missionNote: queueSnapshot.missionNote }
          : {}),
        generatedBoundary: queueSnapshot.mode === "investigate"
          ? INVESTIGATE_BOUNDARY
          : IMPLEMENT_BOUNDARY,
        processPackagesInOrder: true,
        generatedFrom: "explicit-session-queue",
      },
      packages,
    };
    const validation = validateHandoffBundle(bundle);
    const validationErrors = validation.valid ? [] : validation.errors;
    return {
      bundle,
      remainingPackages: plan.remainingPackages,
      errors: [...projectionErrors, ...validationErrors],
    };
  };

  function snapshot(): HandoffControllerSnapshot {
    const built = projection();
    const queue = deps.queue.snapshot();
    const itemsById = new Map(deps.items().map((item) => [item.id, item]));
    const summarize = (
      entry: (typeof queue.entries)[number],
    ) => ({
      key: queueKey(entry.identity),
      itemId: entry.identity.itemId,
      title: itemsById.get(entry.identity.itemId)?.title
        ?? entry.identity.itemId,
      repository: entry.identity.repository,
      kind: entry.identity.kind,
      status: entry.status,
      ...(entry.reason ? { reason: entry.reason } : {}),
      ...(entry.transferredAt === undefined
        ? {}
        : { transferredAt: entry.transferredAt }),
    });
    const previewMarkdown = built.bundle.packages.length
      ? renderHandoffBundleMarkdown(built.bundle)
      : "";
    return Object.freeze({
      open: isOpen,
      mode: queue.mode,
      ...(queue.missionNote ? { missionNote: queue.missionNote } : {}),
      selectedCount: queue.selectedCount,
      retainedCount: queue.entries.length,
      remainingPackages: built.remainingPackages,
      packages: built.bundle.packages,
      errors: built.errors,
      previewMarkdown,
      canDownload: built.bundle.packages.length > 0
        && built.errors.length === 0,
      error: lastError,
      notice: lastNotice,
      pendingConfirmation,
      canUndoHandoff: lastHandoffUndo.length > 0,
      busyAction,
      notInNextBundle: queue.entries
        .filter((entry) =>
          entry.status === "resolved"
          || (entry.selected
            && (entry.status === "blocked"
              || entry.status === "unavailable")))
        .map(summarize),
      handedOff: queue.entries
        .filter((entry) => entry.status === "transferred")
        .map(summarize),
    });
  }

  const keysForPackage = (pkg: HandoffPackageV1): string[] => {
    const ids = new Set(pkg.targets.map((target) => target.id));
    return deps.queue.snapshot().entries
      .filter((entry) => ids.has(entry.identity.itemId))
      .map((entry) => queueKey(entry.identity));
  };

  const transferBundle = async (
    bundle: HandoffBundleV1,
    markdown: string,
  ): Promise<TransportResult> => {
    const validation = validateHandoffBundle(bundle);
    if (!validation.valid) {
      lastError = "Fix package validation errors before transfer";
      lastNotice = { tone: "error", message: lastError };
      publish();
      return { ok: false, error: lastError };
    }
    if (busyAction === "copy") {
      return { ok: false, error: "Copy already in progress" };
    }
    busyAction = "copy";
    lastError = null;
    lastNotice = { tone: "info", message: "Copying bundle…" };
    publish();
    try {
      await deps.clipboard.writeText(markdown);
      busyAction = null;
      lastError = null;
      pendingTransferKeys = bundle.packages.flatMap(keysForPackage);
      const targetCount = bundle.packages.reduce(
        (total, pkg) => total + pkg.targets.length,
        0,
      );
      pendingConfirmation = {
        packageCount: bundle.packages.length,
        targetCount,
      };
      lastNotice = {
        tone: "success",
        message: `Copied ${bundle.packages.length} ${bundle.packages.length === 1 ? "package" : "packages"} · ${targetCount} ${targetCount === 1 ? "target" : "targets"} · queue unchanged`,
      };
      publish();
      return { ok: true };
    } catch (error) {
      busyAction = null;
      lastError = error instanceof Error ? error.message : "Clipboard failed";
      lastNotice = { tone: "error", message: lastError };
      pendingTransferKeys = [];
      pendingConfirmation = null;
      publish();
      return { ok: false, error: lastError };
    }
  };

  const recordDownload = (
    bundle: HandoffBundleV1,
    result: TransportResult,
  ): TransportResult => {
    if (!result.ok) {
      lastError = result.error ?? "Download failed";
      lastNotice = { tone: "error", message: lastError };
      pendingTransferKeys = [];
      pendingConfirmation = null;
      publish();
      return result;
    }
    const targetCount = bundle.packages.reduce(
      (total, pkg) => total + pkg.targets.length,
      0,
    );
    lastError = null;
    pendingTransferKeys = bundle.packages.flatMap(keysForPackage);
    pendingConfirmation = {
      packageCount: bundle.packages.length,
      targetCount,
    };
    lastNotice = {
      tone: "success",
      message: `Downloaded ${bundle.packages.length} ${bundle.packages.length === 1 ? "package" : "packages"} · ${targetCount} ${targetCount === 1 ? "target" : "targets"} · queue unchanged`,
    };
    publish();
    return result;
  };

  return {
    snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    open() {
      isOpen = true;
      publish();
    },
    close() {
      isOpen = false;
      publish();
    },
    setMode(mode) {
      deps.queue.setMode(mode);
    },
    setMissionNote(note) {
      deps.queue.setMissionNote(note);
    },
    setItemNote(itemId, note) {
      const entry = deps.queue.snapshot().entries.find((candidate) =>
        candidate.identity.itemId === itemId);
      if (entry) {
        deps.queue.setItemNote(queueKey(entry.identity), note);
      }
    },
    removeTarget(itemId) {
      const entry = deps.queue.snapshot().entries.find((candidate) =>
        candidate.identity.itemId === itemId);
      if (entry) deps.queue.setSelected(queueKey(entry.identity), false);
    },
    removeQueueItem(key) {
      return deps.queue.remove(key);
    },
    async revalidate() {
      const selected = deps.queue.snapshot().entries
        .filter((entry) => entry.selected);
      if (busyAction === "revalidate" || !selected.length) return;
      const previous = selected.map((entry) => ({
        key: queueKey(entry.identity),
        status: entry.status,
        selected: entry.selected,
      }));
      busyAction = "revalidate";
      lastError = null;
      lastNotice = {
        tone: "info",
        message: `Checking ${selected.length} ${selected.length === 1 ? "target" : "targets"}…`,
      };
      deps.queue.transitionMany(selected.map((entry) => ({
        key: queueKey(entry.identity),
        transition: {
          status: "checking",
          selected: true,
        },
      })));
      try {
        if (!deps.revalidateHandoffQueue) {
          throw new Error("Target checking is unavailable");
        }
        const result = await deps.revalidateHandoffQueue();
        busyAction = null;
        lastNotice = {
          tone: "success",
          message: `Checked ${result.transitions.length} ${result.transitions.length === 1 ? "target" : "targets"}`,
        };
        deps.queue.transitionMany(result.transitions.map((transition) => ({
          key: transition.key,
          transition: {
            status: transition.status,
            selected: transition.selected,
            reason: transition.reason,
            changedFields: transition.changedFields,
          },
        })));
      } catch (error) {
        busyAction = null;
        const message = error instanceof Error
          ? error.message
          : "Target checking failed";
        lastError = message;
        lastNotice = {
          tone: "error",
          message: `Could not check targets: ${message}`,
        };
        deps.queue.transitionMany(previous.map((entry) => ({
          key: entry.key,
          transition: {
            status: entry.status,
            selected: entry.selected,
          },
        })));
      }
    },
    async copyBundle() {
      const built = projection();
      return transferBundle(
        built.bundle,
        renderHandoffBundleMarkdown(built.bundle),
      );
    },
    async copyPackage(packageId) {
      const built = projection();
      const pkg = built.bundle.packages.find((candidate) =>
        candidate.id === packageId);
      if (!pkg) return { ok: false, error: "Package not found" };
      const single = {
        ...built.bundle,
        packages: [{ ...pkg, order: 1 }],
      };
      return transferBundle(
        single,
        renderHandoffPackageMarkdown(single, single.packages[0]),
      );
    },
    confirmHandoff() {
      if (!pendingTransferKeys.length || !pendingConfirmation) return false;
      const pending = new Set(pendingTransferKeys);
      lastHandoffUndo = deps.queue.snapshot().entries
        .filter((entry) => pending.has(queueKey(entry.identity)))
        .map((entry) => ({
          key: queueKey(entry.identity),
          status: entry.status,
          selected: entry.selected,
        }));
      const targetCount = pendingConfirmation.targetCount;
      pendingTransferKeys = [];
      pendingConfirmation = null;
      lastNotice = {
        tone: "success",
        message: `Marked ${targetCount} ${targetCount === 1 ? "target" : "targets"} handed off`,
      };
      return deps.queue.markTransferred(
        lastHandoffUndo.map((entry) => entry.key),
        clock().getTime(),
      ) > 0;
    },
    undoHandoff() {
      if (!lastHandoffUndo.length) return false;
      const undo = lastHandoffUndo;
      lastHandoffUndo = [];
      lastNotice = {
        tone: "info",
        message: `Restored ${undo.length} ${undo.length === 1 ? "target" : "targets"} to Ready`,
      };
      return deps.queue.transitionMany(undo.map((entry) => ({
        key: entry.key,
        transition: {
          status: entry.status,
          selected: entry.selected,
          transferredAt: null,
        },
      }))) > 0;
    },
    downloadBundle(format = "md") {
      const built = projection();
      const validation = validateHandoffBundle(built.bundle);
      if (!validation.valid) {
        return recordDownload(built.bundle, {
          ok: false,
          error: "Fix package validation errors before transfer",
        });
      }
      const result = format === "json"
        ? deps.downloads.json(
          "triagekit-handoff-bundle.json",
          built.bundle,
        )
        : deps.downloads.text(
          "triagekit-handoff-bundle.md",
          renderHandoffBundleMarkdown(built.bundle),
          "text/markdown",
        );
      return recordDownload(built.bundle, result);
    },
    downloadPackage(packageId, format = "md") {
      const built = projection();
      const pkg = built.bundle.packages.find((candidate) =>
        candidate.id === packageId);
      if (!pkg) return { ok: false, error: "Package not found" };
      const single = {
        ...built.bundle,
        packages: [{ ...pkg, order: 1 }],
      };
      const validation = validateHandoffBundle(single);
      if (!validation.valid) {
        return recordDownload(single, {
          ok: false,
          error: "Fix package validation errors before transfer",
        });
      }
      const result = format === "json"
        ? deps.downloads.json(`triagekit-${pkg.id}.json`, single)
        : deps.downloads.text(
          `triagekit-${pkg.id}.md`,
          renderHandoffPackageMarkdown(single, single.packages[0]),
          "text/markdown",
        );
      return recordDownload(single, result);
    },
  };
}
