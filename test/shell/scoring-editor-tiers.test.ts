// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { mountScoringEditor } from "../../src/runtime/shell/scoring-editor";
import { registerDefaultModel, _resetDefaultModels } from "../../src/runtime/scoring/default-model";
import { registerFieldCatalog } from "../../src/runtime/scoring/field-catalog";
import type { ScoreModel } from "../../src/runtime/scoring/score-model";

const KIND = "dependency-vuln";
const def: ScoreModel = {
  kind: KIND, scale: 100,
  signals: { cvss: { from: "cvss", transform: { type: "linear", in: [0, 10] } } },
  formula: "cvss * 1",
  tiers: [{ name: "P0", min: 80 }, { name: "P1", min: 50 }, { name: "P2", min: 25 }, { name: "P3", min: 0 }],
};

function harness(initialDrafts: Record<string, ScoreModel> = {}) {
  const drafts = new Map<string, ScoreModel>(Object.entries(initialDrafts));
  const host = document.createElement("div");
  const editor = mountScoringEditor(host, {
    getDraft: (k) => drafts.get(k) ?? null,
    setDraft: (k, m) => { drafts.set(k, m); },
    clearDraft: () => {},
    onChange: () => {},
  });
  editor.render();
  return { host, drafts };
}

describe("scoring editor — tier bands", () => {
  beforeEach(() => {
    _resetDefaultModels();
    registerFieldCatalog(KIND, [{ name: "cvss", type: "number", range: [0, 10] }]);
    registerDefaultModel(KIND, def);
  });

  it("renders P0/P1/P2 min inputs seeded from the model, P3 as floor", () => {
    const { host } = harness();
    host.querySelector<HTMLButtonElement>("[data-customize]")!.click();
    expect(host.querySelector<HTMLInputElement>('[data-tier-min="P0"]')!.value).toBe("80");
    expect(host.querySelector<HTMLInputElement>('[data-tier-min="P1"]')!.value).toBe("50");
    expect(host.querySelector<HTMLInputElement>('[data-tier-min="P2"]')!.value).toBe("25");
    expect(host.querySelector('[data-tier-min="P3"]')).toBeNull();   // P3 is a fixed floor, not editable
  });
  it("editing a cutoff stages a draft with the new min and P3 floor preserved", () => {
    const { host, drafts } = harness();
    host.querySelector<HTMLButtonElement>("[data-customize]")!.click();
    const p0 = host.querySelector<HTMLInputElement>('[data-tier-min="P0"]')!;
    p0.value = "90"; p0.dispatchEvent(new Event("change"));
    expect(drafts.get(KIND)!.tiers).toEqual([
      { name: "P0", min: 90 }, { name: "P1", min: 50 }, { name: "P2", min: 25 }, { name: "P3", min: 0 },
    ]);
  });
  it("surfaces the existing 'decrease' error for non-decreasing cutoffs", () => {
    const { host } = harness();
    host.querySelector<HTMLButtonElement>("[data-customize]")!.click();
    const p0 = host.querySelector<HTMLInputElement>('[data-tier-min="P0"]')!;
    p0.value = "40"; p0.dispatchEvent(new Event("change"));   // 40 < P1's 50
    expect(host.querySelector("[data-errors]")!.textContent).toContain("decrease");
  });
  it("flags non-decreasing cutoffs inline AND keeps the model-error path", () => {
    const { host } = harness();
    host.querySelector<HTMLButtonElement>("[data-customize]")!.click();
    const p1 = host.querySelector<HTMLInputElement>('[data-tier-min="P1"]')!;
    p1.value = "90"; p1.dispatchEvent(new Event("change"));   // P1 90 >= P0 80 — non-decreasing

    // inline mirror: a marker appears near the inputs and offending inputs are flagged
    expect(host.querySelector("[data-tier-invalid]")).not.toBeNull();
    const flagged = host.querySelectorAll('[data-tier-min][aria-invalid="true"]');
    expect(flagged.length).toBeGreaterThan(0);

    // existing validator path still surfaces the error (we mirrored, not replaced)
    expect(host.querySelector("[data-errors]")!.textContent).toContain("decrease");
  });
  it("no inline marker and no aria-invalid when cutoffs strictly decrease", () => {
    const { host } = harness();
    host.querySelector<HTMLButtonElement>("[data-customize]")!.click();
    const p0 = host.querySelector<HTMLInputElement>('[data-tier-min="P0"]')!;
    p0.value = "85"; p0.dispatchEvent(new Event("change"));   // 85 > 50 > 25 > 0 — valid

    expect(host.querySelector("[data-tier-invalid]")).toBeNull();
    expect(host.querySelectorAll('[data-tier-min][aria-invalid="true"]').length).toBe(0);
  });
});
