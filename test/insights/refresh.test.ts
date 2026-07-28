import { describe, expect, it } from "vitest";
import { buildInsightRefreshJobs } from "../../src/runtime/insights/refresh";
import { testCatalog } from "../support/test-catalog";

describe("buildInsightRefreshJobs", () => {
  it("groups connected ready kinds into one job per provider and scope", () => {
    const jobs = buildInsightRefreshJobs({
      catalog: testCatalog(),
      credentialFor: (provider) =>
        provider === "github" ? "token" : undefined,
      scopeFor: () => ({ repos: ["acme-corp/web"] }),
      scopeKeyFor: () => "github:acme-corp/web",
    });

    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      scopeKey: "github:acme-corp/web",
      credential: "token",
      kinds: ["code-scanning", "issue"],
    });
  });

  it("excludes upcoming kinds and disconnected providers", () => {
    const jobs = buildInsightRefreshJobs({
      catalog: testCatalog(),
      credentialFor: () => undefined,
      scopeFor: () => ({ repos: ["acme-corp/web"] }),
      scopeKeyFor: () => "github:acme-corp/web",
    });

    expect(jobs).toEqual([]);
  });

  it("excludes a provider whose required scope is empty", () => {
    const jobs = buildInsightRefreshJobs({
      catalog: testCatalog(),
      credentialFor: () => "token",
      scopeFor: () => ({}),
      scopeKeyFor: () => "empty",
    });

    expect(jobs).toEqual([]);
  });

  it("returns an immutable job collection", () => {
    const jobs = buildInsightRefreshJobs({
      catalog: testCatalog(),
      credentialFor: (provider) =>
        provider === "github" ? "token" : undefined,
      scopeFor: () => ({ repos: ["acme-corp/web"] }),
      scopeKeyFor: () => "github:acme-corp/web",
    });

    expect(Object.isFrozen(jobs)).toBe(true);
    expect(Object.isFrozen(jobs[0])).toBe(true);
    expect(Object.isFrozen(jobs[0]?.kinds)).toBe(true);
  });
});
