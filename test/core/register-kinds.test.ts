// test/core/register-kinds.test.ts
import { describe, it, expect } from "vitest";
import { registerKinds } from "../../src/runtime/core/register-kinds";
import { resolveScorer } from "../../src/runtime/scoring/registry";
import { fieldsFor } from "../../src/runtime/scoring/field-catalog";
import type { KindManifest } from "../../src/runtime/core/manifest";
import type { TriageItem } from "../../src/runtime/dataset/item";

const m: KindManifest = {
  kind: "issue",
  domain: "tracking",
  fields: [{ name: "labels", type: "enum" }],
  builtInScorer: (i: TriageItem) => i.signal + 1,
  renderer: { kind: "issue" },
};

describe("registerKinds", () => {
  it("registers the scorer and field catalog from a manifest", () => {
    registerKinds([m]);
    expect(resolveScorer("issue")({ signal: 5 } as TriageItem)).toBe(6);
    expect(fieldsFor("issue").some(f => f.name === "labels")).toBe(true);
  });

  it("throws when a manifest is missing a required piece", () => {
    const bad = { ...m, renderer: undefined } as unknown as KindManifest;
    expect(() => registerKinds([bad])).toThrow(/issue.*renderer/i);
  });
});
