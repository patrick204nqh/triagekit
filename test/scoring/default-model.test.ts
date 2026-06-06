import { describe, it, expect, beforeEach } from "vitest";
import {
  registerDefaultModel, defaultModelFor, listDefaultModels, _resetDefaultModels,
} from "../../src/runtime/scoring/default-model";
import type { ScoreModel } from "../../src/runtime/scoring/score-model";

const model: ScoreModel = {
  kind: "dependency-vuln", scale: 100, formula: "cvss * 1",
  signals: { cvss: { from: "cvss", transform: { type: "linear", in: [0, 10] } } },
  tiers: [{ name: "P0", min: 80 }, { name: "P3", min: 0 }],
};

describe("default-model registry", () => {
  beforeEach(() => _resetDefaultModels());

  it("returns null when no default is registered", () => {
    expect(defaultModelFor("dependency-vuln")).toBeNull();
  });
  it("registers and retrieves a default per kind", () => {
    registerDefaultModel("dependency-vuln", model);
    expect(defaultModelFor("dependency-vuln")).toEqual(model);
  });
  it("lists registered defaults", () => {
    registerDefaultModel("dependency-vuln", model);
    expect(listDefaultModels()).toEqual([["dependency-vuln", model]]);
  });
});
