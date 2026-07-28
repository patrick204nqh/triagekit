import { describe, expect, it } from "vitest";
import { createTriageSession } from "../../src/runtime/session/triage-session";
import { testCatalog } from "../support/test-catalog";
import type { ResolvedInsightRoute } from "../../src/runtime/insights/routes";

describe("Triage Session transitions", () => {
  it("opens a resolved insight route as a cached List rederive", () => {
    const session = createTriageSession({
      catalog: testCatalog(),
      initial: {
        kind: "issue",
        provider: "github",
        view: "insights",
      },
    });
    const route: Extract<
      ResolvedInsightRoute,
      { destination: "list" }
    > = {
      destination: "list",
      kind: "code-scanning",
      view: "list",
      preferredRepository: "acme-corp/api",
      filters: { sort: "priority", axes: { tier: ["P0"] } },
    };

    const update = session.openInsightRoute(route);

    expect(update.work).toBe("rederive");
    expect(update.state).toMatchObject({
      kind: "code-scanning",
      view: "list",
      preferredRepository: "acme-corp/api",
      effectiveRepository: "acme-corp/api",
      filters: { sort: "priority", axes: { tier: ["P0"] } },
    });
    expect(update.serialized.view).toBe("list");
  });
  it("changes Kind with deterministic resets and refresh intent", () => {
    const session = createTriageSession({
      catalog: testCatalog(),
      initial: {
        kind: "issue",
        provider: "github",
        preferredRepository: "acme-corp/web",
        effectiveRepository: "acme-corp/web",
        view: "insights",
        filters: {
          sort: "recent",
          axes: { labels: ["security"] },
        },
      },
    });

    const update = session.selectKind("code-scanning");

    expect(update.work).toBe("refresh");
    expect(update.state).toMatchObject({
      kind: "code-scanning",
      provider: "github",
      preferredRepository: "acme-corp/web",
      effectiveRepository: "",
      view: "list",
      filters: { sort: "priority", axes: {} },
    });
  });

  it("rejects an incompatible Provider without changing state", () => {
    const session = createTriageSession({ catalog: testCatalog() });
    const before = session.snapshot();

    const update = session.selectProvider("provider-without-current-kind");

    expect(update.work).toBe("none");
    expect(update.state).toEqual(before);
  });

  it("presents an upcoming Kind without requesting refresh", () => {
    const session = createTriageSession({ catalog: testCatalog() });

    const update = session.selectKind("cloud-misconfig");

    expect(update.work).toBe("present");
    expect(update.state).toMatchObject({
      kind: "cloud-misconfig",
      provider: "aws",
    });
  });

  it("returns deeply frozen snapshots", () => {
    const state = createTriageSession({ catalog: testCatalog() }).snapshot();

    expect(Object.isFrozen(state)).toBe(true);
    expect(Object.isFrozen(state.filters)).toBe(true);
    expect(Object.isFrozen(state.filters.axes)).toBe(true);
  });
});
