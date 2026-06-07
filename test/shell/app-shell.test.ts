// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { bootstrap } from "../../src/runtime/bootstrap";
import { toolbarPropsFromShell } from "../../src/runtime/shell/app-shell";
import type { ScoredItem } from "../../src/runtime/layout/triage-table";
import { githubSource } from "../../src/runtime/ingest/github/dependency-vuln-source";
import { registerProvider } from "../../src/runtime/core/provider-registry";
import { github } from "../../src/runtime/providers/github";
import { readUrlState } from "../../src/runtime/shell/url-state";
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
  beforeEach(() => { sessionStorage.clear(); localStorage.clear(); history.replaceState(null, "", "/"); scaffold(); });

  it("renders the brand and an artifact rail with the live artifact active", () => {
    bootstrap(config);
    expect(document.querySelector("#appbar .brand .brand-mark")).toBeTruthy();
    expect(document.querySelector("#appbar .brand .wordmark")?.textContent).toBe("Acme Triage");
    const rail = [...document.querySelectorAll<HTMLElement>("#domainRail button")];
    expect(rail.map(b => b.textContent?.replace(/\s*soon$/, "").trim()))
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
      expect(document.querySelector("#root .facet-bar")).toBeNull();   // retired renderer stays out of the surface
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

  it("resolves the change-request rail label through the provider registry", async () => {
    // bootstrap() registers the github provider (registerProvider(github)), so the
    // change-request rail label resolves via provider-registry — GitHub's manifest
    // declares "Pull requests"/"Issues" — rather than only the neutral KIND_LABEL fallback.
    bootstrap(config);
    await flush();
    const rail = document.getElementById("domainRail")!;
    const labels = [...rail.querySelectorAll("button")].map(b => b.textContent);
    expect(labels).toContain("Pull requests");
    expect(labels).toContain("Issues");
  });

  it("renders a provider's distinct change-request label, proving the registry path (not the KIND_LABEL fallback)", async () => {
    // Distinguish the registry lookup from the neutral KIND_LABEL fallback ("Pull
    // requests"): override github's manifest (same id) with a DISTINCT change-request
    // label the fallback could never produce. If the rail shows "Merge requests" and
    // NOT "Pull requests", navLabel() must have resolved it through provider-registry.
    bootstrap(config);
    await flush();
    try {
      registerProvider({ ...github, labels: { ...github.labels, "change-request": "Merge requests" } });
      // buildRail() re-runs on any rail click, re-resolving every label via navLabel().
      const rail = document.getElementById("domainRail")!;
      (rail.querySelector("button") as HTMLButtonElement).click();   // re-render the rail with the override in effect
      await flush();

      const labels = [...rail.querySelectorAll("button")].map(b => b.textContent);
      expect(labels).toContain("Merge requests");
      expect(labels).not.toContain("Pull requests");   // fallback never produces this
    } finally {
      registerProvider(github);   // restore the real manifest — registry is a module singleton
    }
  });

  it("keeps a sticky activeRepo 'on' across artifact switches that have it, and coerces to All where it's absent", () => {
    // The shell's activeRepo STATE is sticky (never reset on artifact switch); only the
    // DISPLAYED active tab is coerced by toolbarPropsFromShell. Exercise that coercion
    // deterministically over two row-sets — far more reliable than the DOM path, which
    // only produces repo tabs given credentialed/scoped sources unavailable in this env.
    const row = (location: string): ScoredItem => ({
      id: location + ":1", source: "github", kind: "issue", title: "t",
      location, signal: 1, createdAt: "2026-01-01T00:00:00Z", url: "", details: {},
      score: 1, tier: "P3",
    });
    const base = {
      artifact: { id: "issue", label: "Issues", group: "work" as const, kinds: ["issue" as const] },
      facets: { axes: {}, sort: "priority" }, hasInsights: false, activeView: "list",
      sources: [{ id: "github", provider: "github", status: "ready" }],
      activeProvider: "github", extraTabs: [],
    };

    // Sticky activeRepo "acme/api" is present in artifact A → stays selected.
    const onA = toolbarPropsFromShell({ ...base, rows: [row("acme/api"), row("acme/web")], activeRepo: "acme/api" });
    expect(onA.activeRepo).toBe("acme/api");

    // Same sticky state, an artifact B WITHOUT it → display falls back to All ("").
    const onB = toolbarPropsFromShell({ ...base, rows: [row("acme/cli"), row("acme/docs")], activeRepo: "acme/api" });
    expect(onB.activeRepo).toBe("");

    // Returning to an artifact that has it again → selection restored (state never reset).
    const backToA = toolbarPropsFromShell({ ...base, rows: [row("acme/api"), row("acme/web")], activeRepo: "acme/api" });
    expect(backToA.activeRepo).toBe("acme/api");
  });

  it("writes state changes to the URL query string", async () => {
    history.replaceState(null, "", "/");
    bootstrap(config);
    await flush();
    const rail = document.getElementById("domainRail")!;
    const buttons = rail.querySelectorAll("button");
    (buttons[0] as HTMLElement).click();   // pick the first artifact
    await flush();
    const state = readUrlState(location.search);
    expect(state.artifact).toBeTruthy();   // artifact id was written
    expect(state.view).toBe("list");        // rail click resets view to list
  });

  it("applies a valid URL state on load", async () => {
    // artifact id === kind; "issue" is a real artifact (kind `issue`). Its source id
    // is "github-review" (provider github, kinds [change-request, issue]) — NOT "github"
    // (that id feeds dependency-vuln only), so the provider must be the real source id.
    history.replaceState(null, "", "/?artifact=issue&provider=github-review&view=list&sort=recent");
    bootstrap(config);
    await flush();
    const state = readUrlState(location.search);
    expect(state.artifact).toBe("issue");
    expect(state.provider).toBe("github-review");
    expect(state.sort).toBe("recent");
    // The applied artifact leads the rail as the active button.
    const active = document.querySelector("#domainRail button.active");
    expect(active).not.toBeNull();
    expect(active?.textContent).toBe("Issues");
  });

  it("falls back to defaults for a URL referencing a non-existent artifact/provider (no crash)", async () => {
    history.replaceState(null, "", "/?artifact=does-not-exist&provider=nope&sort=bogus");
    expect(() => bootstrap(config)).not.toThrow();
    await flush();
    const state = readUrlState(location.search);
    // The bogus sort was dropped on load; default "priority" remains in effect, and
    // the (unchanged) URL still reflects the raw query (load doesn't rewrite it).
    expect(state.sort).toBe("bogus");
    // The active rail button is the default live leader, not the bogus artifact.
    const active = document.querySelector("#domainRail button.active");
    expect(active?.textContent).toBe("Dependencies");
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
