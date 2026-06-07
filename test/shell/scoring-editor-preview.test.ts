// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { mountScoringEditor } from "../../src/runtime/shell/scoring-editor";
import { registerDefaultModel, _resetDefaultModels } from "../../src/runtime/scoring/default-model";
import { registerFieldCatalog } from "../../src/runtime/scoring/field-catalog";
import type { ScoreModel } from "../../src/runtime/scoring/score-model";
import type { TriageItem } from "../../src/runtime/dataset/item";

const KIND = "dependency-vuln";
const def: ScoreModel = {
  kind: KIND, scale: 100,
  signals: { cvss: { from: "cvss", transform: { type: "linear", in: [0, 10] } } },
  formula: "cvss * 1",
  tiers: [{ name: "P0", min: 80 }, { name: "P1", min: 50 }, { name: "P2", min: 25 }, { name: "P3", min: 0 }],
};
const item = (id: string, cvss: number): TriageItem => ({
  id, source: "github", kind: KIND, title: `pkg-${id}`, location: "acme/web",
  signal: 0, createdAt: "2026-01-01T00:00:00Z", url: "", details: { cvss },
});

function harness(rows: TriageItem[], initialDrafts: Record<string, ScoreModel> = {}) {
  const drafts = new Map<string, ScoreModel>(Object.entries(initialDrafts));
  const host = document.createElement("div");
  const editor = mountScoringEditor(host, {
    getDraft: (k) => drafts.get(k) ?? null,
    setDraft: (k, m) => { drafts.set(k, m); },
    clearDraft: () => {},
    onChange: () => {},
    previewRows: (k) => rows.filter(r => r.kind === k),
  });
  editor.render();
  return { host, drafts };
}

describe("scoring editor — live preview", () => {
  beforeEach(() => {
    _resetDefaultModels();
    registerFieldCatalog(KIND, [{ name: "cvss", type: "number", range: [0, 10] }]);
    registerDefaultModel(KIND, def);
  });

  it("lists loaded rows re-ranked by the model (highest score first)", () => {
    const { host } = harness([item("low", 2), item("high", 9)]);
    const titles = [...host.querySelectorAll("[data-preview] .pv-title")].map(e => e.textContent);
    expect(titles).toEqual(["pkg-high", "pkg-low"]);
    expect(host.querySelector("[data-preview] .tier")).not.toBeNull();
  });
  it("shows an empty-state when no rows are loaded for the kind", () => {
    const { host } = harness([]);
    expect(host.querySelector("[data-preview]")!.textContent).toContain("No loaded");
  });
  it("shows a guard message instead of evaluating an invalid draft", () => {
    const { host } = harness([item("a", 5)], { [KIND]: { ...def, formula: "cvss + ghost" } });
    host.querySelector<HTMLButtonElement>('[data-mode="advanced"]')!.click();   // custom/invalid → advanced
    expect(host.querySelector("[data-preview]")!.textContent).toContain("Fix the errors");
  });
  it("re-ranks during a slider drag without removing the slider", () => {
    const { host } = harness([item("a", 5), item("b", 5)]);
    const slider = host.querySelector<HTMLInputElement>('[data-weight="cvss"]')!;
    slider.value = "0.5"; slider.dispatchEvent(new Event("input"));
    expect(host.querySelector('[data-weight="cvss"]')).not.toBeNull();   // slider survived
    expect(host.querySelectorAll("[data-preview] .pv-title").length).toBe(2);
  });
});
