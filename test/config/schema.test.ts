import { describe, it, expect } from "vitest";
import { TriageConfig } from "../../src/config/schema";
describe("TriageConfig", () => {
  it("accepts a generic config with both views", () => {
    const p = TriageConfig.parse({ source: "github", views: ["security-alerts", "insights"] });
    expect(p.branding.title).toBe("Triage"); expect(p.views).toContain("insights"); expect(p.scope).toBeUndefined();
  });
  it("accepts a compiled config with a baked scope bag", () => {
    const p = TriageConfig.parse({ source: "github", views: ["security-alerts"], scope: { repos: ["acme/web"] } });
    expect(p.scope).toEqual({ repos: ["acme/web"] });
  });
  it("rejects an unknown source", () => {
    expect(() => TriageConfig.parse({ source: "gitlab", views: ["security-alerts"] })).toThrow();
  });
});
