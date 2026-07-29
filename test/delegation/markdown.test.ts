import { describe, expect, it } from "vitest";
import type {
  DelegationBundleV1,
} from "../../src/runtime/delegation/types";
import {
  renderBundleMarkdown,
  renderPackageMarkdown,
} from "../../src/runtime/delegation/markdown";

const bundle: DelegationBundleV1 = {
  schema: "triagekit.delegation-bundle",
  version: 1,
  createdAt: "2026-07-29T00:00:00.000Z",
  focus: {
    provider: "github",
    repositoryOrder: ["acme-corp/core"],
    includeLabels: ["security"],
    excludeLabels: ["done"],
  },
  instructions: {
    processPackagesInOrder: true,
    generatedFrom: "explicit-session-queue",
  },
  packages: [{
    id: "pkg-core",
    order: 1,
    repository: "acme-corp/core",
    kind: "issue",
    intent: {
      outcome: "Triage *carefully*",
      constraints: ["Do not merge"],
      verification: ["Run tests"],
    },
    targets: [{
      id: "github:42",
      kind: "issue",
      provider: "github",
      providerReference: { number: 42 },
      title: "Fix [security]",
      location: "acme-corp/core",
      url: "https://example.test/issues/42?view=full",
      createdAt: "2026-07-28T00:00:00.000Z",
      priority: { signal: 80, score: 90, tier: "P1" },
      details: {
        freshness: {
          validatedAt: "2026-07-29T00:00:00.000Z",
          stale: true,
        },
        truncation: { field: "body", originalLength: 5000 },
      },
    }],
    selectionReason: "Repository priority 1",
  }],
};

describe("delegation Markdown", () => {
  it("renders ordered packages, escaped human text, and preserved URLs", () => {
    const markdown = renderBundleMarkdown(bundle);
    expect(markdown).toContain("# Delegation bundle");
    expect(markdown).toContain("## Package 1");
    expect(markdown).toContain("Triage \\*carefully\\*");
    expect(markdown).toContain(
      "https://example.test/issues/42?view=full",
    );
    expect(markdown).toContain("stale");
    expect(markdown).toContain("original length: 5000");
  });

  it("renders one package as a standalone transferable brief", () => {
    const markdown = renderPackageMarkdown(bundle, bundle.packages[0]);
    expect(markdown).toContain("# Delegation package");
    expect(markdown.match(/^## Package /gm)).toHaveLength(1);
  });
});
