import type { RuntimeCatalog } from "../catalog/types";
import type { FocusPolicySnapshot } from "../focus/types";
import type { HandoffValueV1, TransportResult } from "../handoff/types";
import type { ScoreExplanation } from "../scoring/score-model";
import type { ScoredItem } from "../layout/table/kind-renderer";
import { planPackages } from "./planner";
import { projectDelegationTarget } from "./projector";
import {
  renderBundleMarkdown,
  renderPackageMarkdown,
} from "./markdown";
import { validateDelegationBundle } from "./validator";
import { queueKey } from "./queue";
import type {
  DelegationBundleV1,
  DelegationController,
  DelegationControllerSnapshot,
  DelegationQueue,
  DelegationValidationError,
  RevalidationResult,
  WorkPackageV1,
} from "./types";

export interface DelegationControllerDeps {
  readonly queue: DelegationQueue;
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
  readonly revalidateQueue?: () => Promise<RevalidationResult>;
}

interface Projection {
  readonly bundle: DelegationBundleV1;
  readonly remainingPackages: number;
  readonly errors: readonly DelegationValidationError[];
}

export function createDelegationController(
  deps: DelegationControllerDeps,
): DelegationController {
  const clock = deps.clock ?? (() => new Date());
  const listeners = new Set<
    (snapshot: DelegationControllerSnapshot) => void
  >();
  const intentEdits = new Map<
    string,
    Partial<WorkPackageV1["intent"]>
  >();
  let isOpen = false;
  let lastError: string | null = null;
  let countAllRemainingPackages = false;

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
      && entry.status !== "blocked");
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
    const plan = planPackages({
      items: selectedItems,
      repositoryOrder: focus.repositoryOrder,
      includeLabels: focus.labels.include,
      excludeLabels: focus.labels.exclude,
    });
    const projectionErrors: DelegationValidationError[] = [];
    const packages: WorkPackageV1[] = plan.transfer.map(
      (planned, index) => {
        const edit = intentEdits.get(planned.id);
        const intent = {
          ...planned.intent,
          ...edit,
          constraints: edit?.constraints ?? planned.intent.constraints,
          verification: edit?.verification ?? planned.intent.verification,
        };
      const targets = planned.targets.flatMap((item) => {
        try {
          const projected = projectDelegationTarget({
            item,
            explanation: deps.scoreExplain(item),
            catalog: deps.catalog,
          });
          const entry = selected.find(
            (candidate) => candidate.identity.itemId === item.id,
          );
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
          intent,
          targets,
          selectionReason: planned.selectionReason,
        };
      },
    );
    const bundle: DelegationBundleV1 = {
      schema: "triagekit.delegation-bundle",
      version: 1,
      createdAt: clock().toISOString(),
      focus: {
        provider: focus.provider,
        repositoryOrder: focus.repositoryOrder,
        includeLabels: focus.labels.include,
        excludeLabels: focus.labels.exclude,
      },
      instructions: {
        processPackagesInOrder: true,
        generatedFrom: "explicit-session-queue",
      },
      packages,
    };
    const validation = validateDelegationBundle(bundle);
    const validationErrors = validation.valid ? [] : validation.errors;
    return {
      bundle,
      remainingPackages: countAllRemainingPackages
        ? plan.transfer.length + plan.remaining.length
        : plan.remainingPackages,
      errors: [...projectionErrors, ...validationErrors],
    };
  };

  function snapshot(): DelegationControllerSnapshot {
    const built = projection();
    const queue = deps.queue.snapshot();
    const previewMarkdown = built.bundle.packages.length
      ? renderBundleMarkdown(built.bundle)
      : "";
    return Object.freeze({
      open: isOpen,
      selectedCount: queue.selectedCount,
      retainedCount: queue.entries.length,
      remainingPackages: built.remainingPackages,
      packages: built.bundle.packages,
      errors: built.errors,
      previewMarkdown,
      canDownload: built.bundle.packages.length > 0,
      error: lastError,
    });
  }

  const keysForPackage = (pkg: WorkPackageV1): string[] => {
    const ids = new Set(pkg.targets.map((target) => target.id));
    return deps.queue.snapshot().entries
      .filter((entry) => ids.has(entry.identity.itemId))
      .map((entry) => queueKey(entry.identity));
  };

  const transferBundle = async (
    bundle: DelegationBundleV1,
    markdown: string,
  ): Promise<TransportResult> => {
    const validation = validateDelegationBundle(bundle);
    if (!validation.valid) {
      lastError = "Fix package validation errors before transfer";
      publish();
      return { ok: false, error: lastError };
    }
    try {
      await deps.clipboard.writeText(markdown);
      lastError = null;
      countAllRemainingPackages = true;
      deps.queue.markTransferred(
        bundle.packages.flatMap(keysForPackage),
        clock().getTime(),
      );
      publish();
      return { ok: true };
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Clipboard failed";
      publish();
      return { ok: false, error: lastError };
    }
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
    updateIntent(packageId, intent) {
      intentEdits.set(packageId, {
        ...intentEdits.get(packageId),
        ...intent,
      });
      publish();
    },
    removeTarget(itemId) {
      const entry = deps.queue.snapshot().entries.find((candidate) =>
        candidate.identity.itemId === itemId);
      if (entry) deps.queue.setSelected(queueKey(entry.identity), false);
    },
    async revalidate() {
      const selected = deps.queue.snapshot().entries
        .filter((entry) => entry.selected);
      for (const entry of selected) {
        deps.queue.transition(queueKey(entry.identity), {
          status: "checking",
          selected: true,
        });
      }
      if (!deps.revalidateQueue) return;
      const result = await deps.revalidateQueue();
      for (const transition of result.transitions) {
        deps.queue.transition(transition.key, {
          status: transition.status,
          selected: transition.selected,
          reason: transition.reason,
          changedFields: transition.changedFields,
        });
      }
    },
    async copyBundle() {
      const built = projection();
      return transferBundle(
        built.bundle,
        renderBundleMarkdown(built.bundle),
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
        renderPackageMarkdown(single, single.packages[0]),
      );
    },
    downloadBundle(format = "md") {
      const built = projection();
      const validation = validateDelegationBundle(built.bundle);
      if (!validation.valid) {
        return {
          ok: false,
          error: "Fix package validation errors before transfer",
        };
      }
      const result = format === "json"
        ? deps.downloads.json(
          "triagekit-delegation-bundle.json",
          built.bundle,
        )
        : deps.downloads.text(
          "triagekit-delegation-bundle.md",
          renderBundleMarkdown(built.bundle),
          "text/markdown",
        );
      if (result.ok) {
        countAllRemainingPackages = true;
        deps.queue.markTransferred(
          built.bundle.packages.flatMap(keysForPackage),
          clock().getTime(),
        );
      }
      return result;
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
      const result = format === "json"
        ? deps.downloads.json(`triagekit-${pkg.id}.json`, single)
        : deps.downloads.text(
          `triagekit-${pkg.id}.md`,
          renderPackageMarkdown(single, single.packages[0]),
          "text/markdown",
        );
      if (result.ok) {
        deps.queue.markTransferred(keysForPackage(pkg), clock().getTime());
      }
      return result;
    },
  };
}
