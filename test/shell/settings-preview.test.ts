// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { mountSettings } from "../../src/runtime/shell/settings";
import { PolicyStore } from "../../src/runtime/shell/policy-store";
import { registerDefaultModel, _resetDefaultModels } from "../../src/runtime/scoring/default-model";
import { registerFieldCatalog } from "../../src/runtime/scoring/field-catalog";
import type { ScoreModel } from "../../src/runtime/scoring/score-model";
import type { ScoredItem } from "../../src/runtime/layout/table/kind-renderer";
import type { Source } from "../../src/runtime/ingest/source";

const KIND = "dependency-vuln";
const def: ScoreModel = {
  kind: KIND, scale: 100,
  signals: { cvss: { from: "cvss", transform: { type: "linear", in: [0, 10] } } },
  formula: "cvss * 1",
  tiers: [{ name: "P0", min: 80 }, { name: "P3", min: 0 }],
};
const row = (id: string, cvss: number): ScoredItem => ({
  id, source: "github", kind: KIND, title: `pkg-${id}`, location: "acme/web",
  signal: 0, createdAt: "2026-01-01T00:00:00Z", url: "", details: { cvss }, score: 0, tier: "P3",
});

function setup(rows: ScoredItem[]) {
  const host = document.createElement("div"); document.body.appendChild(host);
  const policy = new PolicyStore();
  const api = mountSettings(host, {
    sources: [] as Source[], creds: { get: () => "", set: () => {} } as any,
    scopes: { get: () => ({}), set: () => {} } as any,
    policy, onChange: () => {}, getRows: () => rows,
  });
  api.open();
  host.querySelector<HTMLButtonElement>('[data-category="scoring"]')!.click();
  return { host };
}

describe("Settings → scoring preview wiring", () => {
  beforeEach(() => {
    localStorage.clear(); document.body.innerHTML = "";
    _resetDefaultModels();
    registerFieldCatalog(KIND, [{ name: "cvss", type: "number", range: [0, 10] }]);
    registerDefaultModel(KIND, def);
  });

  it("feeds getRows (filtered to the active kind) into the editor preview", () => {
    const { host } = setup([row("low", 2), row("high", 9)]);
    host.querySelector<HTMLButtonElement>("[data-scoring-editor] [data-customize]")!.click();
    const titles = [...host.querySelectorAll("[data-scoring-editor] [data-preview] .pv-title")].map(e => e.textContent);
    expect(titles).toEqual(["pkg-high", "pkg-low"]);
  });
});
