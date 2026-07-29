import type { ScoredItem } from "../layout/table/kind-renderer";
import type { ListState } from "../layout/toolbar/filter-state";
import type { FocusPolicySnapshot, LabelRules } from "./types";

const TIER_ORDER = { P0: 0, P1: 1, P2: 2, P3: 3 } as const;

function normalizeStrings(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function normalizeLabelRules(rules: LabelRules): LabelRules {
  return {
    include: normalizeStrings(rules.include),
    exclude: normalizeStrings(rules.exclude),
    enabled: rules.enabled,
  };
}

export function reconcileRepositoryOrder(
  savedOrder: readonly string[],
  activeRepositories: readonly string[],
): { saved: string[]; active: string[] } {
  const saved = normalizeStrings(savedOrder);
  const activeSet = new Set(normalizeStrings(activeRepositories));
  for (const repository of activeSet) {
    if (!saved.includes(repository)) saved.push(repository);
  }
  return {
    saved,
    active: saved.filter((repository) => activeSet.has(repository)),
  };
}

export function moveRepository(
  repositoryOrder: readonly string[],
  repository: string,
  targetIndex: number,
): string[] {
  const next = normalizeStrings(repositoryOrder);
  const currentIndex = next.indexOf(repository.trim());
  if (currentIndex < 0) return next;
  const [moved] = next.splice(currentIndex, 1);
  const boundedIndex = Math.max(0, Math.min(targetIndex, next.length));
  next.splice(boundedIndex, 0, moved);
  return next;
}

export function matchesLabelRules(
  labels: readonly string[],
  rules: LabelRules,
): boolean {
  if (!rules.enabled) return true;
  const present = new Set(labels);
  const normalized = normalizeLabelRules(rules);
  if (normalized.exclude.some((label) => present.has(label))) return false;
  return normalized.include.length === 0
    || normalized.include.some((label) => present.has(label));
}

export function compareFocusedItems(
  repositoryOrder: readonly string[],
): (left: ScoredItem, right: ScoredItem) => number {
  const ranks = new Map(
    normalizeStrings(repositoryOrder).map((repository, index) => [
      repository,
      index,
    ]),
  );
  const unknownRank = ranks.size;
  return (left, right) =>
    (ranks.get(left.location) ?? unknownRank)
    - (ranks.get(right.location) ?? unknownRank)
    || TIER_ORDER[left.tier] - TIER_ORDER[right.tier]
    || right.score - left.score
    || left.id.localeCompare(right.id);
}

export function migrateLegacyLabels(
  listState: ListState,
  policy: FocusPolicySnapshot,
): { policy: FocusPolicySnapshot; listState: ListState } {
  const { labels: legacyLabels, ...axes } = listState.axes;
  if (
    !legacyLabels?.length
    || policy.labels.include.length > 0
    || policy.labels.exclude.length > 0
  ) {
    return {
      policy,
      listState: legacyLabels
        ? { ...listState, axes }
        : listState,
    };
  }
  return {
    policy: {
      ...policy,
      labels: {
        include: normalizeStrings(legacyLabels),
        exclude: [],
        enabled: true,
      },
    },
    listState: { ...listState, axes },
  };
}
