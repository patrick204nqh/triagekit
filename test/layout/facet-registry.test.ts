import { describe, it, expect } from "vitest";
import {
  listFilterAxes, getFilterAxis, listSortKeys, getSortKey, type AxisCtx,
} from "../../src/runtime/layout/facet-registry";
import type { ScoredItem } from "../../src/runtime/layout/triage-table";
import type { Artifact } from "../../src/runtime/dataset/artifact";

const reviewArtifact: Artifact = { id: "review", label: "Review", group: "work", kinds: ["pull-request", "issue"] };
const vulnArtifact: Artifact = { id: "vulnerabilities", label: "Vulnerabilities", group: "findings", kinds: ["dependency-vuln", "code-scanning"] };

function row(over: Partial<ScoredItem> & { details?: unknown }): ScoredItem {
  return {
    id: "x", source: "github", kind: "pull-request", title: "t", location: "acme/web",
    signal: 0, createdAt: "2026-01-01T00:00:00Z", url: "", details: {}, score: 50, tier: "P2", ...over,
  } as ScoredItem;
}

describe("facet-registry built-ins", () => {
  const rows: ScoredItem[] = [
    row({ id: "a", location: "acme/web", kind: "pull-request", tier: "P0", details: { author: { kind: "human" } } }),
    row({ id: "b", location: "acme/api", kind: "issue",        tier: "P2", details: { author: { kind: "bot" } } }),
  ];
  const rctx: AxisCtx = { artifact: reviewArtifact };

  it("registers provider/scope/kind/tier/author axes and priority/recent sorts", () => {
    expect(getFilterAxis("provider")).toBeDefined();
    expect(getFilterAxis("scope")).toBeDefined();
    expect(getFilterAxis("kind")).toBeDefined();
    expect(getFilterAxis("tier")).toBeDefined();
    expect(getFilterAxis("author")).toBeDefined();
    expect(getSortKey("priority")).toBeDefined();
    expect(getSortKey("recent")).toBeDefined();
  });

  it("scope is always applicable and lists distinct locations", () => {
    const scope = getFilterAxis("scope")!;
    expect(scope.appliesTo(rows, rctx)).toBe(true);
    expect(scope.optionsFrom(rows, rctx).map(o => o.value)).toEqual(["acme/api", "acme/web"]);
    expect(scope.test(rows[0], ["acme/web"])).toBe(true);
    expect(scope.test(rows[0], ["acme/api"])).toBe(false);
  });

  it("kind applies only when the artifact bundles >=2 kinds", () => {
    const kind = getFilterAxis("kind")!;
    expect(kind.appliesTo(rows, rctx)).toBe(true);
    expect(kind.appliesTo(rows, { artifact: { id: "t", label: "Tasks", group: "work", kinds: ["work-item"] } })).toBe(false);
    expect(kind.test(rows[1], ["issue"])).toBe(true);
  });

  it("author applies only when all rows carry author.kind", () => {
    const author = getFilterAxis("author")!;
    expect(author.appliesTo(rows, rctx)).toBe(true);
    expect(author.appliesTo([row({ kind: "dependency-vuln", details: {} })], { artifact: vulnArtifact })).toBe(false);
    expect(author.test(rows[1], ["bot"])).toBe(true);
  });

  it("provider applies only when >=2 distinct providers are present", () => {
    const provider = getFilterAxis("provider");
    expect(provider).toBeDefined();
    // single provider -> auto-hidden
    expect(provider!.appliesTo([row({ source: "github" })], rctx)).toBe(false);
    // two providers -> shown, options distinct + sorted
    const multi = [row({ id: "a", source: "github" }), row({ id: "b", source: "gitlab" })];
    expect(provider!.appliesTo(multi, rctx)).toBe(true);
    expect(provider!.optionsFrom(multi, rctx).map(o => o.value)).toEqual(["github", "gitlab"]);
    expect(provider!.test(row({ source: "gitlab" }), ["gitlab"])).toBe(true);
    expect(provider!.test(row({ source: "github" }), ["gitlab"])).toBe(false);
  });

  it("tier is always applicable with the 4 fixed options", () => {
    const tier = getFilterAxis("tier")!;
    expect(tier.appliesTo(rows, rctx)).toBe(true);
    expect(tier.optionsFrom(rows, rctx).map(o => o.value)).toEqual(["P0", "P1", "P2", "P3"]);
    expect(tier.test(rows[0], ["P0", "P1"])).toBe(true);
    expect(tier.test(rows[1], ["P0"])).toBe(false);
  });

  it("sort keys order rows", () => {
    const pri = getSortKey("priority")!, rec = getSortKey("recent")!;
    const r = [row({ id: "a", score: 10, createdAt: "2026-01-01T00:00:00Z" }), row({ id: "b", score: 90, createdAt: "2026-03-01T00:00:00Z" })];
    expect([...r].sort(pri.compare).map(x => x.id)).toEqual(["b", "a"]);
    expect([...r].sort(rec.compare).map(x => x.id)).toEqual(["b", "a"]);
  });

  it("listFilterAxes/listSortKeys include the built-ins", () => {
    expect(listFilterAxes().map(a => a.id)).toEqual(expect.arrayContaining(["provider", "scope", "kind", "tier", "author"]));
    expect(listSortKeys().map(s => s.id)).toEqual(expect.arrayContaining(["priority", "recent"]));
  });
});
