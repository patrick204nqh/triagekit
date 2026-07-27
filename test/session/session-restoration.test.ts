import { describe, expect, it } from "vitest";
import { createTriageSession } from "../../src/runtime/session/triage-session";
import { testCatalog } from "../support/test-catalog";

describe("Triage Session restoration", () => {
  it.each([
    [
      {
        kind: "issue",
        provider: "github",
        view: "list",
        sort: "recent",
      },
      "issue",
      "github",
      "recent",
    ],
    [
      { kind: "missing", provider: "github" },
      "issue",
      "github",
      "priority",
    ],
    [
      { kind: "issue", provider: "missing" },
      "issue",
      "github",
      "priority",
    ],
  ])(
    "restores only catalog-valid values",
    (serialized, kind, provider, sort) => {
      const session = createTriageSession({ catalog: testCatalog() });

      const update = session.restore(serialized);

      expect(update.state).toMatchObject({
        kind,
        provider,
        filters: { sort },
      });
      expect(update.work).toBe("refresh");
    },
  );

  it("preserves row-dependent repository and view until reconciliation", () => {
    const session = createTriageSession({ catalog: testCatalog() });

    const update = session.restore({
      kind: "issue",
      provider: "github",
      repository: "acme-corp/api",
      view: "due-soon",
    });

    expect(update.state.preferredRepository).toBe("acme-corp/api");
    expect(update.state.effectiveRepository).toBe("");
    expect(update.state.view).toBe("due-soon");
    expect(update.serialized.view).toBe("due-soon");
    expect(update.work).toBe("refresh");
  });

  it("validates filter axes and sort keys through the catalog", () => {
    const session = createTriageSession({ catalog: testCatalog() });

    const update = session.restore({
      kind: "issue",
      sort: "missing",
      axes: {
        labels: ["security"],
        missing: ["value"],
        assignee: [],
      },
    });

    expect(update.state.filters).toEqual({
      sort: "priority",
      axes: { labels: ["security"] },
    });
  });

  it("returns present when restoring an upcoming Kind", () => {
    const session = createTriageSession({ catalog: testCatalog() });

    const update = session.restore({
      kind: "cloud-misconfig",
      provider: "aws",
    });

    expect(update.work).toBe("present");
    expect(update.state).toMatchObject({
      kind: "cloud-misconfig",
      provider: "aws",
    });
  });
});

describe("display and filter transitions", () => {
  it("falls back to List when selecting an unavailable view", () => {
    const session = createTriageSession({ catalog: testCatalog() });

    expect(session.selectView("due-soon").state.view).toBe("due-soon");

    const update = session.selectView("missing");

    expect(update.work).toBe("present");
    expect(update.state.view).toBe("list");
  });

  it("normalizes filters and never retains caller-owned values", () => {
    const session = createTriageSession({ catalog: testCatalog() });
    const labels = ["security"];
    const axes = {
      labels,
      missing: ["value"],
      assignee: [],
    };

    const update = session.changeFilters({
      sort: "missing",
      axes,
    });
    labels.push("mutated");
    axes.labels.push("again");

    expect(update.work).toBe("rederive");
    expect(update.state.filters).toEqual({
      sort: "priority",
      axes: { labels: ["security"] },
    });
  });
});
