import { describe, expect, it } from "vitest";
import {
  planHandoffPackages,
} from "../../src/runtime/handoff/planner";
import type { ScoredItem } from "../../src/runtime/layout/table/kind-renderer";

const scoredItems = (
  repository: string,
  kind: ScoredItem["kind"],
  count: number,
): ScoredItem[] => Array.from({ length: count }, (_, index) => ({
  id: `${repository}:${kind}:${String(index).padStart(2, "0")}`,
  provider: "github",
  providerRef: { number: index + 1 },
  kind,
  title: `${kind} ${index + 1}`,
  location: repository,
  signal: 100 - index,
  createdAt: "2026-07-29T00:00:00.000Z",
  url: `https://example.test/${repository}/${kind}/${index + 1}`,
  details: {},
  score: 100 - index,
  tier: index < 2 ? "P0" : index < 6 ? "P1" : "P2",
}));

const input = (ids: string[]) => ({
  items: ids.map((id, index): ScoredItem => ({
    ...scoredItems("acme-corp/core", "issue", 1)[0],
    id,
    title: id,
    score: 50 - index,
  })),
  repositoryOrder: ["acme-corp/core"],
});

describe("handoff package planner", () => {
  it("groups by repository and Kind, chunks at ten, and returns five packages", () => {
    const result = planHandoffPackages({
      items: [
        ...scoredItems("acme-corp/core", "issue", 12),
        ...scoredItems("acme-corp/core", "change-request", 4),
        ...scoredItems("acme-corp/web", "issue", 35),
      ],
      repositoryOrder: ["acme-corp/core", "acme-corp/web"],
    });
    expect(result.transfer.map((pkg) => [
      pkg.repository,
      pkg.kind,
      pkg.targets.length,
    ])).toEqual([
      ["acme-corp/core", "issue", 10],
      ["acme-corp/core", "issue", 2],
      ["acme-corp/core", "change-request", 4],
      ["acme-corp/web", "issue", 10],
      ["acme-corp/web", "issue", 10],
    ]);
    expect(result.remainingPackages).toBe(2);
    expect(result.transfer.flatMap((pkg) => pkg.targets)).toHaveLength(36);
    expect(result.transfer[0].generatedIntent.constraints)
      .toContain("Do not modify files.");
  });

  it("creates stable IDs independent of input order", () => {
    const forward = planHandoffPackages(input(["a", "b"]));
    const reversed = planHandoffPackages(input(["b", "a"]));
    expect(forward.transfer.map((pkg) => pkg.id))
      .toEqual(reversed.transfer.map((pkg) => pkg.id));
  });

  it("orders package targets by P level, score, then stable identity", () => {
    const items = scoredItems("acme-corp/core", "issue", 3);
    items[0] = { ...items[0], id: "z", tier: "P1", score: 100 };
    items[1] = { ...items[1], id: "b", tier: "P0", score: 80 };
    items[2] = { ...items[2], id: "a", tier: "P0", score: 80 };
    expect(planHandoffPackages({
      items,
      repositoryOrder: ["acme-corp/core"],
      mode: "implement",
    }).transfer[0].targets.map((target) => target.id))
      .toEqual(["a", "b", "z"]);
    expect(planHandoffPackages({
      items,
      repositoryOrder: ["acme-corp/core"],
      mode: "implement",
    }).transfer[0].generatedIntent.outcome)
      .toBe("Implement the requested changes for the selected issues");
  });
});
