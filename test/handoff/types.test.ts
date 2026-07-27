import { describe, it, expect } from "vitest";
import type { AgentHandoffV1 } from "../../src/runtime/handoff/types";

describe("handoff types", () => {
  it("compiles and constructs a minimal valid handoff", () => {
    const handoff: AgentHandoffV1 = {
      schema: "triagekit.agent-handoff",
      version: 1,
      createdAt: "2026-07-27T00:00:00.000Z",
      intent: { outcome: "test", constraints: [], verification: [] },
      targets: [{
        id: "gh:123",
        kind: "dependency-vuln",
        provider: "github",
        providerReference: { alertNumber: 42 },
        title: "test",
        location: "acme-corp/app",
        url: "https://github.com/acme-corp/app/security/42",
        createdAt: "2026-07-26T00:00:00.000Z",
        priority: { signal: 80, score: 80, tier: "P0" },
        details: {},
      }],
      context: {
        session: { kind: "dependency-vuln", provider: "github", repository: "acme-corp/app" },
        relatedItems: [],
      },
    };
    expect(handoff.schema).toBe("triagekit.agent-handoff");
  });
});
