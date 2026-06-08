// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderScoreBreakdown } from "../../src/runtime/layout/table/score-breakdown";
import type { ScoredItem } from "../../src/runtime/layout/table/kind-renderer";
import type { ScoreExplanation } from "../../src/runtime/scoring/score-model";

const item = { id: "x", source: "github", kind: "dependency-vuln", title: "lodash",
  location: "acme/web", signal: 0, createdAt: "", url: "", details: {}, score: 142, tier: "P0" } as ScoredItem;

describe("renderScoreBreakdown", () => {
  it("renders a per-signal table and the score → tier line when given an explanation", () => {
    const ex: ScoreExplanation = { score: 142, signals: { severity: { from: "severity", raw: "critical", value: 1 } } };
    const host = document.createElement("div");
    renderScoreBreakdown(host, item, ex);
    expect(host.querySelector(".breakdown")).not.toBeNull();
    expect(host.textContent).toContain("severity");
    expect(host.textContent).toContain("critical");
    expect(host.textContent).toContain("142");
    expect(host.querySelector(".tier-P0")).not.toBeNull();
  });
  it("renders the built-in note (no table) when explanation is null", () => {
    const host = document.createElement("div");
    renderScoreBreakdown(host, item, null);
    expect(host.querySelector(".breakdown")).toBeNull();
    expect(host.textContent).toContain("Built-in scorer");
    expect(host.textContent).toContain("142");
  });
});
