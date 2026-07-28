import { describe, expect, it } from "vitest";
import { capabilityMetric } from "../../src/runtime/insights/capabilities";
import type { TriageItem } from "../../src/runtime/dataset/item";

const item = (id: string, details: unknown = {}): TriageItem => ({
  id,
  provider: "github",
  providerRef: {},
  kind: "dependency-vuln",
  title: id,
  location: "acme-corp/web",
  signal: 50,
  createdAt: "2026-07-01T00:00:00Z",
  url: "",
  details,
});

describe("capabilityMetric", () => {
  it("reports a supported numerator and denominator", () => {
    const result = capabilityMetric(
      [
        item("a", { fixAvailable: true }),
        item("b", { fixAvailable: false }),
      ],
      (candidate) =>
        Boolean((candidate.details as { fixAvailable?: boolean }).fixAvailable),
    );

    expect(result).toEqual({
      status: "available",
      numerator: 1,
      denominator: 2,
      ratio: 0.5,
    });
  });

  it("reports unavailable rather than a guessed zero", () => {
    expect(capabilityMetric([item("a")], undefined)).toEqual({
      status: "unavailable",
    });
  });

  it("reports zero coverage for a supported empty collection", () => {
    expect(capabilityMetric([], () => true)).toEqual({
      status: "available",
      numerator: 0,
      denominator: 0,
      ratio: 0,
    });
  });
});
