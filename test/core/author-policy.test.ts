import { describe, it, expect } from "vitest";
import { classifyAuthor, withBotPolicy, adapterBotLogins } from "../../src/runtime/core/author-policy";
import type { Actor } from "../../src/runtime/dataset/shared";
import type { TriageItem, Kind } from "../../src/runtime/dataset/item";

const actor = (login: string, kind: Actor["kind"]): Actor => ({ login, avatarUrl: "", kind });

describe("classifyAuthor", () => {
  it("keeps adapter-flagged bots as bot", () => {
    expect(classifyAuthor(actor("dependabot[bot]", "bot"), [])).toBe("bot");
  });
  it("reclassifies allow-listed human logins as bot", () => {
    expect(classifyAuthor(actor("internal-deploy", "human"), ["internal-deploy"])).toBe("bot");
  });
  it("leaves non-listed humans as human", () => {
    expect(classifyAuthor(actor("alice", "human"), ["internal-deploy"])).toBe("human");
  });
});

describe("withBotPolicy", () => {
  const base: TriageItem = {
    id: "x", source: "github", kind: "change-request", title: "t", location: "acme/web",
    signal: 0, createdAt: "2026-01-01T00:00:00Z", url: "",
    details: { author: actor("internal-deploy", "human") },
  };

  it("returns a new item with reclassified author, without mutating the original", () => {
    const out = withBotPolicy(base, ["internal-deploy"]);
    expect((out.details as { author: Actor }).author.kind).toBe("bot");
    expect((base.details as { author: Actor }).author.kind).toBe("human");   // original untouched
  });

  it("returns the same item reference when there is no author or no change", () => {
    expect(withBotPolicy(base, [])).toBe(base);
    const noAuthor: TriageItem = { ...base, details: {} };
    expect(withBotPolicy(noAuthor, ["x"])).toBe(noAuthor);
  });
});

describe("adapterBotLogins", () => {
  const mk = (kind: Kind, login: string, akind: Actor["kind"]): TriageItem => ({
    id: login + kind, source: "github", kind, title: "", location: "", signal: 0, createdAt: "", url: "",
    details: { author: { login, avatarUrl: "", kind: akind } },
  });

  it("returns distinct, sorted adapter-flagged bot logins for active kinds", () => {
    const items = [
      mk("change-request", "dependabot[bot]", "bot"),
      mk("issue", "github-actions[bot]", "bot"),
      mk("change-request", "dependabot[bot]", "bot"),   // duplicate login
      mk("change-request", "alice", "human"),           // human excluded
    ];
    expect(adapterBotLogins(items, ["change-request", "issue"]))
      .toEqual(["dependabot[bot]", "github-actions[bot]"]);
  });

  it("omits adapter bots whose kind is not active", () => {
    const items = [mk("issue", "github-actions[bot]", "bot")];
    expect(adapterBotLogins(items, ["change-request"])).toEqual([]);
  });

  it("returns [] for empty input", () => {
    expect(adapterBotLogins([], ["change-request"])).toEqual([]);
  });
});
