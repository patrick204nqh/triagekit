import { describe, it, expect } from "vitest";
import { TriageConfig } from "../../src/config/schema";

describe("TriageConfig", () => {
  it("accepts a minimal valid config", () => {
    const parsed = TriageConfig.parse({
      org: "acme-corp", provider: "github",
      repos: ["web-app"], views: ["security-alerts"],
    });
    expect(parsed.org).toBe("acme-corp");
    expect(parsed.branding.title).toBe("Triage"); // default
  });

  it("rejects an empty repo list", () => {
    expect(() => TriageConfig.parse({
      org: "acme-corp", provider: "github", repos: [], views: ["security-alerts"],
    })).toThrow();
  });

  it("rejects an unknown provider", () => {
    expect(() => TriageConfig.parse({
      org: "x", provider: "gitlab", repos: ["a"], views: ["security-alerts"],
    })).toThrow();
  });
});
