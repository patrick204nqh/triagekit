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

describe("mountShell artifact navigation", () => {
  beforeEach(() => { sessionStorage.clear(); localStorage.clear(); scaffold(); });

  it("renders the brand and an artifact rail with the live artifact active", () => {
    bootstrap(config);
    expect(document.querySelector("#appbar .brand .brand-mark")).toBeTruthy();
    expect(document.querySelector("#appbar .brand .wordmark")?.textContent).toBe("Acme Triage");
    const rail = [...document.querySelectorAll<HTMLElement>("#domainRail button")];
    expect(rail.map(b => b.textContent?.replace(/\s*upcoming$/, "").trim()))
      .toEqual(expect.arrayContaining(["Dependencies", "Cloud misconfig", "Tasks"]));
    const vuln = rail.find(b => b.textContent?.startsWith("Dependencies"))!;
    expect(vuln.className).toContain("active");          // live artifact leads
    expect(document.querySelector("#root")?.textContent).toMatch(/connect a token/i);  // empty scope/cred
  });

  it("groups the rail into Findings and Work, with a refresh control and no Load button", () => {
    bootstrap(config);
    const groups = [...document.querySelectorAll<HTMLElement>("#domainRail .rail-group-label")].map(g => g.textContent);
    expect(groups).toEqual(["Findings", "Work"]);
    expect(document.querySelector("#appbar .btn-primary")).toBeNull();               // Load retired
    expect(document.querySelector('#appbar .icon-btn[aria-label="Refresh now"]')).toBeTruthy();
    expect(document.querySelector("#appbar .icon-btn[aria-label='Toggle theme']")?.getAttribute("title")).toMatch(/^Theme:/);
  });

  it("shows List + Insights tabs in the toolbar for the live artifact", () => {
    bootstrap(config);
    // Toolbar mounts in #viewswitch; view modes are .tb-view buttons.
    const tabs = [...document.querySelectorAll<HTMLElement>("#viewswitch .tb-view")];
    expect(tabs.map(t => t.textContent)).toEqual(expect.arrayContaining(["List", "Insights"]));
  });

  it("renders the list in a render-only body with the toolbar driving facets, and a facet change does not refetch", async () => {
    // A ready source with a satisfied cred + scope reaches the rendered-rows path.
    sessionStorage.setItem("triagekit.cred.github", "tok");
    localStorage.setItem("triagekit.scope.github", JSON.stringify({ repos: [] }));
    const fetchSpy = vi.spyOn(githubSource, "fetch")
      .mockResolvedValue({ items: [], errors: [] });
    try {
      bootstrap(config);
      await flush();

      // (a) the toolbar (Filter/Sort) lives in the nav; #root is a render-only body.
      expect(document.querySelector("#viewswitch .toolbar")).toBeTruthy();
      const body = document.querySelector<HTMLElement>("#root .surface-body");
      expect(body).toBeTruthy();
      expect(document.querySelector("#root .facet-bar")).toBeNull();   // retired from the surface
      expect(document.querySelector("#root .surface-body table.alerts, #root .surface-body .empty")).toBeTruthy();
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // (b) a facet change (sort) via the toolbar re-renders the body without refetching.
      const sortBtn = document.querySelector<HTMLElement>("#viewswitch [data-sort='recent']")!;
      sortBtn.click();
      expect(document.querySelector("#root .surface-body")).toBeTruthy();
      expect(fetchSpy).toHaveBeenCalledTimes(1);   // no refetch
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("switching to an upcoming artifact renders its roadmap placeholder", () => {
    bootstrap(config);
    const rail = [...document.querySelectorAll<HTMLElement>("#domainRail button")];
    rail.find(b => b.textContent?.startsWith("Cloud misconfig"))!.click();
    expect(document.querySelector("#root .upcoming")).toBeTruthy();
    expect(document.querySelector("#root .badge")?.textContent).toBe("upcoming");
    expect(document.querySelectorAll("#root .prov-roadmap li").length).toBeGreaterThan(0);  // aws/gcp
  });

  it("applies configured tier thresholds when scoring", async () => {
    // Absurdly high thresholds ensure every realistic score lands at P3.
    localStorage.setItem("triagekit.policy.tiers", JSON.stringify({ p0: 9999, p1: 9998, p2: 9997 }));
    sessionStorage.setItem("triagekit.cred.github", "tok");
    localStorage.setItem("triagekit.scope.github", JSON.stringify({ repos: ["acme/web"] }));

    // Return a critical vuln item whose normal score would be P0 (~170) with default thresholds.
    const fetchSpy = vi.spyOn(githubSource, "fetch").mockResolvedValue({
      items: [{
        id: "github:acme/web:1", source: "github", kind: "dependency-vuln",
        title: "lodash", location: "acme/web", signal: 100,
        createdAt: new Date().toISOString(), url: "https://github.com/acme/web/security/dependabot/1",
        details: { package: "lodash", severity: "critical", cvss: 10, scope: "runtime", fixAvailable: true, fixVersion: "4.17.22" },
      }],
      errors: [],
    } as any);

    try {
      bootstrap(config);
      await flush();

      const tiers = [...document.querySelectorAll<HTMLElement>("#root .surface-body .tier")].map(t => t.textContent);
      expect(tiers.length).toBeGreaterThan(0);
      if (tiers.length) expect(tiers.every(t => t === "P3")).toBe(true);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("uses the stored score model's tier bands (not the threshold fallback) when ranking rows", async () => {
    // Absurd thresholds: fallback path would yield P3 for any realistic score.
    localStorage.setItem("triagekit.policy.tiers", JSON.stringify({ p0: 9999, p1: 9998, p2: 9997 }));

    // Stored model for dependency-vuln: cvss * 100, P0 at ≥ 80.
    localStorage.setItem("triagekit.policy.score.dependency-vuln", JSON.stringify({
      kind: "dependency-vuln", scale: 1, formula: "cvss * 100",
      signals: { cvss: { from: "cvss", transform: { type: "linear", in: [0, 10] } } },
      tiers: [{ name: "P0", min: 80 }, { name: "P3", min: 0 }],
    }));

    sessionStorage.setItem("triagekit.cred.github", "tok");
    localStorage.setItem("triagekit.scope.github", JSON.stringify({ repos: ["acme/web"] }));

    // Item with cvss: 10 → normalised to 1.0 → score 100 → P0 under the stored model.
    const fetchSpy = vi.spyOn(githubSource, "fetch").mockResolvedValue({
      items: [{
        id: "github:acme/web:2", source: "github", kind: "dependency-vuln",
        title: "axios", location: "acme/web", signal: 100,
        createdAt: new Date().toISOString(), url: "https://github.com/acme/web/security/dependabot/2",
        details: { package: "axios", severity: "critical", cvss: 10, scope: "runtime", fixAvailable: true, fixVersion: "1.7.0" },
      }],
      errors: [],
    } as any);

    try {
      bootstrap(config);
      await flush();

      const tiers = [...document.querySelectorAll<HTMLElement>("#root .surface-body .tier")].map(t => t.textContent);
      expect(tiers.length).toBeGreaterThan(0);
      // The stored model's bands must win: P0, not P3 from the absurd-threshold fallback.
      expect(tiers.every(t => t === "P0")).toBe(true);
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
