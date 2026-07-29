import { describe, expect, it } from "vitest";
import {
  compareFocusedItems,
  matchesLabelRules,
  moveRepository,
  reconcileRepositoryOrder,
} from "../../src/runtime/focus/policy";

describe("focus policy", () => {
  it("preserves inactive ranks, appends new repositories, and exposes active order", () => {
    expect(reconcileRepositoryOrder(
      ["acme-corp/core", "acme-corp/docs"],
      ["acme-corp/api", "acme-corp/core"],
    )).toEqual({
      saved: ["acme-corp/core", "acme-corp/docs", "acme-corp/api"],
      active: ["acme-corp/core", "acme-corp/api"],
    });
  });

  it("moves a repository without losing hidden ranks", () => {
    expect(moveRepository(
      ["acme-corp/core", "acme-corp/docs", "acme-corp/api"],
      "acme-corp/api",
      0,
    )).toEqual(["acme-corp/api", "acme-corp/core", "acme-corp/docs"]);
  });

  it("requires an included label and rejects any excluded label", () => {
    const rules = {
      include: ["security", "bug"],
      exclude: ["jira-ticket-created"],
      enabled: true,
    };
    expect(matchesLabelRules(["security"], rules)).toBe(true);
    expect(matchesLabelRules(["bug", "jira-ticket-created"], rules)).toBe(false);
    expect(matchesLabelRules(["docs"], rules)).toBe(false);
  });

  it("sorts by repository, P level, score, then identity", () => {
    const rank = ["acme-corp/core", "acme-corp/web"];
    const rows = [
      { id: "z", location: "acme-corp/web", tier: "P0", score: 100 },
      { id: "b", location: "acme-corp/core", tier: "P1", score: 80 },
      { id: "a", location: "acme-corp/core", tier: "P1", score: 80 },
    ] as any[];
    expect([...rows].sort(compareFocusedItems(rank)).map((row) => row.id))
      .toEqual(["a", "b", "z"]);
  });
});
