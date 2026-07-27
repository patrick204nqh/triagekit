import { describe, it, expect } from "vitest";
import { project } from "../../src/runtime/handoff/projector";
import type { ScoredItem } from "../../src/runtime/layout/table/kind-renderer";
import type { SessionState } from "../../src/runtime/session/types";
import type { ScoreExplanation } from "../../src/runtime/scoring/score-model";
import { runtimeCatalog } from "../../src/runtime/catalog/built-in";

describe("project", () => {
  const item: ScoredItem = {
    id: "gh:42", provider: "github", providerRef: { alertNumber: 42 },
    kind: "dependency-vuln", title: "lodash prototype pollution",
    location: "acme-corp/app", signal: 80,
    createdAt: "2026-07-26T00:00:00.000Z",
    url: "https://github.com/acme-corp/app/security/42",
    score: 85, tier: "P0",
    details: { alertNumber: 42, severity: "critical" },
  };

  const session: SessionState = {
    kind: "dependency-vuln", provider: "github",
    preferredRepository: "acme-corp/app",
    effectiveRepository: "acme-corp/app",
    view: "table", filters: { query: "", axes: {} },
  };

  const TS = "2026-07-27T00:00:00.000Z";

  it("produces a valid AgentHandoffV1 with default intent", () => {
    const h = project({ item, explanation: null, session, catalog: runtimeCatalog, timestamp: TS });
    expect(h.schema).toBe("triagekit.agent-handoff");
    expect(h.version).toBe(1);
    expect(h.targets).toHaveLength(1);
    expect(h.targets[0].id).toBe("gh:42");
    expect(h.intent.outcome).toContain("dependency");
  });

  it("merges provided intent overrides", () => {
    const h = project({
      item, explanation: null, session,
      intent: { outcome: "Custom outcome" },
      catalog: runtimeCatalog, timestamp: TS,
    });
    expect(h.intent.outcome).toBe("Custom outcome");
  });

  it("includes score explanation when provided", () => {
    const explanation: ScoreExplanation = {
      signals: { severity: { from: "severity", raw: "critical", value: 1 } },
      score: 85,
    };
    const h = project({ item, explanation, session, catalog: runtimeCatalog, timestamp: TS });
    expect(h.targets[0].priority.explanation).toBeDefined();
    expect(h.targets[0].priority.explanation![0].label).toBe("severity");
  });

  it("sets context from session", () => {
    const h = project({ item, explanation: null, session, catalog: runtimeCatalog, timestamp: TS });
    expect(h.context.session.kind).toBe("dependency-vuln");
    expect(h.context.session.repository).toBe("acme-corp/app");
  });
});
