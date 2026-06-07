// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { bootstrap } from "../../src/runtime/bootstrap";
import type { TriageConfigT } from "../../src/config/schema";

const config: TriageConfigT = { source: "github", views: ["code-security", "insights"], scope: {}, branding: { title: "Acme Triage" } };

describe("bootstrap composition root", () => {
  it("wires kinds + store + view and returns a core with refreshNow/rerender", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: true, media: q, addEventListener() {}, removeEventListener() {} }) as any);
    document.body.innerHTML = `<header id="appbar"></header><nav id="domainRail"></nav><nav id="viewswitch"></nav><main id="root"></main><div id="settings-host"></div>`;
    const core = bootstrap(config);
    expect(core).toBeDefined();
    expect(typeof core.refreshNow).toBe("function");
    expect(typeof core.rerender).toBe("function");
  });
});
