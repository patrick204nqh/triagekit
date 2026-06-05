import { describe, it, expect } from "vitest";
import { TriageConfig } from "../../src/config/schema";
describe("TriageConfig", () => {
  it("accepts a generic config (no scope)", () => {
    const p = TriageConfig.parse({ source: "github", views: ["security-alerts"] });
    expect(p.branding.title).toBe("Triage"); expect(p.scope).toBeUndefined();
  });
  it("accepts a compiled config with a baked scope bag", () => {
    const p = TriageConfig.parse({ source: "github", views: ["security-alerts"], scope: { repos: ["acme/web"] } });
    expect(p.scope).toEqual({ repos: ["acme/web"] });
  });
  it("rejects an unknown source", () => {
    expect(() => TriageConfig.parse({ source: "gitlab", views: ["security-alerts"] })).toThrow();
  });
});
