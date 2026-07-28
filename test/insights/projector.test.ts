import { describe, expect, it } from "vitest";
import { runtimeCatalog } from "../../src/runtime/catalog/built-in";
import type { TriageItem } from "../../src/runtime/dataset/item";
import { buildInsightSnapshot } from "../../src/runtime/insights/projector";
import { testCatalog } from "../support/test-catalog";
import { insightItem, scoreContextFixture } from "../support/insights";

const NOW = Date.parse("2026-07-28T00:00:00Z");

const baseInput = () => {
  const catalog = testCatalog();
  return {
    items: [] as TriageItem[],
    readyKinds: ["issue", "code-scanning"] as const,
    refreshedKinds: ["issue", "code-scanning"] as const,
    catalog,
    score: scoreContextFixture(catalog),
    botLogins: [] as string[],
    now: NOW,
  };
};

describe("buildInsightSnapshot", () => {
  it("aggregates priority across ready kinds", () => {
    const catalog = testCatalog();
    const snapshot = buildInsightSnapshot({
      items: [
        insightItem({
          id: "i1",
          kind: "issue",
          location: "acme-corp/web",
          signal: 170,
        }),
        insightItem({
          id: "s1",
          kind: "code-scanning",
          location: "acme-corp/api",
          signal: 140,
        }),
        insightItem({
          id: "i2",
          kind: "issue",
          location: "acme-corp/web",
          signal: 20,
        }),
        insightItem({
          id: "ignored",
          kind: "dependency-vuln",
          signal: 200,
        }),
      ],
      readyKinds: ["issue", "code-scanning"],
      refreshedKinds: ["issue", "code-scanning"],
      catalog,
      score: scoreContextFixture(catalog),
      botLogins: [],
      now: NOW,
    });

    expect(snapshot.totals).toEqual({
      all: 3,
      P0: 1,
      P1: 1,
      P2: 0,
      P3: 1,
    });
    expect(snapshot.attention.urgent).toBe(2);
  });

  it("orders concentration by severity before raw volume", () => {
    const snapshot = buildInsightSnapshot({
      ...baseInput(),
      items: [
        insightItem({
          id: "critical",
          location: "acme-corp/web",
          signal: 170,
        }),
        ...Array.from({ length: 4 }, (_, index) =>
          insightItem({
            id: `high-${index}`,
            location: "acme-corp/api",
            signal: 120,
          })),
      ],
    });

    expect(snapshot.concentrations.map((entry) => entry.location)).toEqual([
      "acme-corp/web",
      "acme-corp/api",
    ]);
    expect(snapshot.concentrations[0]).toMatchObject({
      total: 1,
      tiers: { P0: 1, P1: 0, P2: 0, P3: 0 },
    });
  });

  it("uses the injected clock for age bucket boundaries", () => {
    const daysAgo = (days: number) =>
      new Date(NOW - days * 86_400_000).toISOString();
    const snapshot = buildInsightSnapshot({
      ...baseInput(),
      items: [
        insightItem({ id: "new", createdAt: daysAgo(6) }),
        insightItem({ id: "week", createdAt: daysAgo(7) }),
        insightItem({ id: "month", createdAt: daysAgo(30) }),
        insightItem({ id: "quarter", createdAt: daysAgo(90) }),
        insightItem({ id: "old", createdAt: daysAgo(91), signal: 120 }),
      ],
    });

    expect(snapshot.age).toEqual({
      under7Days: 1,
      from7To30Days: 1,
      from30To90Days: 2,
      over90Days: 1,
      staleHighPriority: 1,
      oldestDays: 91,
    });
  });

  it("aggregates capabilities only across kinds that declare them", () => {
    const items = [
      insightItem({
        id: "dep-fix",
        kind: "dependency-vuln",
        details: {
          package: "demo-a",
          severity: "critical",
          cvss: 10,
          scope: "runtime",
          fixAvailable: true,
          fixVersion: "2.0.0",
        },
      }),
      insightItem({
        id: "dep-no-fix",
        kind: "dependency-vuln",
        details: {
          package: "demo-b",
          severity: "high",
          cvss: 8,
          scope: "runtime",
          fixAvailable: false,
          fixVersion: null,
        },
      }),
      insightItem({
        id: "owned-issue",
        kind: "issue",
        details: {
          number: 1,
          state: "open",
          body: "",
          author: { login: "reporter", avatarUrl: "", kind: "human" },
          assignees: [{ login: "dev", avatarUrl: "", kind: "human" }],
          reviewers: [],
          comments: 0,
          labels: [],
          checks: null,
          permalinks: [],
          relations: [],
        },
      }),
    ];

    const snapshot = buildInsightSnapshot({
      items,
      readyKinds: ["dependency-vuln", "issue"],
      refreshedKinds: ["dependency-vuln", "issue"],
      catalog: runtimeCatalog,
      score: scoreContextFixture(runtimeCatalog),
      botLogins: [],
      now: NOW,
    });

    expect(snapshot.actionability).toEqual({
      status: "available",
      numerator: 1,
      denominator: 2,
      ratio: 0.5,
    });
    expect(snapshot.ownership).toEqual({
      status: "available",
      numerator: 1,
      denominator: 1,
      ratio: 1,
    });
    expect(snapshot.attention.actionableUrgentDenominator).toBeGreaterThanOrEqual(0);
  });

  it("feeds duplicate pressure into effectiveness diagnostics", () => {
    const dependency = (id: string) => insightItem({
      id,
      kind: "dependency-vuln",
      details: {
        package: "same-package",
        severity: "high",
        cvss: 8,
        scope: "runtime",
        fixAvailable: true,
        fixVersion: "2.0.0",
      },
    });
    const snapshot = buildInsightSnapshot({
      items: [dependency("one"), dependency("two")],
      readyKinds: ["dependency-vuln"],
      refreshedKinds: ["dependency-vuln"],
      catalog: runtimeCatalog,
      score: scoreContextFixture(runtimeCatalog),
      botLogins: [],
      now: NOW,
    });

    expect(snapshot.diagnostics.map((entry) => entry.id)).toHaveLength(6);
    expect(snapshot.diagnostics).toContainEqual(expect.objectContaining({
      id: "noise-pressure",
      numerator: 1,
      denominator: 2,
      severity: "attention",
    }));
  });
});
