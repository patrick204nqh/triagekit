import { describe, expect, it } from "vitest";
import {
  diagnoseEffectiveness,
  MAX_TOP_TIER_RATIO,
  MIN_COVERAGE_RATIO,
  MIN_DISTINCT_SCORE_RATIO,
  type DiagnosticInput,
} from "../../src/runtime/insights/diagnostics";
import { available, unavailable } from "../support/insights";

const diagnosticInput = (
  over: Partial<DiagnosticInput> = {},
): DiagnosticInput => ({
  scores: [120, 110, 90, 60],
  tiers: ["P0", "P1", "P2", "P3"],
  actionability: available(4, 4),
  ownership: available(4, 4),
  evidence: available(4, 4),
  duplicateCount: 0,
  mutedBotCount: 0,
  ...over,
});

describe("diagnoseEffectiveness", () => {
  it("flags weak score separation with supporting values", () => {
    const result = diagnoseEffectiveness(diagnosticInput({
      scores: [100, 100, 100, 90],
    }));

    expect(result).toContainEqual(expect.objectContaining({
      id: "score-separation",
      severity: "attention",
      numerator: 2,
      denominator: 4,
      actionId: "scoring",
    }));
  });

  it("treats the distinct-score threshold as healthy", () => {
    const total = 10;
    const distinct = Math.round(total * MIN_DISTINCT_SCORE_RATIO);
    const scores = [
      ...Array.from({ length: distinct }, (_, index) => index),
      ...Array.from({ length: total - distinct }, () => 0),
    ];
    const result = diagnoseEffectiveness(diagnosticInput({
      scores,
      tiers: Array.from({ length: total }, () => "P2"),
    }));

    expect(result.find((entry) => entry.id === "score-separation")?.severity)
      .toBe("healthy");
  });

  it("flags top-tier concentration only above its threshold", () => {
    const above = diagnoseEffectiveness(diagnosticInput({
      tiers: ["P0", "P0", "P1", "P2"],
    }));
    expect(above).toContainEqual(expect.objectContaining({
      id: "priority-concentration",
      severity: "attention",
      numerator: 2,
      denominator: 4,
    }));

    const denominator = 20;
    const p0 = Math.floor(denominator * MAX_TOP_TIER_RATIO);
    const boundary = diagnoseEffectiveness(diagnosticInput({
      scores: Array.from({ length: denominator }, (_, index) => index),
      tiers: [
        ...Array.from({ length: p0 }, () => "P0" as const),
        ...Array.from({ length: denominator - p0 }, () => "P2" as const),
      ],
    }));
    expect(boundary.find((entry) => entry.id === "priority-concentration")?.severity)
      .toBe("healthy");
  });

  it("marks unavailable coverage as limited instead of zero", () => {
    const result = diagnoseEffectiveness(diagnosticInput({
      ownership: unavailable(),
    }));

    const ownership = result.find(
      (entry) => entry.id === "ownership-coverage",
    );
    expect(ownership).toEqual(expect.objectContaining({
      id: "ownership-coverage",
      severity: "limited",
    }));
    expect(ownership).not.toHaveProperty("numerator");
    expect(ownership).not.toHaveProperty("denominator");
  });

  it("flags supported coverage below the named threshold", () => {
    const denominator = 10;
    const numerator = Math.ceil(denominator * MIN_COVERAGE_RATIO) - 1;
    const result = diagnoseEffectiveness(diagnosticInput({
      actionability: available(numerator, denominator),
      evidence: available(numerator, denominator),
    }));

    expect(result).toContainEqual(expect.objectContaining({
      id: "actionability-coverage",
      severity: "attention",
      numerator,
      denominator,
      actionId: "filters",
    }));
    expect(result).toContainEqual(expect.objectContaining({
      id: "evidence-coverage",
      severity: "attention",
      numerator,
      denominator,
    }));
  });

  it("flags duplicate and muted-bot noise pressure", () => {
    const result = diagnoseEffectiveness(diagnosticInput({
      duplicateCount: 1,
      mutedBotCount: 1,
    }));

    expect(result).toContainEqual(expect.objectContaining({
      id: "noise-pressure",
      severity: "attention",
      numerator: 2,
      denominator: 4,
      actionId: "filters",
    }));
  });

  it("returns a stable diagnostic order for an empty snapshot", () => {
    const result = diagnoseEffectiveness(diagnosticInput({
      scores: [],
      tiers: [],
      actionability: unavailable(),
      ownership: unavailable(),
      evidence: unavailable(),
    }));

    expect(result.map((entry) => entry.id)).toEqual([
      "score-separation",
      "priority-concentration",
      "actionability-coverage",
      "ownership-coverage",
      "evidence-coverage",
      "noise-pressure",
    ]);
    expect(result[0]?.severity).toBe("limited");
    expect(result[1]?.severity).toBe("limited");
  });
});
