// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { bootstrap } from "../../src/runtime/bootstrap";
import { githubSource } from "../../src/runtime/ingest/github/dependency-vuln-source";
import type { TriageConfigT } from "../../src/config/schema";

const flush = () => new Promise<void>(r => setTimeout(r, 0));

const config: TriageConfigT = {
  source: "github",
  views: ["code-security", "insights"],
  scope: {},
  branding: { title: "Acme Triage" },
};

function scaffold() {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: true, media: q, addEventListener() {}, removeEventListener() {} }) as any);
  document.body.innerHTML = `<header id="appbar"></header>
    <nav id="domainRail" class="domains"></nav>
    <nav id="viewswitch" class="viewswitch"></nav>
    <main id="root"></main><div id="settings-host"></div>`;
}

const vulnItem = {
  id: "github:acme/web:1", source: "github", kind: "dependency-vuln",
  title: "lodash", location: "acme/web", signal: 50,
  createdAt: new Date().toISOString(), url: "https://example.test/1",
  details: { package: "lodash", severity: "critical", cvss: 10, scope: "runtime", fixAvailable: true, fixVersion: "1" },
};

describe("app-shell score breakdown in drawer", () => {
  beforeEach(() => { sessionStorage.clear(); localStorage.clear(); scaffold(); });

  it("shows the per-signal breakdown when a valid model is stored", async () => {
    localStorage.setItem("triagekit.policy.score.dependency-vuln", JSON.stringify({
      kind: "dependency-vuln", scale: 100, formula: "cvss * 1",
      signals: { cvss: { from: "cvss", transform: { type: "linear", in: [0, 10] } } },
      tiers: [{ name: "P0", min: 80 }, { name: "P3", min: 0 }],
    }));
    sessionStorage.setItem("triagekit.cred.github", "tok");
    localStorage.setItem("triagekit.scope.github", JSON.stringify({ repos: ["acme/web"] }));
    const spy = vi.spyOn(githubSource, "fetch").mockResolvedValue({ items: [vulnItem], errors: [] } as any);
    try {
      bootstrap(config);
      await flush();
      document.querySelector<HTMLElement>("#root .surface-body .alert-row")!.click();
      expect(document.querySelector("#root .drawer .breakdown")).not.toBeNull();
      expect(document.querySelector("#root .drawer")!.textContent).toContain("cvss");
    } finally { spy.mockRestore(); }
  });

  it("shows the built-in note when no model is stored", async () => {
    sessionStorage.setItem("triagekit.cred.github", "tok");
    localStorage.setItem("triagekit.scope.github", JSON.stringify({ repos: ["acme/web"] }));
    const spy = vi.spyOn(githubSource, "fetch").mockResolvedValue({ items: [vulnItem], errors: [] } as any);
    try {
      bootstrap(config);
      await flush();
      document.querySelector<HTMLElement>("#root .surface-body .alert-row")!.click();
      expect(document.querySelector("#root .drawer .breakdown")).toBeNull();
      expect(document.querySelector("#root .drawer")!.textContent).toContain("Built-in scorer");
    } finally { spy.mockRestore(); }
  });
});
