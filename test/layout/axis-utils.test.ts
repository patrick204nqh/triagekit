// test/layout/axis-utils.test.ts
import { describe, it, expect } from "vitest";
import { uniqueValues } from "../../src/runtime/layout/axis-utils";
import type { ScoredItem } from "../../src/runtime/layout/table/kind-renderer";

const row = (kind: string, labels: string[]): ScoredItem =>
  ({ kind, details: { labels: labels.map(name => ({ name })) } } as unknown as ScoredItem);

describe("uniqueValues", () => {
  it("dedups + sorts ascending, scalar pick", () => {
    const rows = [row("issue", []), { kind: "issue", location: "b" }, { kind: "issue", location: "a" }] as ScoredItem[];
    expect(uniqueValues(rows, r => (r as { location?: string }).location)).toEqual([
      { value: "a", label: "a" }, { value: "b", label: "b" },
    ]);
  });
  it("flattens array-valued pick and applies filter", () => {
    const rows = [row("issue", ["p0", "cve"]), row("pr", ["x"]), row("issue", ["p0"])];
    const out = uniqueValues(rows, r => (r.details as { labels: { name: string }[] }).labels.map(l => l.name), r => r.kind === "issue");
    expect(out.map(o => o.value)).toEqual(["cve", "p0"]);
  });
});
