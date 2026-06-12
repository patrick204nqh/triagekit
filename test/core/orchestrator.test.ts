// test/core/orchestrator.test.ts
import { describe, it, expect } from "vitest";
import { refresh, type ProviderJob } from "../../src/runtime/core/orchestrator";
import { createStore } from "../../src/runtime/core/store";
import type { ProviderPort } from "../../src/runtime/core/ports";
import type { TriageItem } from "../../src/runtime/dataset/item";

const item = (id: string): TriageItem => ({
  id, source: id.split(":")[0], kind: "issue", title: id, location: "r",
  signal: 0, createdAt: "2026-01-01T00:00:00Z", url: "", details: {},
});
const port = (id: string, impl: ProviderPort["fetch"]): ProviderPort => ({ id, kinds: ["issue"], fetch: impl });
const job = (p: ProviderPort, scopeKey: string): ProviderJob =>
  ({ provider: p.id, scopeKey, scope: {}, token: "t", port: p });

describe("refresh orchestration", () => {
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
    store.upsert([item("github:OLD")], { provider: "github", scopeKey: "r1", fetchedAt: 1 });

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

  it("runs registered post-fetch enrichers after fetch and surfaces their errors", async () => {
    const { registerEnricher } = await import("../../src/runtime/core/enrichment");
    const seen: string[] = [];
    registerEnricher({ id: "probe", async enrich() { seen.push("ran"); return [{ target: "probe", message: "note" }]; } });
    const store = createStore();
    const probeJob = {
      provider: "github",
      scopeKey: "k",
      scope: {},
      token: "t",
      port: { fetch: async () => ({ items: [], errors: [] }) },
    };
    const { errors } = await refresh([probeJob as any], store);
    expect(seen).toContain("ran");
    expect(errors).toEqual(expect.arrayContaining([{ target: "probe", message: "note" }]));
  });
});
