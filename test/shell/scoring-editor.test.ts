// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { mountScoringEditor } from "../../src/runtime/shell/scoring-editor";
import { registerDefaultModel, _resetDefaultModels } from "../../src/runtime/scoring/default-model";
import { registerFieldCatalog } from "../../src/runtime/scoring/field-catalog";
import type { ScoreModel } from "../../src/runtime/scoring/score-model";

const KIND = "dependency-vuln";
const def: ScoreModel = {
  kind: KIND, scale: 100,
  signals: {
    severity: { from: "severity", transform: { type: "enum", map: { critical: 1, high: 0.7 } } },
    cvss: { from: "cvss", transform: { type: "linear", in: [0, 10] } },
  },
  formula: "severity * 0.6 + cvss * 0.4",
  tiers: [{ name: "P0", min: 80 }, { name: "P3", min: 0 }],
};

function harness(initialDrafts: Record<string, ScoreModel> = {}) {
  const drafts = new Map<string, ScoreModel>(Object.entries(initialDrafts));
  const cleared = new Set<string>();
  const host = document.createElement("div");
  const editor = mountScoringEditor(host, {
    getDraft: (k) => drafts.get(k) ?? null,
    setDraft: (k, m) => { drafts.set(k, m); cleared.delete(k); },
    clearDraft: (k) => { cleared.add(k); drafts.delete(k); },
    onChange: () => {},
  });
  editor.render();
  return { host, editor, drafts, cleared };
}

describe("mountScoringEditor", () => {
  beforeEach(() => {
    _resetDefaultModels();
    registerFieldCatalog(KIND, [
      { name: "severity", type: "enum", values: ["critical", "high", "medium", "low"] },
      { name: "cvss", type: "number", range: [0, 10] },
      { name: "fixAvailable", type: "bool" },
    ]);
    registerDefaultModel(KIND, def);
  });

  it("lists kinds with a published default and seeds from the default model", () => {
    const { host } = harness();
    const sel = host.querySelector<HTMLSelectElement>("[data-kind]")!;
    expect([...sel.options].map(o => o.value)).toEqual([KIND]);
    expect(host.querySelectorAll("[data-weight]").length).toBe(2);   // simple mode: a slider per signal
  });

  it("simple-mode slider updates the draft formula via weightsToFormula", () => {
    const { host, drafts } = harness();
    const slider = host.querySelector<HTMLInputElement>('[data-weight="severity"]')!;
    slider.value = "0.8"; slider.dispatchEvent(new Event("input"));
    expect(drafts.get(KIND)!.formula).toBe("severity * 0.8 + cvss * 0.4");
  });

  it("disables simple mode for a custom (non-weighted-sum) formula", () => {
    const { host } = harness({ [KIND]: { ...def, formula: "(severity * 0.6 + cvss * 0.4) * 100" } });
    expect(host.querySelector("[data-simple-disabled]")).not.toBeNull();
    expect(host.querySelector("[data-weight]")).toBeNull();
  });

  it("advanced-mode formula edit updates the draft and surfaces validation errors", () => {
    const { host, drafts } = harness();
    host.querySelector<HTMLButtonElement>('[data-mode="advanced"]')!.click();
    const ta = host.querySelector<HTMLTextAreaElement>("[data-formula]")!;
    ta.value = "severity * 0.6 + mystery * 0.4"; ta.dispatchEvent(new Event("change"));
    expect(drafts.get(KIND)!.formula).toContain("mystery");
    expect(host.querySelector("[data-errors]")!.textContent).toContain("unknown signal");
  });

  it("reset stages a clear of the draft", () => {
    const { host, cleared } = harness({ [KIND]: { ...def, formula: "cvss * 1" } });
    host.querySelector<HTMLButtonElement>("[data-reset]")!.click();
    expect(cleared.has(KIND)).toBe(true);
  });

  it("renders nothing actionable when no kind has a default", () => {
    _resetDefaultModels();
    const { host } = harness();
    expect(host.querySelector("[data-kind]")).toBeNull();
    expect(host.textContent).toContain("No configurable");
  });
});
