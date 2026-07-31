import { describe, expect, it } from "vitest";
import type {
  HandoffBundleV1,
} from "../../src/runtime/handoff/types";
import {
  renderHandoffBundleMarkdown,
  renderHandoffPackageMarkdown,
} from "../../src/runtime/handoff/markdown";

const bundle: HandoffBundleV1 = {
  schema: "triagekit.handoff-bundle",
  version: 1,
  createdAt: "2026-07-29T00:00:00.000Z",
  focus: {
    provider: "github",
    repositoryOrder: ["acme-corp/core"],
    includeLabels: ["security"],
    excludeLabels: ["done"],
  },
  instructions: {
    mode: "investigate",
    missionNote: "Keep public APIs stable",
    generatedBoundary: [
      "Do not modify files.",
      "Do not create commits or pushes.",
      "Do not perform provider mutations or other external actions.",
    ],
    processPackagesInOrder: true,
    generatedFrom: "explicit-session-queue",
  },
  packages: [{
    id: "pkg-core",
    order: 1,
    repository: "acme-corp/core",
    kind: "issue",
    generatedIntent: {
      outcome: "Investigate *carefully*",
      constraints: ["Do not modify files."],
      verification: ["Outline a concrete action plan."],
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
      note: "Do not update beyond v4",
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

describe("handoff Markdown", () => {
  it("renders ordered packages, escaped human text, and preserved URLs", () => {
    const markdown = renderHandoffBundleMarkdown(bundle);
    expect(markdown).toContain("# Handoff bundle");
    expect(markdown).toContain("## Mode: Investigate");
    expect(markdown).toContain("Do not modify files.");
    expect(markdown).toContain(
      "## Mission note\n\nKeep public APIs stable",
    );
    expect(markdown).toContain(
      "#### Item note\n\nDo not update beyond v4",
    );
    expect(markdown).toContain("## Package 1");
    expect(markdown).toContain("Investigate \\*carefully\\*");
    expect(markdown).toContain(
      "https://example.test/issues/42?view=full",
    );
    expect(markdown).toContain("stale");
    expect(markdown).toContain("original length: 5000");
  });

  it("renders one package as a standalone transferable brief", () => {
    const markdown = renderHandoffPackageMarkdown(bundle, bundle.packages[0]);
    expect(markdown).toContain("# Handoff package");
    expect(markdown).toContain("## Mode: Investigate");
    expect(markdown).toContain("Do not modify files.");
    expect(markdown.match(/^## Package /gm)).toHaveLength(1);
  });
});
