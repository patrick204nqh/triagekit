// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderInsights } from "../../src/runtime/layout/insights";
import type { ScoredItem } from "../../src/runtime/layout/triage-table";

const row: ScoredItem = { id: "x", source: "github", kind: "dependency-vuln", title: "p",
  location: "acme/web", signal: 50, createdAt: new Date().toISOString(), url: "", details: {}, score: 100, tier: "P1" };

describe("renderInsights", () => {
  it("renders a chart panel per applicable chart", () => {
    const root = document.createElement("div");
    renderInsights(root, [row], ["dependency-vuln"]);
    expect(root.querySelectorAll(".chart").length).toBeGreaterThanOrEqual(3); // ≥ the 3 generic
  });
  it("shows an empty note with no rows", () => {
    const root = document.createElement("div");
    renderInsights(root, [], ["dependency-vuln"]);
    expect(root.textContent).toMatch(/no/i);
  });
});
