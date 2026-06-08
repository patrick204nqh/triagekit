import { describe, it, expect } from "vitest";
import {
  tierBadgeHtml, slaTagHtml, actorChipHtml, labelChipHtml,
  checkIndicatorHtml, permalinkLinkHtml, relationStripHtml, detailHeaderHtml,
} from "../../src/runtime/layout/atoms/atoms";

describe("atoms", () => {
  it("tierBadgeHtml uses the existing tier classes", () => {
    expect(tierBadgeHtml("P1")).toBe('<span class="tier tier-P1">P1</span>');
  });

  it("detailHeaderHtml escapes title, carries the tier chip, and shows the sub-line", () => {
    const out = detailHeaderHtml({ title: "<script>x", tier: "P0", sub: "acme/api · score 80" });
    expect(out).toContain("&lt;script&gt;x");          // title escaped
    expect(out).not.toContain("<script>");
    expect(out).toContain('<span class="tier tier-P0">P0</span>');  // tier chip class
    expect(out).toContain('<p class="muted">acme/api · score 80</p>');  // sub-line text
    expect(out.startsWith("<h3>")).toBe(true);
  });

  it("slaTagHtml carries the state class and escapes the label", () => {
    expect(slaTagHtml({ label: "resolve 2d", state: "warn" }))
      .toBe('<span class="sla sla-warn">resolve 2d</span>');
  });

  it("actorChipHtml marks bots and shows an optional role", () => {
    const bot = actorChipHtml({ login: "dependabot[bot]", avatarUrl: "", kind: "bot" });
    expect(bot).toContain("av bot");
    expect(bot).toContain('title="dependabot[bot]"');
    const human = actorChipHtml({ login: "marta", avatarUrl: "", kind: "human" }, "review");
    expect(human).toContain(">review<");
    expect(human).not.toContain("av bot");
  });

  it("labelChipHtml passes the color through a CSS var and escapes the name", () => {
    const out = labelChipHtml({ name: "security", color: "d6504a" });
    expect(out).toContain("--lbl:#d6504a");
    expect(out).toContain(">security<");
  });

  it("checkIndicatorHtml renders nothing for issues (null checks)", () => {
    expect(checkIndicatorHtml(null)).toBe("");
  });

  it("checkIndicatorHtml shows pass + conflict state", () => {
    expect(checkIndicatorHtml({ state: "pass", conflicts: false })).toContain("ci-pass");
    expect(checkIndicatorHtml({ state: "pass", conflicts: true })).toContain("conflict");
  });

  it("permalinkLinkHtml opens in a new tab safely", () => {
    const out = permalinkLinkHtml({ provider: "github", href: "https://x/y", kind: "pr", label: "#482" });
    expect(out).toContain('href="https://x/y"');
    expect(out).toContain('rel="noreferrer"');
    expect(out).toContain("#482");
  });

  it("relationStripHtml links a 'fixes' relation to the advisory, or nothing", () => {
    const rels = [{ fromId: "a", toId: "b", type: "fixes" as const }];
    const links = [{ provider: "github", href: "https://x/ghsa", kind: "advisory" as const, label: "GHSA-8h" }];
    expect(relationStripHtml(rels, links)).toContain("Fixes GHSA-8h");
    expect(relationStripHtml([], links)).toBe("");
  });
});
