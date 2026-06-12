import { describe, expect, it } from "vitest";
import { registerEnricher, listEnrichers, runEnrichers, type PostFetchEnricher } from "../../src/runtime/core/enrichment";
import { createStore } from "../../src/runtime/core/store";

const ctx = { jobs: [{ provider: "github", token: "t", scope: {} }] };

describe("post-fetch enrichment registry", () => {
  it("registers and lists enrichers", () => {
    const enricher: PostFetchEnricher = { id: "noop", async enrich() { return []; } };
    registerEnricher(enricher);
    expect(listEnrichers().some((x) => x.id === "noop")).toBe(true);
  });

  it("runEnrichers runs each enricher and aggregates errors", async () => {
    const calls: string[] = [];
    registerEnricher({ id: "a", async enrich() { calls.push("a"); return []; } });
    registerEnricher({ id: "b", async enrich() { calls.push("b"); return [{ target: "b", message: "boom" }]; } });
    const errors = await runEnrichers(createStore(), ctx);
    expect(calls).toEqual(expect.arrayContaining(["a", "b"]));
    expect(errors).toEqual(expect.arrayContaining([{ target: "b", message: "boom" }]));
  });
});
