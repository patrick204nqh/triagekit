import { describe, expect, it } from "vitest";
import { parseProjectRef, parseBoard, applyProjectStatuses, projectStatusOf } from "../../../src/runtime/ingest/github/project-source";
import { createStore } from "../../../src/runtime/core/store";
import type { TriageItem } from "../../../src/runtime/dataset/item";
import { projectStatusAxis } from "../../../src/runtime/ingest/github/project-source";
import type { ScoredItem } from "../../../src/runtime/layout/table/kind-renderer";

const review = (kind: "issue" | "change-request", loc: string, number: number): TriageItem =>
  ({ id: `github:${loc}:${number}`, source: "github", kind, title: "", location: loc, signal: 0, createdAt: "", url: "", details: { number } } as TriageItem);

describe("parseProjectRef", () => {
  it("parses owner/number, rejects junk", () => {
    expect(parseProjectRef("acme/3")).toEqual({ owner: "acme", number: 3 });
    expect(parseProjectRef("nope")).toBeNull();
    expect(parseProjectRef(42)).toBeNull();
    expect(parseProjectRef(undefined)).toBeNull();
  });
});

describe("parseBoard", () => {
  it("builds a repo#number -> status map from org or user project", () => {
    const data = { user: { projectV2: { items: { nodes: [
      { content: { number: 1, repository: { nameWithOwner: "acme/web" } }, fieldValueByName: { name: "In review" } },
      { content: { number: 2, repository: { nameWithOwner: "acme/api" } }, fieldValueByName: { name: "Blocked" } },
      { content: {}, fieldValueByName: { name: "x" } },
    ] } } } };
    const map = parseBoard(data);
    expect(map.get("acme/web#1")).toBe("In review");
    expect(map.get("acme/api#2")).toBe("Blocked");
    expect(map.size).toBe(2);
  });
});

describe("applyProjectStatuses", () => {
  it("stamps status onto matching review items only", () => {
    const store = createStore();
    store.replaceScope("github", "k", [review("issue", "acme/web", 1), review("change-request", "acme/api", 2)], 0);
    applyProjectStatuses(store, new Map([["acme/web#1", "In review"]]));
    const byId = Object.fromEntries(store.snapshot().map((i) => [i.id, projectStatusOf(i)]));
    expect(byId["github:acme/web:1"]).toBe("In review");
    expect(byId["github:acme/api:2"]).toBeUndefined();
  });
});

describe("projectStatusAxis", () => {
  const row = (status?: string): ScoredItem =>
    ({ id: "x", source: "github", kind: "issue", title: "", location: "a/b", signal: 0, createdAt: "", url: "",
      details: { number: 1, ...(status ? { projectStatus: status } : {}) }, score: 0, tier: "P2" } as ScoredItem);

  it("applies only when some row has a status; options are the sorted distinct set", () => {
    const rows = [row("In review"), row("Blocked"), row("In review"), row()];
    expect(projectStatusAxis.appliesTo(rows, { artifact: {} as any })).toBe(true);
    expect(projectStatusAxis.appliesTo([row()], { artifact: {} as any })).toBe(false);
    expect(projectStatusAxis.optionsFrom(rows, { artifact: {} as any }).map((o) => o.value)).toEqual(["Blocked", "In review"]);
    expect(projectStatusAxis.test(row("Blocked"), ["Blocked"])).toBe(true);
    expect(projectStatusAxis.test(row(), ["Blocked"])).toBe(false);
  });
});
