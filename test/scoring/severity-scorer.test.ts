// test/scoring/severity-scorer.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { SEVERITY_BASE, makeSeverityScorer } from "../../src/runtime/scoring/severity-scorer";
import type { TriageItem } from "../../src/runtime/dataset/item";

const item = <D>(details: D, createdAt = new Date().toISOString()): TriageItem<D> =>
  ({ id: "x", source: "s", kind: "dependency-vuln", title: "", location: "", signal: 0, createdAt, url: "", details } as TriageItem<D>);

afterEach(() => vi.useRealTimers());

describe("makeSeverityScorer", () => {
  it("uses SEVERITY_BASE and yields 0 for unknown severity", () => {
    const s = makeSeverityScorer<{ sev: string }>({ severity: d => d.sev });
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    expect(s(item({ sev: "critical" }, "2026-01-01T00:00:00Z"))).toBe(SEVERITY_BASE.critical);
    expect(s(item({ sev: "nope" }, "2026-01-01T00:00:00Z"))).toBe(0);
  });
  it("adds adjust before round; clampZero floors at 0", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const noClamp = makeSeverityScorer<{ sev: string }>({ severity: d => d.sev, adjust: () => -200 });
    expect(noClamp(item({ sev: "low" }, "2026-01-01T00:00:00Z"))).toBeLessThan(0);
    const clamped = makeSeverityScorer<{ sev: string }>({ severity: d => d.sev, adjust: () => -200, clampZero: true });
    expect(clamped(item({ sev: "low" }, "2026-01-01T00:00:00Z"))).toBe(0);
  });
  it("age bonus caps at 15", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-12-31T00:00:00Z"));
    const s = makeSeverityScorer<{ sev: string }>({ severity: d => d.sev });
    expect(s(item({ sev: "low" }, "2026-01-01T00:00:00Z"))).toBe(SEVERITY_BASE.low + 15);
  });
});
