import { describe, it, expect } from "vitest";
import { TriageConfig } from "../../src/config/schema";
describe("TriageConfig", () => {
  it("accepts a minimal valid config", () => {
    const p = TriageConfig.parse({ org: "acme-corp", source: "github", repos: ["web-app"], views: ["security-alerts"] });
    expect(p.org).toBe("acme-corp"); expect(p.branding.title).toBe("Triage");
  });
  it("rejects an empty repo list", () => {
    expect(() => TriageConfig.parse({ org: "acme-corp", source: "github", repos: [], views: ["security-alerts"] })).toThrow();
  });
  it("rejects an unknown source", () => {
    expect(() => TriageConfig.parse({ org: "x", source: "gitlab", repos: ["a"], views: ["security-alerts"] })).toThrow();
  });
});
