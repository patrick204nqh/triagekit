import { describe, it, expect } from "vitest";
import { validate } from "../../src/runtime/handoff/validator";
import type { AgentHandoffV1 } from "../../src/runtime/handoff/types";

function validHandoff(): AgentHandoffV1 {
  return {
    schema: "triagekit.agent-handoff",
    version: 1,
    createdAt: "2026-07-27T00:00:00.000Z",
    intent: { outcome: "Fix the vuln", constraints: [], verification: [] },
    targets: [{
      id: "gh:42", kind: "dependency-vuln", provider: "github",
      providerReference: { alertNumber: 42 },
      title: "lodash", location: "acme/app",
      url: "https://github.com/acme/app/security/42",
      createdAt: "2026-07-26T00:00:00.000Z",
      priority: { signal: 80, score: 85, tier: "P0" },
      details: {},
    }],
    context: {
      session: { kind: "dependency-vuln", provider: "github", repository: "acme/app" },
      relatedItems: [],
    },
  };
}

describe("validate", () => {
  it("passes a valid handoff", () => {
    expect(validate(validHandoff())).toEqual({ valid: true });
  });

  it("rejects wrong schema", () => {
    const h = validHandoff();
    h.schema = "wrong" as any;
    expect(validate(h).valid).toBe(false);
  });

  it("rejects zero targets", () => {
    const h = validHandoff();
    h.targets = [];
    const r = validate(h);
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.errors[0].field).toContain("targets");
  });

  it("rejects empty outcome", () => {
    const h = validHandoff();
    h.intent.outcome = "";
    const r = validate(h);
    expect(r.valid).toBe(false);
  });

  it("rejects secret-shaped keys in providerReference", () => {
    const h = validHandoff();
    h.targets[0].providerReference = { token: "abc" as any };
    const r = validate(h);
    expect(r.valid).toBe(false);
  });

  it("rejects missing target url", () => {
    const h = validHandoff();
    h.targets[0].url = "";
    const r = validate(h);
    expect(r.valid).toBe(false);
  });

  it("rejects oversized handoff", () => {
    const h = validHandoff();
    (h.targets[0] as any).details = { data: "x".repeat(600_000) };
    const r = validate(h);
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.errors.some(e => e.field === "(root)")).toBe(true);
  });
});
