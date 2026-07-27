// test/core/orchestrator.test.ts
import { describe, it, expect } from "vitest";
import {
  refresh,
  refreshProviders,
  type ProviderJob,
} from "../../src/runtime/core/orchestrator";
import type { ProviderDeclaration } from "../../src/runtime/catalog/types";
import { createStore } from "../../src/runtime/core/store";
import type { ProviderPort } from "../../src/runtime/core/ports";
import type { TriageItem } from "../../src/runtime/dataset/item";

const item = (id: string): TriageItem => ({
  id,
  provider: id.split(":")[0],
  providerRef: { number: id },
  kind: "issue",
  title: id,
  location: "r",
  signal: 0, createdAt: "2026-01-01T00:00:00Z", url: "", details: {},
});
const port = (id: string, impl: ProviderPort["fetch"]): ProviderPort => ({ id, kinds: ["issue"], fetch: impl });
const job = (p: ProviderPort, scopeKey: string): ProviderJob =>
  ({ provider: p.id, scopeKey, scope: {}, token: "t", port: p });

describe("refresh orchestration", () => {
  it("replaces successful Kinds and retains failed Kind slices", async () => {
    const store = createStore();
    store.upsert([item("github:issue-old")], {
      provider: "github",
      scopeKey: "r1",
      kind: "issue",
      fetchedAt: 1,
    });
    const scanOld = {
      ...item("github:scan-old"),
      kind: "code-scanning" as const,
    };
    store.upsert([scanOld], {
      provider: "github",
      scopeKey: "r1",
      kind: "code-scanning",
      fetchedAt: 1,
    });
    const provider: ProviderDeclaration = {
      id: "github",
      label: "GitHub",
      status: "ready",
      kinds: ["issue", "code-scanning"],
      connection: { setupHint: "Token", scopeFields: [] },
      capabilities: { discoverScope: false, enrich: [], actions: {} },
      adapter: {
        refresh: async () => [{
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
            category: "network",
            message: "offline",
          }],
        }],
      },
    };

    const result = await refreshProviders([{
      provider,
      scopeKey: "r1",
      scope: {},
      credential: "token",
      kinds: ["issue", "code-scanning"],
    }], store, () => 2);

    expect(store.snapshot().map((entry) => entry.id).sort()).toEqual([
      "github:issue-new",
      "github:scan-old",
    ]);
    expect(result.failures).toHaveLength(1);
  });

  it("merges fulfilled providers into the store via replaceScope", async () => {
    const store = createStore();
    const gh = port("github", async () => ({ items: [item("github:1")], errors: [] }));
    const gl = port("gitlab", async () => ({ items: [item("gitlab:9")], errors: [] }));
    const r = await refresh([job(gh, "r1"), job(gl, "g1")], store, () => 100);
    expect(store.snapshot().map(i => i.id).sort()).toEqual(["github:1", "gitlab:9"]);
    expect(r.errors).toEqual([]);
  });

  it("a rejected provider keeps its prior slice and records an error", async () => {
    const store = createStore();
    store.upsert([item("github:OLD")], { provider: "github", scopeKey: "r1", kind: "issue", fetchedAt: 1 });

    const gh = port("github", async () => { throw new Error("rate limited"); });
    const r = await refresh([job(gh, "r1")], store, () => 100);

    expect(store.snapshot().map(i => i.id)).toEqual(["github:OLD"]); // retained
    expect(r.errors).toEqual([{ target: "github", message: "rate limited" }]);
  });

  it("propagates result-level (partial) errors from a fulfilled provider", async () => {
    const store = createStore();
    const gh = port("github", async () => ({ items: [item("github:1")], errors: [{ target: "github:repoX", message: "404" }] }));
    const r = await refresh([job(gh, "r1")], store, () => 100);
    expect(store.snapshot().map(i => i.id)).toEqual(["github:1"]);
    expect(r.errors).toEqual([{ target: "github:repoX", message: "404" }]);
  });
});
