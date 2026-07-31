import { describe, expect, it } from "vitest";
import { runtimeCatalog } from "../../src/runtime/catalog/built-in";
import type { DependencyVulnDetails } from "../../src/runtime/dataset/kinds/dependency-vuln";
import type { TriageItem } from "../../src/runtime/dataset/item";
import {
  dependencyVulnScore,
  explainDependencyVulnScore,
} from "../../src/runtime/scoring/dependency-vuln";

const item = (
  details: Partial<DependencyVulnDetails>,
): TriageItem<DependencyVulnDetails> => ({
  id: "github:web-app:1",
  provider: "github",
  providerRef: {},
  kind: "dependency-vuln",
  title: "pkg",
  location: "web-app",
  signal: 0,
  createdAt: "2026-01-01T00:00:00Z",
  url: "",
  details: {
    package: "pkg",
    severity: "critical",
    cvss: 9.8,
    scope: "runtime",
    fixAvailable: true,
    fixVersion: "2.0.0",
    ...details,
  },
});

describe("dependency vulnerability scoring", () => {
  it("scores critical runtime vulnerabilities with a fix at P0 strength", () => {
    expect(dependencyVulnScore(item({}))).toBeGreaterThanOrEqual(130);
  });

  it("penalizes development scope", () => {
    expect(dependencyVulnScore(item({ scope: "development" })))
      .toBeLessThan(dependencyVulnScore(item({ scope: "runtime" })));
  });

  it("publishes its fields through the runtime catalog", () => {
    const fields = runtimeCatalog.fieldsFor("dependency-vuln");
    expect(fields.map((field) => field.name)).toEqual(expect.arrayContaining([
      "severity",
      "cvss",
      "fixAvailable",
      "scope",
    ]));
    expect(fields.find((field) => field.name === "severity")).toMatchObject({
      type: "enum",
      values: ["critical", "high", "medium", "low"],
    });
  });

  it("explains the same fixed-time score through additive factors", () => {
    const now = Date.parse("2026-01-01T00:00:00Z");
    const explanation = explainDependencyVulnScore(item({}), now);
    expect(explanation.score).toBe(dependencyVulnScore(item({}), now));
    expect(explanation.factors.reduce(
      (total, factor) => total + factor.contribution,
      0,
    )).toBe(explanation.score);
  });
});
