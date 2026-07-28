import { describe, expect, it } from "vitest";
import {
  resolveInsightRoute,
  type ResolvedInsightRoute,
} from "../../src/runtime/insights/routes";
import { testCatalog } from "../support/test-catalog";

describe("resolveInsightRoute", () => {
  it("opens a repository concentration in the matching artifact List", () => {
    const result = resolveInsightRoute({
      route: {
        destination: "list",
        kind: "code-scanning",
        repository: "acme-corp/api",
        filters: {
          tier: ["P0", "P1"],
          unsupported: ["x"],
        },
      },
      catalog: testCatalog(),
      repositories: ["acme-corp/api"],
    });

    expect(result).toEqual({
      destination: "list",
      kind: "code-scanning",
      view: "list",
      preferredRepository: "acme-corp/api",
      filters: {
        sort: "priority",
        axes: { tier: ["P0", "P1"] },
      },
    });
  });

  it("drops an unavailable repository without invalid state", () => {
    const result = resolveInsightRoute({
      route: {
        destination: "list",
        kind: "issue",
        repository: "missing",
      },
      catalog: testCatalog(),
      repositories: ["acme-corp/web"],
    });

    expect(result).toMatchObject({
      destination: "list",
      preferredRepository: "",
    });
  });

  it("rejects a List route for an unavailable kind", () => {
    expect(() => resolveInsightRoute({
      route: {
        destination: "list",
        kind: "cloud-misconfig",
      },
      catalog: testCatalog(),
      repositories: [],
    })).toThrow(/ready kind.*cloud-misconfig/i);
  });

  it.each([
    ["scoring", "scoring"],
    ["filters", "filters"],
  ] as const)("resolves %s to its settings category", (destination, category) => {
    const result: ResolvedInsightRoute = resolveInsightRoute({
      route: { destination },
      catalog: testCatalog(),
      repositories: [],
    });
    expect(result).toEqual({ destination: "settings", category });
  });
});
