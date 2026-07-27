import { describe, expect, it } from "vitest";
import type {
  KindRefreshOutcome,
  ProviderDeclaration,
} from "../../src/runtime/catalog/types";
import {
  refreshProviders,
  type ProviderRefreshJob,
} from "../../src/runtime/core/orchestrator";
import { createStore } from "../../src/runtime/core/store";
import type { Kind, TriageItem } from "../../src/runtime/dataset/item";

const item = (id: string, kind: Kind = "issue"): TriageItem => ({
  id,
  provider: "github",
  providerRef: { number: id },
  kind,
  title: id,
  location: "r",
  signal: 0,
  createdAt: "2026-01-01T00:00:00Z",
  url: "",
  details: {},
});

const provider = (
  refresh: () => Promise<readonly KindRefreshOutcome[]>,
): ProviderDeclaration => ({
  id: "github",
  label: "GitHub",
  status: "ready",
  kinds: ["issue", "code-scanning"],
  connection: { setupHint: "Token", scopeFields: [] },
  capabilities: { discoverScope: false, enrich: [], actions: {} },
  adapter: { refresh },
});

const job = (
  declaration: ProviderDeclaration,
  kinds: readonly Kind[] = declaration.kinds,
): ProviderRefreshJob => ({
  provider: declaration,
  scopeKey: "r1",
  scope: {},
  credential: "t",
  kinds,
});

describe("refreshProviders", () => {
  it("replaces successful Kinds and retains failed Kind slices", async () => {
    const store = createStore();
    store.upsert([item("github:issue-old")], {
      provider: "github",
      scopeKey: "r1",
      kind: "issue",
      fetchedAt: 1,
    });
    store.upsert([item("github:scan-old", "code-scanning")], {
      provider: "github",
      scopeKey: "r1",
      kind: "code-scanning",
      fetchedAt: 1,
    });
    const github = provider(async () => [{
      kind: "issue",
      status: "success",
      items: [item("github:issue-new")],
      failures: [],
    }, {
      kind: "code-scanning",
      status: "failed",
      items: [],
      failures: [{
        provider: "github",
        kind: "code-scanning",
        category: "rate-limit",
        message: "rate limited",
      }],
    }]);

    const result = await refreshProviders([job(github)], store, () => 2);

    expect(store.snapshot().map((entry) => entry.id).sort()).toEqual([
      "github:issue-new",
      "github:scan-old",
    ]);
    expect(result.failures).toHaveLength(1);
  });

  it("retains existing data when a provider adapter rejects", async () => {
    const store = createStore();
    store.upsert([item("github:old")], {
      provider: "github",
      scopeKey: "r1",
      kind: "issue",
      fetchedAt: 1,
    });
    const github = provider(async () => {
      throw new Error("network unavailable");
    });

    const result = await refreshProviders([job(github, ["issue"])], store);

    expect(store.snapshot().map((entry) => entry.id)).toEqual(["github:old"]);
    expect(result.failures).toEqual([{
      provider: "github",
      category: "provider",
      message: "network unavailable",
    }]);
  });

  it("replaces a partially successful Kind and reports its failures", async () => {
    const store = createStore();
    const github = provider(async () => [{
      kind: "issue",
      status: "partial",
      items: [item("github:1")],
      failures: [{
        provider: "github",
        kind: "issue",
        target: "acme/widgets",
        category: "not-found",
        message: "404",
      }],
    }]);

    const result = await refreshProviders([job(github, ["issue"])], store, () => 3);

    expect(store.snapshot().map((entry) => entry.id)).toEqual(["github:1"]);
    expect(result.failures[0]?.target).toBe("acme/widgets");
  });
});
