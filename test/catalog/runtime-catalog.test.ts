import { describe, expect, it } from "vitest";
import { runtimeDefaults } from "../../src/runtime/catalog/defaults";
import { createRuntimeCatalog } from "../../src/runtime/catalog/runtime-catalog";
import type {
  KindDeclaration,
  ProviderDeclaration,
} from "../../src/runtime/catalog/types";

const issueKind = (): KindDeclaration => ({
  kind: "issue",
  domain: "tracking",
  label: "Issues",
  status: "ready",
  fields: [],
  builtInScorer: (item) => item.signal,
  renderer: { kind: "issue" },
  filters: [],
  sorts: [],
  charts: [],
  views: [],
});

const github = (): ProviderDeclaration => ({
  id: "github",
  label: "GitHub",
  status: "ready",
  kinds: ["issue"],
  connection: { setupHint: "Token", scopeFields: [] },
  capabilities: { discoverScope: false, enrich: [], actions: {} },
  adapter: {
    refresh: async () => [{
      kind: "issue",
      status: "success",
      items: [],
      failures: [],
    }],
  },
});

describe("createRuntimeCatalog", () => {
  it("returns immutable Kind, Artifact, and Provider readers", () => {
    const catalog = createRuntimeCatalog({
      kinds: [issueKind()],
      providers: [github()],
    });

    expect(catalog.kind("issue")?.label).toBe("Issues");
    expect(catalog.readyKind("issue")?.renderer.kind).toBe("issue");
    expect(catalog.artifact("issue")?.label).toBe("Issues");
    expect(catalog.provider("github")?.id).toBe("github");
    expect(catalog.fieldsFor("issue").map((field) => field.name))
      .toEqual(["signal", "createdAt"]);
    expect(Object.isFrozen(catalog.kinds())).toBe(true);
    expect(Object.isFrozen(catalog.artifacts())).toBe(true);
    expect(Object.isFrozen(catalog.providers())).toBe(true);
  });

  it("exposes generic runtime behavior from explicit defaults", () => {
    const catalog = createRuntimeCatalog({
      kinds: [issueKind()],
      providers: [github()],
      defaults: runtimeDefaults,
    });

    expect(catalog.filter("tier")?.label).toBe("Priority");
    expect(catalog.sort("priority")?.label).toBe("Priority");
    expect(catalog.tabs().map((tab) => tab.id)).toContain("due-soon");
  });

  it("rejects duplicate Kind identifiers", () => {
    expect(() => createRuntimeCatalog({
      kinds: [issueKind(), issueKind()],
      providers: [],
    })).toThrow(/duplicate kind.*issue/i);
  });

  it("rejects Providers that reference unregistered Kinds", () => {
    expect(() => createRuntimeCatalog({
      kinds: [issueKind()],
      providers: [{ ...github(), kinds: ["code-scanning"] }],
    })).toThrow(/github.*code-scanning.*unregistered/i);
  });

  it("rejects ready Providers without adapters", () => {
    const { adapter: _, ...withoutAdapter } = github();
    expect(() => createRuntimeCatalog({
      kinds: [issueKind()],
      providers: [withoutAdapter],
    })).toThrow(/github.*adapter/i);
  });
});
