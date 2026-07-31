// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runtimeCatalog } from "../../src/runtime/catalog/built-in";
import { createHandoffController } from "../../src/runtime/handoff/controller";
import { createHandoffQueue, queueKey } from "../../src/runtime/handoff/queue";
import type {
  HandoffController,
  RevalidationResult,
} from "../../src/runtime/handoff/types";
import { mountHandoffComposer } from "../../src/runtime/layout/handoff/composer";
import type { ScoredItem } from "../../src/runtime/layout/table/kind-renderer";

const repositories = [
  "acme-corp/core",
  "acme-corp/web",
  "acme-corp/docs",
] as const;

function issue(
  id: string,
  repository: (typeof repositories)[number],
  index: number,
): ScoredItem {
  return {
    id,
    provider: "github",
    providerRef: { number: index + 1, credential: "must-not-project" },
    kind: "issue",
    title: `Issue ${index + 1}`,
    location: repository,
    signal: 100 - index,
    createdAt: "2026-07-29T00:00:00.000Z",
    url: `https://example.test/${repository}/issues/${index + 1}`,
    details: {
      number: index + 1,
      state: "open",
      body: "Bounded operator context",
      author: { login: "alice", avatarUrl: "", kind: "human" },
      assignees: [],
      reviewers: [],
      comments: 0,
      labels: [{ name: "security" }],
      checks: null,
      permalinks: [],
      relations: [],
      token: "must-not-project",
      rawResponse: "must-not-project",
    },
    score: 100 - index,
    tier: index < 8 ? "P0" : index < 24 ? "P1" : "P2",
  };
}

function changeRequest(id: string, index: number): ScoredItem {
  return {
    ...issue(id, "acme-corp/core", index),
    kind: "change-request",
    details: {
      number: index + 1,
      state: "open",
      draft: false,
      body: "Review the bounded change.",
      author: { login: "alice", avatarUrl: "", kind: "human" },
      assignees: [],
      reviewers: [],
      comments: 0,
      labels: [{ name: "security" }],
      checks: { state: "passing", total: 1, failed: 0 },
      permalinks: [],
      relations: [],
    },
  };
}

function workflowItems(): ScoredItem[] {
  const coreIssues = Array.from({ length: 12 }, (_, index) =>
    issue(
      index === 0
        ? "resolved-1"
        : index === 1
          ? "secret-1"
          : `core-issue-${index}`,
      "acme-corp/core",
      index,
    ),
  );
  const coreChanges = Array.from({ length: 4 }, (_, index) =>
    changeRequest(index === 0 ? "change-1" : `core-change-${index}`, 12 + index),
  );
  const webIssues = Array.from({ length: 35 }, (_, index) =>
    issue(
      index === 0 ? "offline-1" : `web-issue-${index}`,
      "acme-corp/web",
      16 + index,
    ),
  );
  const docsIssues = Array.from({ length: 5 }, (_, index) =>
    issue(`docs-issue-${index}`, "acme-corp/docs", 51 + index),
  );
  return [...coreIssues, ...coreChanges, ...webIssues, ...docsIssues];
}

interface WorkflowScenario {
  readonly controller: HandoffController;
  readonly clipboard: { writeText: ReturnType<typeof vi.fn> };
  readonly openComposer: () => Promise<number>;
}

function mountWorkflowScenario(): WorkflowScenario {
  const items = workflowItems();
  const queue = createHandoffQueue();
  queue.addMany(
    items.map((item) => ({
      provider: item.provider,
      itemId: item.id,
      kind: item.kind,
      repository: item.location,
    })),
    1_000,
  );

  const clipboard = { writeText: vi.fn().mockResolvedValue(undefined) };
  const revalidation: RevalidationResult = {
    transitions: queue.snapshot().entries.map((entry) => {
      const itemId = entry.identity.itemId;
      const base = { key: queueKey(entry.identity), itemId };
      if (itemId === "resolved-1") {
        return { ...base, status: "resolved", selected: false };
      }
      if (itemId === "change-1") {
        return {
          ...base,
          status: "changed",
          selected: true,
          changedFields: ["details"],
        };
      }
      if (itemId === "offline-1") {
        return {
          ...base,
          status: "unavailable",
          selected: true,
          reason: "Repository temporarily unavailable",
        };
      }
      if (itemId === "secret-1") {
        return {
          ...base,
          status: "blocked",
          selected: true,
          reason: "Unsafe source field omitted",
        };
      }
      return { ...base, status: "current", selected: true };
    }),
  };

  const controller = createHandoffController({
    queue,
    items: () => items,
    focusPolicy: () => ({
      provider: "github",
      repositoryOrder: [...repositories],
      repositories: Object.fromEntries(
        repositories.map((repository) => [
          repository,
          { weight: 0, pinned: false },
        ]),
      ),
      labels: {
        include: ["security"],
        exclude: ["jira-ticket-created"],
      },
    }),
    catalog: runtimeCatalog,
    scoreExplain: () => null,
    clock: () => new Date("2026-07-29T00:00:00.000Z"),
    clipboard,
    downloads: {
      text: vi.fn(() => ({ ok: true })),
      json: vi.fn(() => ({ ok: true })),
    },
    revalidateHandoffQueue: vi.fn().mockResolvedValue(revalidation),
  });

  mountHandoffComposer(
    document.getElementById("handoff-host")!,
    controller,
  );

  return {
    controller,
    clipboard,
    async openComposer() {
      const startedAt = performance.now();
      controller.open();
      await controller.revalidate();
      return performance.now() - startedAt;
    },
  };
}

describe("focus and handoff workflow", () => {
  beforeEach(() => {
    document.body.innerHTML =
      '<button data-queue-badge>Queue</button><div id="handoff-host"></div>';
  });

  it("transfers exactly five ordered packages and retains the remainder", async () => {
    const app = mountWorkflowScenario();
    const elapsed = await app.openComposer();
    const transfer = app.controller.snapshot();

    expect(transfer.packages).toHaveLength(5);
    expect(
      transfer.packages.flatMap((pkg) => pkg.targets).length,
    ).toBeLessThanOrEqual(50);

    const rank = new Map(
      repositories.map((repository, index) => [repository, index]),
    );
    const packageRanks = transfer.packages.map(
      (pkg) => rank.get(pkg.repository as (typeof repositories)[number])!,
    );
    expect(packageRanks).toEqual([...packageRanks].sort((a, b) => a - b));
    expect(transfer.remainingPackages).toBeGreaterThan(0);
    expect(
      transfer.packages
        .flatMap((pkg) => pkg.targets)
        .some((target) => target.id === "resolved-1"),
    ).toBe(false);
    expect(
      transfer.packages
        .flatMap((pkg) => pkg.targets)
        .some((target) => target.id === "secret-1"),
    ).toBe(false);
    expect(elapsed).toBeLessThan(120_000);

    expect(await app.controller.copyBundle()).toEqual({ ok: true });
    const markdown = app.clipboard.writeText.mock.calls[0][0] as string;
    expect(markdown.match(/^## Package /gm)).toHaveLength(5);
    expect(markdown).not.toMatch(/credential|rawResponse|must-not-project/i);
    expect(markdown).not.toContain("resolved-1");
    expect(markdown).not.toContain("secret-1");
  });
});
