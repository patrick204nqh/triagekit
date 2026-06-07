import { describe, it, expect } from "vitest";
import { registerScorer, resolveScorer } from "../../src/runtime/scoring/registry";
import type { TriageItem } from "../../src/runtime/dataset/item";

const item = { kind: "task", signal: 42 } as TriageItem;
describe("resolveScorer", () => {
  it("falls back to item.signal when no scorer registered", () => {
    expect(resolveScorer("secret-scanning")(item)).toBe(42);
  });
  it("uses a registered scorer for the kind", () => {
    registerScorer("task", () => 7); expect(resolveScorer("task")(item)).toBe(7);
  });
  it("an explicit override wins", () => {
    expect(resolveScorer("task", () => 999)(item)).toBe(999);
  });
});
