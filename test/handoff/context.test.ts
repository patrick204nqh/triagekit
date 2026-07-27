import { describe, it, expect } from "vitest";
import { buildContext } from "../../src/runtime/handoff/context";
import type { SessionState } from "../../src/runtime/session/types";

describe("buildContext", () => {
  it("returns session fields with repository", () => {
    const session: SessionState = {
      kind: "dependency-vuln", provider: "github",
      preferredRepository: "acme/app", effectiveRepository: "acme/app",
      view: "table", filters: { query: "", axes: {} },
    };
    const ctx = buildContext(session);
    expect(ctx.session.kind).toBe("dependency-vuln");
    expect(ctx.session.repository).toBe("acme/app");
    expect(ctx.relatedItems).toEqual([]);
  });

  it("omits repository when empty", () => {
    const session: SessionState = {
      kind: "issue", provider: "github",
      preferredRepository: "", effectiveRepository: "",
      view: "table", filters: { query: "", axes: {} },
    };
    const ctx = buildContext(session);
    expect(ctx.session.repository).toBeUndefined();
  });
});
