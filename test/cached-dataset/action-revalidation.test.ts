import { describe, expect, it } from "vitest";
import type {
  ActionDefinition,
  ActionResult,
} from "../../src/runtime/actions/types";
import {
  createMemoryConnectionState,
} from "../../src/runtime/cached-dataset/browser-connection-state";
import {
  createCachedDatasets,
} from "../../src/runtime/cached-dataset/cached-datasets";
import {
  createConnectionKey,
} from "../../src/runtime/cached-dataset/identity";
import {
  createMemoryDatasetPersistence,
} from "../../src/runtime/cached-dataset/memory-persistence";
import type {
  BoundProvider,
  ProviderDefinition,
  SliceRequest,
} from "../../src/runtime/cached-dataset/provider";
import type { TriageItem } from "../../src/runtime/dataset/item";

const issue = (): TriageItem => ({
  id: "github:acme-corp/web:42",
  provider: "github",
  providerRef: { repository: "acme-corp/web", number: 42 },
  kind: "issue",
  title: "Close me",
  location: "acme-corp/web",
  signal: 40,
  createdAt: "2026-07-29T00:00:00Z",
  url: "https://example.invalid/42",
  details: { state: "open" },
});

const closedIssue = (): TriageItem => ({
  ...issue(),
  details: { state: "closed" },
});

const fixture = async (result: ActionResult) => {
  const persistence = createMemoryDatasetPersistence();
  const scope = { repos: ["acme-corp/web"] };
  const connectionKey = await createConnectionKey("github", "token", scope);
  await persistence.activateGeneration(connectionKey, 0);
  await persistence.commit({
    key: {
      connectionKey,
      target: "acme-corp/web",
      kind: "issue",
    },
    schema: 1,
    items: [issue()],
    validatedAt: 1_000,
    lastAccessedAt: 1_000,
    bytes: 100,
  }, 0);

  const requested: SliceRequest[][] = [];
  const actionDefinition: ActionDefinition = {
    intent: result.status === "outcome-unknown" ? "comment" : "close",
    kinds: ["issue"],
    available: () => true,
    validate: () => [],
    execute: async () => result,
    revalidate: (_action, item) => ({
      targets: [item.location],
      kinds: [item.kind],
    }),
  };
  const provider: ProviderDefinition = {
    id: "github",
    kinds: ["issue"],
    async bind(): Promise<BoundProvider> {
      return {
        actions: [actionDefinition],
        discoverScope: async () => [],
        canonicalizeScope: (value) => value,
        targets: () => ["acme-corp/web"],
        async *fetchSlices(request) {
          requested.push([...request.slices]);
        },
        close() {},
      };
    },
  };
  const datasets = createCachedDatasets({
    providers: [provider],
    persistence,
    connectionState: createMemoryConnectionState(),
    now: () => 1_000,
  });
  const connected = await datasets.connect("github", "token");
  const session = connected.open({
    scope,
    kinds: ["issue"],
    cadence: "off",
  });
  await new Promise((resolve) => globalThis.setTimeout(resolve, 0));
  return { session, requested, persistence, connectionKey };
};

describe("Triage Action Dataset revalidation", () => {
  it("applies confirmed normalized data then revalidates the target", async () => {
    const test = await fixture({
      status: "confirmed",
      item: closedIssue(),
    });

    await test.session.perform({
      intent: "close",
      itemId: issue().id,
    });

    expect(test.session.snapshot().items[0]).toMatchObject({
      details: { state: "closed" },
    });
    expect(test.requested).toEqual([[
      { target: "acme-corp/web", kind: "issue" },
    ]]);
    const persisted = await test.persistence.hydrate(test.connectionKey);
    expect(persisted[0].items[0]).toMatchObject({
      details: { state: "open" },
    });
  });

  it("does not mutate data for outcome-unknown but still revalidates", async () => {
    const test = await fixture({
      status: "outcome-unknown",
      message: "connection dropped",
    });

    await test.session.perform({
      intent: "comment",
      itemId: issue().id,
      markdown: "ship it",
    });

    expect(test.session.snapshot().items).toEqual([issue()]);
    expect(test.requested).toEqual([[
      { target: "acme-corp/web", kind: "issue" },
    ]]);
  });
});
