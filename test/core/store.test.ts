// test/core/store.test.ts
import { describe, it, expect } from "vitest";
import { createStore } from "../../src/runtime/core/store";
import type { TriageItem } from "../../src/runtime/dataset/item";

const item = (id: string, kind: TriageItem["kind"] = "issue"): TriageItem => ({
  id, source: id.split(":")[0], kind, title: id, location: "repo",
  signal: 0, createdAt: "2026-01-01T00:00:00Z", url: "", details: {},
});

describe("dataset store", () => {
  it("upsert adds items keyed by fingerprint (default = id); same fp replaces", () => {
    const s = createStore();
    s.upsert([item("github:1"), item("github:2")], { provider: "github", scopeKey: "r1", fetchedAt: 1 });
    expect(s.snapshot().map(i => i.id).sort()).toEqual(["github:1", "github:2"]);

    s.upsert([{ ...item("github:1"), title: "updated" }], { provider: "github", scopeKey: "r1", fetchedAt: 2 });
    expect(s.snapshot()).toHaveLength(2);
    expect(s.snapshot().find(i => i.id === "github:1")!.title).toBe("updated");
  });

  it("replaceScope swaps only the matching provider+scope slice", () => {
    const s = createStore();
    s.upsert([item("github:1")], { provider: "github", scopeKey: "r1", fetchedAt: 1 });
    s.upsert([item("gitlab:9")], { provider: "gitlab", scopeKey: "g1", fetchedAt: 1 });

    s.replaceScope("github", "r1", [item("github:2"), item("github:3")], 5);

    expect(s.snapshot().map(i => i.id).sort()).toEqual(["github:2", "github:3", "gitlab:9"]);
  });

  it("remove deletes by fingerprint; snapshot is the items only", () => {
    const s = createStore();
    s.upsert([item("github:1"), item("github:2")], { provider: "github", scopeKey: "r1", fetchedAt: 1 });
    s.remove(["github:1"]);
    expect(s.snapshot().map(i => i.id)).toEqual(["github:2"]);
  });

  it("stats counts by provider and by kind", () => {
    const s = createStore();
    s.upsert([item("github:1", "issue"), item("github:2", "change-request")], { provider: "github", scopeKey: "r1", fetchedAt: 1 });
    s.upsert([item("gitlab:9", "issue")], { provider: "gitlab", scopeKey: "g1", fetchedAt: 1 });
    expect(s.stats()).toEqual({
      byProvider: { github: 2, gitlab: 1 },
      byKind: { issue: 2, "change-request": 1 },
    });
  });

  it("supports a custom fingerprint for future cross-tool merge", () => {
    const s = createStore((it) => it.title);
    s.upsert([{ ...item("github:1"), title: "CVE-1" }], { provider: "github", scopeKey: "r1", fetchedAt: 1 });
    s.upsert([{ ...item("snyk:5"), title: "CVE-1" }], { provider: "snyk", scopeKey: "s1", fetchedAt: 1 });
    expect(s.snapshot()).toHaveLength(1);
  });
});
