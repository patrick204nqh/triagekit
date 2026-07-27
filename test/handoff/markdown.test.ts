import { describe, it, expect } from "vitest";
import { renderMarkdown } from "../../src/runtime/handoff/markdown";
import type { AgentHandoffV1 } from "../../src/runtime/handoff/types";

function sample(): AgentHandoffV1 {
  return {
    schema: "triagekit.agent-handoff",
    version: 1,
    createdAt: "2026-07-27T00:00:00.000Z",
    intent: { outcome: "Fix the vuln", constraints: ["Don't force-push"], verification: ["Tests pass"] },
    targets: [{
      id: "gh:42", kind: "dependency-vuln", provider: "github",
      providerReference: { alertNumber: 42 },
      title: "lodash", location: "acme/app",
      url: "https://github.com/acme/app/security/42",
      createdAt: "2026-07-26T00:00:00.000Z",
      priority: { signal: 80, score: 85, tier: "P0", explanation: [{ label: "severity", value: "critical", reason: "CVSS 9.8" }] },
      details: {},
    }],
    context: { session: { kind: "dependency-vuln", provider: "github", repository: "acme/app" }, relatedItems: [] },
  };
}

describe("renderMarkdown", () => {
  it("produces deterministic output (same input same output)", () => {
    const a = renderMarkdown(sample());
    const b = renderMarkdown(sample());
    expect(a).toBe(b);
  });

  it("includes outcome section", () => {
    expect(renderMarkdown(sample())).toContain("## Outcome");
  });

  it("includes target section", () => {
    expect(renderMarkdown(sample())).toContain("## Target");
  });

  it("includes evidence section when present", () => {
    expect(renderMarkdown(sample())).toContain("## Evidence");
  });

  it("includes constraints and verification sections", () => {
    const md = renderMarkdown(sample());
    expect(md).toContain("## Constraints");
    expect(md).toContain("## Verification");
  });

  it("includes context section", () => {
    expect(renderMarkdown(sample())).toContain("## Context");
  });

  it("escapes markdown control characters in values", () => {
    const h = sample();
    h.intent.outcome = "Fix [the] (vuln) *now*";
    const md = renderMarkdown(h);
    expect(md).not.toContain("[the]");
    expect(md).toContain("\\[the\\]");
  });

  it("omits evidence section when explanation is empty", () => {
    const h = sample();
    h.targets[0].priority.explanation = [];
    const md = renderMarkdown(h);
    expect(md).not.toContain("## Evidence");
  });

  it("omits constraints section when empty", () => {
    const h = sample();
    h.intent.constraints = [];
    const md = renderMarkdown(h);
    expect(md).not.toContain("## Constraints");
  });

  it("omits verification section when empty", () => {
    const h = sample();
    h.intent.verification = [];
    const md = renderMarkdown(h);
    expect(md).not.toContain("## Verification");
  });
});
