import { describe, it, expect } from "vitest";
import { classifyAuthor, withBotPolicy } from "../../src/runtime/shell/author-policy";
import type { Actor } from "../../src/runtime/dataset/shared";
import type { TriageItem } from "../../src/runtime/dataset/item";

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
    id: "x", source: "github", kind: "pull-request", title: "t", location: "acme/web",
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
