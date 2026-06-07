import { describe, it, expect } from "vitest";
import { reviewScore } from "../../src/runtime/scoring/review";
import { tierOf } from "../../src/runtime/scoring/tier";
import type { TriageItem } from "../../src/runtime/dataset/item";
import type { ReviewDetails } from "../../src/runtime/dataset/kinds/review";

const now = new Date().toISOString();
function item(over: Partial<ReviewDetails> = {}, kind: "change-request" | "issue" = "change-request", createdAt = now): TriageItem<ReviewDetails> {
  return {
    id: "github:acme/web:1", source: "github", kind, title: "t", location: "acme/web",
    signal: 0, createdAt, url: "",
    details: {
      number: 1, state: "open", body: "", author: { login: "marta", avatarUrl: "", kind: "human" },
      assignees: [], reviewers: [], comments: 0, labels: [], checks: null, permalinks: [], relations: [],
      ...over,
    },
  };
}

describe("reviewScore", () => {
  const vulnLinked = reviewScore(item({ relations: [{ fromId: "a", toId: "github:acme/web:1", type: "fixes" }] }));
  const securityLabeled = reviewScore(item({ labels: [{ name: "security", color: "d6504a" }] }, "issue"));
  const stale = reviewScore(item({}, "issue", new Date(Date.now() - 60 * 86400000).toISOString()));
  const botPlain = reviewScore(item({ author: { login: "dependabot[bot]", avatarUrl: "", kind: "bot" } }));

  it("ranks vuln-linked > security-labeled > stale > bot-damped", () => {
    expect(vulnLinked).toBeGreaterThan(securityLabeled);
    expect(securityLabeled).toBeGreaterThan(stale);
    expect(stale).toBeGreaterThan(botPlain);
  });
  it("tiers a vuln-linked PR into the upper bands", () => {
    expect(["P0", "P1"]).toContain(tierOf(vulnLinked));
  });
  it("does not damp a bot PR that fixes a vuln", () => {
    const botFixing = reviewScore(item({
      author: { login: "dependabot[bot]", avatarUrl: "", kind: "bot" },
      relations: [{ fromId: "a", toId: "github:acme/web:1", type: "fixes" }],
    }));
    expect(botFixing).toBeGreaterThan(botPlain);
  });
});
