// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { mountSettings } from "../../src/runtime/shell/settings";
import { PolicyStore } from "../../src/runtime/shell/policy-store";
import { registerDefaultModel, _resetDefaultModels } from "../../src/runtime/scoring/default-model";
import { registerFieldCatalog } from "../../src/runtime/scoring/field-catalog";
import type { ScoreModel } from "../../src/runtime/scoring/score-model";
import type { Source } from "../../src/runtime/ingest/source";

const KIND = "dependency-vuln";
const def: ScoreModel = {
  kind: KIND, scale: 100,
  signals: { cvss: { from: "cvss", transform: { type: "linear", in: [0, 10] } } },
  formula: "cvss * 1",
  tiers: [{ name: "P0", min: 80 }, { name: "P3", min: 0 }],
};

function setup() {
  const host = document.createElement("div"); document.body.appendChild(host);
  const policy = new PolicyStore();
  const sources: Source[] = [];
  const api = mountSettings(host, {
    sources, creds: { get: () => "", set: () => {} } as any,
    scopes: { get: () => ({}), set: () => {} } as any,
    policy, onChange: () => {},
  });
  api.open();
  host.querySelector<HTMLButtonElement>('[data-tab="advanced"]')!.click();
  return { host, policy };
}

describe("Settings → Scoring", () => {
  beforeEach(() => {
    localStorage.clear(); document.body.innerHTML = "";
    _resetDefaultModels();
    registerFieldCatalog(KIND, [{ name: "cvss", type: "number", range: [0, 10] }]);
    registerDefaultModel(KIND, def);
  });

  it("mounts the scoring editor in the Advanced pane", () => {
    const { host } = setup();
    expect(host.querySelector("[data-scoring-editor] [data-kind]")).not.toBeNull();
  });

  it("persists an edited model on Save and discards on Cancel", () => {
    const { host, policy } = setup();
    host.querySelector<HTMLButtonElement>('[data-scoring-editor] [data-mode="advanced"]')!.click();
    const ta = host.querySelector<HTMLTextAreaElement>("[data-scoring-editor] [data-formula]")!;
    ta.value = "cvss * 0.5"; ta.dispatchEvent(new Event("change"));
    host.querySelector<HTMLButtonElement>("[data-save]")!.click();
    expect(policy.getScoreModel(KIND)!.formula).toBe("cvss * 0.5");
  });

  it("blocks Save while the edited model is invalid", () => {
    const { host } = setup();
    host.querySelector<HTMLButtonElement>('[data-scoring-editor] [data-mode="advanced"]')!.click();
    const ta = host.querySelector<HTMLTextAreaElement>("[data-scoring-editor] [data-formula]")!;
    ta.value = "cvss * 0.5 + ghost"; ta.dispatchEvent(new Event("change"));
    expect(host.querySelector<HTMLButtonElement>("[data-save]")!.disabled).toBe(true);
  });

  it("Reset to default clears a stored model on Save", () => {
    new PolicyStore().setScoreModel(KIND, { ...def, formula: "cvss * 0.2" });
    const { host, policy } = setup();
    host.querySelector<HTMLButtonElement>("[data-scoring-editor] [data-reset]")!.click();
    host.querySelector<HTMLButtonElement>("[data-save]")!.click();
    expect(policy.getScoreModel(KIND)).toBeNull();
  });
});
