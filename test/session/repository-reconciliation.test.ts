import { describe, expect, it } from "vitest";
import { createTriageSession } from "../../src/runtime/session/triage-session";
import type { ScoredItem } from "../../src/runtime/layout/table/kind-renderer";
import { testCatalog } from "../support/test-catalog";

const row = (
  location: string,
  details: Record<string, unknown> = {},
): ScoredItem => ({
  id: `github:${location}:1`,
  provider: "github",
  providerRef: { repository: location, number: 1 },
  kind: "issue",
  title: "Example",
  location,
  signal: 1,
  score: 1,
  tier: "P3",
  createdAt: "2026-01-01T00:00:00Z",
  url: "",
  details,
});

const sessionWithRepository = (repository: string) => createTriageSession({
  catalog: testCatalog(),
  initial: {
    kind: "issue",
    provider: "github",
    preferredRepository: repository,
    effectiveRepository: repository,
    view: "list",
    filters: {
      sort: "priority",
      axes: {
        labels: ["security"],
        assignee: ["octo"],
      },
    },
  },
});

describe("repository reconciliation", () => {
  it("preserves preference while effective value temporarily falls back to All", () => {
    const session = sessionWithRepository("acme-corp/api");

    const fallback = session.reconcile({
      repositories: ["acme-corp/web"],
      views: ["list"],
    });

    expect(fallback.work).toBe("rederive");
    expect(fallback.state.preferredRepository).toBe("acme-corp/api");
    expect(fallback.state.effectiveRepository).toBe("");

    const restored = session.reconcile({
      repositories: ["acme-corp/api", "acme-corp/web"],
      views: ["list"],
    });

    expect(restored.work).toBe("rederive");
    expect(restored.state.preferredRepository).toBe("acme-corp/api");
    expect(restored.state.effectiveRepository).toBe("acme-corp/api");
  });

  it("prunes filters against rows in the selected repository", () => {
    const session = sessionWithRepository("");
    const rows = [
      row("acme-corp/web", {
        labels: [{ name: "security", color: "888888" }],
        assignees: [],
      }),
      row("acme-corp/api", {
        labels: [{ name: "backend", color: "888888" }],
        assignees: [{ login: "octo", avatarUrl: "", kind: "human" }],
      }),
    ];

    const update = session.selectRepository("acme-corp/web", rows);

    expect(update.work).toBe("rederive");
    expect(update.state.preferredRepository).toBe("acme-corp/web");
    expect(update.state.effectiveRepository).toBe("acme-corp/web");
    expect(update.state.filters.axes.labels).toEqual(["security"]);
    expect(update.state.filters.axes.assignee).toBeUndefined();
  });

  it("clears preference and effective repository when All is selected", () => {
    const session = sessionWithRepository("acme-corp/web");

    const update = session.selectRepository("", [row("acme-corp/web")]);

    expect(update.state.preferredRepository).toBe("");
    expect(update.state.effectiveRepository).toBe("");
    expect(update.work).toBe("rederive");
  });

  it("rejects a repository absent from the supplied rows", () => {
    const session = sessionWithRepository("");
    const before = session.snapshot();

    const update = session.selectRepository(
      "acme-corp/missing",
      [row("acme-corp/web")],
    );

    expect(update.work).toBe("none");
    expect(update.state).toEqual(before);
  });
});
