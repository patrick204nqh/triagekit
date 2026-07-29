import { describe, expect, it } from "vitest";
import {
  projectDelegationTarget,
} from "../../src/runtime/delegation/projector";
import type { ScoredItem } from "../../src/runtime/layout/table/kind-renderer";
import { runtimeCatalog } from "../../src/runtime/catalog/built-in";

const issue = (body: string): ScoredItem => ({
  id: "github:issue:42",
  provider: "github",
  providerRef: { number: 42 },
  kind: "issue",
  title: "Security issue",
  location: "acme-corp/core",
  signal: 70,
  createdAt: "2026-07-28T00:00:00.000Z",
  url: "https://example.test/issues/42",
  score: 80,
  tier: "P1",
  details: {
    number: 42,
    state: "open",
    body,
    author: { login: "alice", avatarUrl: "", kind: "human" },
    assignees: [{ login: "bob", avatarUrl: "", kind: "human" }],
    reviewers: [],
    comments: 2,
    labels: [{ name: "security", color: "b60205" }],
    checks: null,
    permalinks: [],
    relations: [],
    rawResponse: { forbidden: true },
  },
});

describe("delegation target projector", () => {
  it("allow-lists issue context and excludes arbitrary provider payloads", () => {
    const projected = projectDelegationTarget({
      item: issue("Investigate this issue"),
      explanation: null,
      catalog: runtimeCatalog,
      freshness: {
        validatedAt: "2026-07-29T00:00:00.000Z",
        stale: false,
      },
    });
    expect(projected.details).toMatchObject({
      number: 42,
      state: "open",
      author: "alice",
      assignees: ["bob"],
      labels: ["security"],
      body: "Investigate this issue",
      freshness: {
        validatedAt: "2026-07-29T00:00:00.000Z",
        stale: false,
      },
    });
    expect(JSON.stringify(projected)).not.toContain("rawResponse");
  });

  it("bounds body text with an exact visible truncation disclosure", () => {
    const projected = projectDelegationTarget({
      item: issue("x".repeat(4_010)),
      explanation: null,
      catalog: runtimeCatalog,
    });
    expect(projected.details.body).toBe("x".repeat(4_000));
    expect(projected.details.truncation).toEqual({
      field: "body",
      originalLength: 4010,
    });
    expect(projected.details.body).not.toContain("…");
  });
});
