// test/dataset/details.test.ts
import { describe, it, expect } from "vitest";
import { detailsAs, authorKindOf, labelNamesOf, labelsOf, deadlineOf } from "../../src/runtime/dataset/details";
import type { TriageItem } from "../../src/runtime/dataset/item";

const item = (details: unknown): TriageItem =>
  ({ id: "x", source: "github", kind: "issue", title: "", location: "", signal: 0, createdAt: "", url: "", details } as TriageItem);

describe("detailsAs", () => {
  it("returns the object for object details, null otherwise", () => {
    expect(detailsAs<{ a: number }>(item({ a: 1 }))).toEqual({ a: 1 });
    expect(detailsAs(item(null))).toBeNull();
    expect(detailsAs(item("nope"))).toBeNull();
    expect(detailsAs(item(5))).toBeNull();
  });
});
describe("field readers", () => {
  it("authorKindOf", () => {
    expect(authorKindOf(item({ author: { kind: "bot" } }))).toBe("bot");
    expect(authorKindOf(item({}))).toBeUndefined();
  });
  it("labelNamesOf", () => {
    expect(labelNamesOf(item({ labels: [{ name: "p0" }, { name: "cve" }] }))).toEqual(["p0", "cve"]);
    expect(labelNamesOf(item({}))).toEqual([]);
  });
  it("labelsOf returns full Label objects (name + color), [] when absent", () => {
    expect(labelsOf(item({ labels: [{ name: "bug", color: "d73a4a" }] })))
      .toEqual([{ name: "bug", color: "d73a4a" }]);
    expect(labelsOf(item({}))).toEqual([]);
  });
  it("deadlineOf", () => {
    expect(deadlineOf(item({ dueAt: "2026-01-01" }))).toBe("2026-01-01");
    expect(deadlineOf(item({}))).toBeUndefined();
  });
});
