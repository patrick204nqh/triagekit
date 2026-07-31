import { generatedIntentFor } from "./intent";
import type { ScoredItem } from "../layout/table/kind-renderer";
import type {
  HandoffPlanPackagesInput,
  PlannedHandoffPackage,
  HandoffPlanResult,
} from "./types";

const TIER_ORDER = { P0: 0, P1: 1, P2: 2, P3: 3 } as const;
const PACKAGE_LIMIT = 5;
const TARGET_LIMIT = 10;

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function packageId(
  provider: string,
  repository: string,
  kind: string,
  targets: readonly ScoredItem[],
): string {
  const targetIds = targets.map((target) => target.id).sort();
  return `pkg-${stableHash(JSON.stringify([
    provider,
    repository,
    kind,
    targetIds,
  ]))}`;
}

function compareTargets(left: ScoredItem, right: ScoredItem): number {
  return TIER_ORDER[left.tier] - TIER_ORDER[right.tier]
    || right.score - left.score
    || left.id.localeCompare(right.id);
}

function selectionReason(
  repository: string,
  repositoryOrder: readonly string[],
  targets: readonly ScoredItem[],
  includeLabels: readonly string[],
  excludeLabels: readonly string[],
): string {
  const rank = repositoryOrder.indexOf(repository);
  const distribution = (["P0", "P1", "P2", "P3"] as const)
    .map((tier) => {
      const count = targets.filter((target) => target.tier === tier).length;
      return count ? `${tier} ${count}` : "";
    })
    .filter(Boolean)
    .join(", ");
  const labelFacts = [
    includeLabels.length
      ? `show labels ${includeLabels.join(", ")}`
      : "",
    excludeLabels.length
      ? `hide labels ${excludeLabels.join(", ")}`
      : "",
  ].filter(Boolean).join("; ");
  return [
    `Repository priority ${rank >= 0 ? rank + 1 : "unranked"}`,
    distribution || "No priority distribution",
    labelFacts,
  ].filter(Boolean).join(" · ");
}

export function planHandoffPackages(input: HandoffPlanPackagesInput): HandoffPlanResult {
  const repositoryRanks = new Map(
    input.repositoryOrder.map((repository, index) => [repository, index]),
  );
  const kindOrder = new Map<string, number>();
  const groups = new Map<string, ScoredItem[]>();
  for (const item of input.items) {
    const groupKey = JSON.stringify([
      item.provider,
      item.location,
      item.kind,
    ]);
    if (!kindOrder.has(groupKey)) kindOrder.set(groupKey, kindOrder.size);
    const group = groups.get(groupKey) ?? [];
    group.push(item);
    groups.set(groupKey, group);
  }

  const orderedGroups = [...groups.entries()].sort(
    ([leftKey, leftItems], [rightKey, rightItems]) => {
      const left = leftItems[0];
      const right = rightItems[0];
      const leftRank = repositoryRanks.get(left.location)
        ?? repositoryRanks.size;
      const rightRank = repositoryRanks.get(right.location)
        ?? repositoryRanks.size;
      return leftRank - rightRank
        || (leftRank === repositoryRanks.size
          ? left.location.localeCompare(right.location)
          : 0)
        || (kindOrder.get(leftKey) ?? 0) - (kindOrder.get(rightKey) ?? 0)
        || left.kind.localeCompare(right.kind);
    },
  );

  const packages: PlannedHandoffPackage[] = [];
  for (const [, group] of orderedGroups) {
    const targets = [...group].sort(compareTargets);
    for (let start = 0; start < targets.length; start += TARGET_LIMIT) {
      const chunk = targets.slice(start, start + TARGET_LIMIT);
      const first = chunk[0];
      const generatedIntent = generatedIntentFor(
        first.kind,
        input.mode ?? "investigate",
      );
      packages.push({
        id: packageId(
          first.provider,
          first.location,
          first.kind,
          chunk,
        ),
        provider: first.provider,
        repository: first.location,
        kind: first.kind,
        generatedIntent,
        targets: chunk,
        selectionReason: selectionReason(
          first.location,
          input.repositoryOrder,
          chunk,
          input.includeLabels ?? [],
          input.excludeLabels ?? [],
        ),
      });
    }
  }
  const transfer = packages.slice(0, PACKAGE_LIMIT);
  const remaining = packages.slice(PACKAGE_LIMIT);
  return {
    transfer,
    remaining,
    remainingPackages: remaining.length,
  };
}
