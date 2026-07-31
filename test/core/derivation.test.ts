// test/core/derivation.test.ts
import { describe, it, expect } from "vitest";
import { derive } from "../../src/runtime/core/derivation";
import { emptyListState } from "../../src/runtime/layout/toolbar/filter-state";
import type { TriageItem } from "../../src/runtime/dataset/item";
import type { ScoreContext } from "../../src/runtime/scoring/configured";

const item = (
  id: string,
  signal: number,
  kind: TriageItem["kind"] = "issue",
  location = "repo",
): TriageItem => ({
  id, provider: "github", providerRef: {}, kind, title: id, location,
  signal, createdAt: "2026-01-01T00:00:00Z", url: "", details: {},
});

// Built-in scorer override: score = signal; thresholds put >=50 at P1, >=80 at P0.
const score: ScoreContext = {
  getModel: () => null,
  getFields: () => [],
  getThresholds: () => ({ p0: 80, p1: 50, p2: 20 }),
  override: (it) => it.signal,
};
const focusPolicy = {
  provider: "github",
  repositoryOrder: [] as string[],
  labels: { include: [] as string[], exclude: [] as string[], enabled: true },
};

describe("derive", () => {
  it("derives repository-first order before applying display scope", () => {
    const out = derive({
      items: [
        item("web-p0", 100, "issue", "acme-corp/web"),
        item("core-p2", 20, "issue", "acme-corp/core"),
      ],
      activeKinds: ["issue"],
      botLogins: [],
      score,
      repoView: "",
      filters: emptyListState(),
      focusPolicy: {
        provider: "github",
        repositoryOrder: ["acme-corp/core", "acme-corp/web"],
        labels: { include: [], exclude: [], enabled: true },
      },
    });
    expect(out.scored.map((row) => row.id)).toEqual(["core-p2", "web-p0"]);
  });

  it("filters to active kinds, scores, and sorts descending", () => {
    const out = derive({
      items: [item("a", 10), item("b", 90), item("c", 50, "change-request")],
      activeKinds: ["issue"],
      botLogins: [],
      score,
      repoView: "",
      filters: emptyListState(),
      focusPolicy,
    });
    expect(out.scored.map(r => r.id)).toEqual(["b", "a"]); // change-request filtered out, sorted desc
    expect(out.scored.map(r => r.score)).toEqual([90, 10]);
    expect(out.scored[0].tier).toBe("P0");
  });

  it("applies configured bot policy before scoring", () => {
    const bot = item("bot", 50);
    bot.details = {
      author: { login: "deploy", avatarUrl: "", kind: "human" },
    };
    const out = derive({
      items: [bot],
      activeKinds: ["issue"],
      botLogins: ["deploy"],
      score,
      repoView: "",
      filters: emptyListState(),
      focusPolicy,
    });
    expect(
      (out.scored[0].details as { author: { kind: string } }).author.kind,
    ).toBe("bot");
  });

  it("shown equals scored when no filters are active", () => {
    const out = derive({
      items: [item("a", 10), item("b", 90)],
      activeKinds: ["issue"],
      botLogins: [],
      score,
      repoView: "",
      filters: emptyListState(),
      focusPolicy,
    });
    expect(out.shown.map(r => r.id)).toEqual(out.scored.map(r => r.id));
  });

  it("is pure: does not mutate the input items array", () => {
    const items = [item("a", 10), item("b", 90)];
    const before = items.map(i => i.id);
    derive({ items, activeKinds: ["issue"], botLogins: [], score, repoView: "", filters: emptyListState(), focusPolicy });
    expect(items.map(i => i.id)).toEqual(before);
  });

  it("repo scope filters shown to a single location", () => {
    const items: TriageItem[] = [
      { id: "a", provider: "github", providerRef: {}, kind: "issue", title: "a", location: "acme/api", signal: 90, createdAt: "2026-01-01T00:00:00Z", url: "", details: {} },
      { id: "b", provider: "github", providerRef: {}, kind: "issue", title: "b", location: "acme/web", signal: 80, createdAt: "2026-01-01T00:00:00Z", url: "", details: {} },
    ];
    const out = derive({ items, activeKinds: ["issue"], botLogins: [], score, repoView: "acme/api", filters: emptyListState(), focusPolicy });
    expect(out.shown.map(r => r.id)).toEqual(["a"]);
    expect(out.scored.map(r => r.id)).toEqual(["a", "b"]); // scored is unscoped
  });

  it("empty repo scope shows all locations (filter-only result)", () => {
    const items: TriageItem[] = [
      { id: "a", provider: "github", providerRef: {}, kind: "issue", title: "a", location: "acme/api", signal: 90, createdAt: "2026-01-01T00:00:00Z", url: "", details: {} },
      { id: "b", provider: "github", providerRef: {}, kind: "issue", title: "b", location: "acme/web", signal: 80, createdAt: "2026-01-01T00:00:00Z", url: "", details: {} },
    ];
    const out = derive({ items, activeKinds: ["issue"], botLogins: [], score, repoView: "", filters: emptyListState(), focusPolicy });
    expect(out.shown.map(r => r.id)).toEqual(["a", "b"]);
  });

  it("repo scope absent from the set shows all (auto-fallback, not empty)", () => {
    const items: TriageItem[] = [
      { id: "a", provider: "github", providerRef: {}, kind: "issue", title: "a", location: "acme/api", signal: 90, createdAt: "2026-01-01T00:00:00Z", url: "", details: {} },
      { id: "b", provider: "github", providerRef: {}, kind: "issue", title: "b", location: "acme/web", signal: 80, createdAt: "2026-01-01T00:00:00Z", url: "", details: {} },
    ];
    const out = derive({ items, activeKinds: ["issue"], botLogins: [], score, repoView: "acme/NOPE", filters: emptyListState(), focusPolicy });
    expect(out.shown.map(r => r.id)).toEqual(["a", "b"]); // falls back to all, not empty
  });
});
