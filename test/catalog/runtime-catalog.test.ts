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
  insights: {
    evidenced: (item) => item.title.length > 0,
  },
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
    const kind = issueKind();
    const provider = github();
    const catalog = createRuntimeCatalog({ kinds: [kind], providers: [provider] });

    expect(catalog.kind("issue")?.label).toBe("Issues");
    expect(catalog.readyKind("issue")?.renderer.kind).toBe("issue");
    expect(typeof catalog.insightsFor("issue")?.evidenced).toBe("function");
    expect(catalog.insightsFor("cloud-misconfig")).toBeUndefined();
    expect(catalog.artifact("issue")?.label).toBe("Issues");
    expect(catalog.provider("github")?.id).toBe("github");
    expect(catalog.fieldsFor("issue").map((field) => field.name))
      .toEqual(["signal", "createdAt"]);
    expect(Object.isFrozen(catalog.kinds())).toBe(true);
    expect(Object.isFrozen(catalog.artifacts())).toBe(true);
    expect(Object.isFrozen(catalog.providers())).toBe(true);
    expect(Object.isFrozen(catalog.readyKind("issue"))).toBe(true);
    expect(Object.isFrozen(catalog.readyKind("issue")?.fields)).toBe(true);
    expect(Object.isFrozen(catalog.provider("github")?.capabilities)).toBe(true);

    kind.label = "Mutated Kind";
    provider.label = "Mutated Provider";

    expect(catalog.kind("issue")?.label).toBe("Issues");
    expect(catalog.provider("github")?.label).toBe("GitHub");
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

  it("rejects a ready Kind without a built-in scorer", () => {
    const { builtInScorer: _, ...withoutScorer } = issueKind() as Extract<
      KindDeclaration,
      { status: "ready" }
    >;

    expect(() => createRuntimeCatalog({
      kinds: [withoutScorer as KindDeclaration],
      providers: [],
    })).toThrow(/issue.*builtInScorer/i);
  });

  it("rejects a ready Kind without its field catalog", () => {
    const { fields: _, ...withoutFields } = issueKind() as Extract<
      KindDeclaration,
      { status: "ready" }
    >;

    expect(() => createRuntimeCatalog({
      kinds: [withoutFields as KindDeclaration],
      providers: [],
    })).toThrow(/issue.*fields/i);
  });
});
