// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { bootstrap } from "../../src/runtime/bootstrap";
import { mockGithubItems } from "../helpers/github-fetch";
import { parseSessionQuery } from "../../src/runtime/session/serialized-session";
import type { TriageConfigT } from "../../src/config/schema";
import type { TriageItem } from "../../src/runtime/dataset/item";

const flush = () => new Promise<void>(r => setTimeout(r, 0));

const config: TriageConfigT = {
  source: "github",
  views: ["code-security", "insights"],
  scope: {},
  branding: { title: "Acme Triage" },
};

const configWithoutInsights: TriageConfigT = {
  ...config,
  views: ["code-security"],
};

const dependencyItem = (id: string, location: string): TriageItem => ({
  id: `github:${location}:${id}`,
  provider: "github",
  providerRef: { number: 1 },
  kind: "dependency-vuln",
  title: id,
  location,
  signal: 100,
  createdAt: "2026-07-01T00:00:00Z",
  url: `https://github.com/${location}/security/dependabot/1`,
  details: {
    package: id,
    severity: "critical",
    cvss: 10,
    scope: "runtime",
    fixAvailable: true,
    fixVersion: "2.0.0",
  },
});

function clickView(label: string): void {
  const tab = [...document.querySelectorAll<HTMLButtonElement>(".tb-view")]
    .find((candidate) => candidate.textContent === label);
  if (!tab) throw new Error(`missing ${label} view`);
  tab.click();
}

function scaffold() {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: true, media: q, addEventListener() {}, removeEventListener() {} }) as any);
  document.body.innerHTML = `<header id="appbar"></header>
    <nav id="domainRail" class="domains"></nav>
    <nav id="viewswitch" class="viewswitch"></nav>
    <main id="root"></main><div id="settings-host"></div><div id="delegation-host"></div>`;
}

describe("mountShell artifact navigation", () => {
  beforeEach(() => { sessionStorage.clear(); localStorage.clear(); history.replaceState(null, "", "/"); scaffold(); });

  it("shows Insights when the legacy config omits it", async () => {
    bootstrap(configWithoutInsights);
    await flush();
    expect([...document.querySelectorAll(".tb-view")].map((tab) => tab.textContent))
      .toContain("Insights");
  });

  it("refreshes every connected ready kind when Insights opens", async () => {
    sessionStorage.setItem("triagekit.cred.github", "token");
    localStorage.setItem("triagekit.scope.github", JSON.stringify({ repos: ["acme-corp/web"] }));
    const fetchSpy = mockGithubItems([dependencyItem("demo-package", "acme-corp/web")]);
    try {
      bootstrap(configWithoutInsights);
      await flush();
      clickView("Insights");
      await flush();
      await flush();

      const urls = fetchSpy.mock.calls.map(([input]) => String(input));
      expect(urls.some((url) => url.includes("/dependabot/alerts"))).toBe(true);
      expect(urls.some((url) => url.includes("/code-scanning/alerts"))).toBe(true);
      expect(urls.some((url) => url.includes("/issues"))).toBe(true);
      expect(document.querySelector("#root")?.textContent).toContain("Operator briefing");
      expect(document.querySelector("#root")?.getAttribute("role")).toBe("tabpanel");
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("opens an insight concentration in the matching List context", async () => {
    sessionStorage.setItem("triagekit.cred.github", "token");
    localStorage.setItem("triagekit.scope.github", JSON.stringify({ repos: ["acme-corp/web"] }));
    const fetchSpy = mockGithubItems([dependencyItem("demo-package", "acme-corp/web")]);
    try {
      bootstrap(configWithoutInsights);
      await flush();
      clickView("Insights");
      await flush();
      await flush();

      document.querySelector<HTMLButtonElement>("[data-concentration='acme-corp/web']")?.click();
      await flush();
      expect(parseSessionQuery(location.search)).toMatchObject({
        kind: "dependency-vuln",
        view: "list",
        repository: "acme-corp/web",
      });
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("opens the settings category requested by an insight diagnostic", async () => {
    sessionStorage.setItem("triagekit.cred.github", "token");
    localStorage.setItem(
      "triagekit.scope.github",
      JSON.stringify({ repos: ["acme-corp/web"] }),
    );
    const fetchSpy = mockGithubItems([
      dependencyItem("demo-package", "acme-corp/web"),
    ]);

    try {
      bootstrap(configWithoutInsights);
      await flush();
      clickView("Insights");
      await flush();
      await flush();

      const action = document.querySelector<HTMLButtonElement>(
        "[data-diagnostic-action='scoring']",
      );
      expect(action).not.toBeNull();
      action!.click();

      expect(
        document.querySelector<HTMLElement>("[data-category].on")
          ?.dataset.category,
      ).toBe("scoring");
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("does not replace List when an Insights refresh finishes after navigation", async () => {
    sessionStorage.setItem("triagekit.cred.github", "token");
    localStorage.setItem(
      "triagekit.scope.github",
      JSON.stringify({ repos: ["acme-corp/web"] }),
    );
    const fetchSpy = mockGithubItems([
      dependencyItem("demo-package", "acme-corp/web"),
    ]);

    try {
      const shell = bootstrap(configWithoutInsights);
      await shell.ready;
      await flush();
      await flush();

      let release!: () => void;
      let completed = 0;
      const pending = new Promise<void>((resolve) => { release = resolve; });
      fetchSpy.mockImplementation(async () => {
        await pending;
        completed += 1;
        return new Response("[]", { status: 200 });
      });
      fetchSpy.mockClear();

      clickView("Insights");
      await flush();
      expect(fetchSpy).toHaveBeenCalled();
      clickView("List");
      expect(document.querySelector(".tb-view.active")?.textContent).toBe("List");

      release();
      await vi.waitFor(() => expect(completed).toBe(fetchSpy.mock.calls.length));
      await flush();
      await flush();

      expect(document.querySelector(".tb-view.active")?.textContent).toBe("List");
      expect(document.querySelector("#root")?.textContent).not.toContain(
        "Operator briefing",
      );
      expect(document.querySelector("#root .surface-body")).not.toBeNull();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("refreshes Insights when the automatic refresh timer ticks", async () => {
    sessionStorage.setItem("triagekit.cred.github", "token");
    localStorage.setItem(
      "triagekit.scope.github",
      JSON.stringify({ repos: ["acme-corp/web"] }),
    );
    localStorage.setItem("triagekit.refresh", "300");
    const intervalSpy = vi.spyOn(globalThis, "setInterval");
    const fetchSpy = mockGithubItems([
      dependencyItem("demo-package", "acme-corp/web"),
    ]);

    try {
      const shell = bootstrap(configWithoutInsights);
      await shell.ready;
      await flush();
      clickView("Insights");
      await flush();
      await flush();
      fetchSpy.mockClear();

      const timer = intervalSpy.mock.calls.find(([, delay]) => delay === 300_000);
      expect(timer).toBeDefined();
      (timer![0] as () => void)();
      await flush();
      await flush();

      expect(fetchSpy).toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
      intervalSpy.mockRestore();
    }
  });

  it("renders the brand and an artifact rail with the live artifact active", () => {
    bootstrap(config);
    expect(document.querySelector("#appbar .brand .brand-mark")).toBeTruthy();
    expect(document.querySelector("#appbar .brand .wordmark")?.textContent).toBe("Acme Triage");
    const rail = [...document.querySelectorAll<HTMLElement>("#domainRail button")];
    expect(rail.map(b => b.textContent?.replace(/\s*soon$/, "").trim()))
      .toEqual(expect.arrayContaining(["Dependencies", "Cloud misconfig", "Tasks"]));
    const vuln = rail.find(b => b.textContent?.startsWith("Dependencies"))!;
    expect(vuln.className).toContain("active");          // live artifact leads
    expect(document.querySelector("#root")?.textContent)
      .toContain("Open Connections");
  });

  it("groups the rail into Findings and Work, with a refresh control and no Load button", () => {
    bootstrap(config);
    const groups = [...document.querySelectorAll<HTMLElement>("#domainRail .rail-group-label")].map(g => g.textContent);
    expect(groups).toEqual(["Findings", "Work"]);
    expect(document.querySelector("#appbar .btn-primary")).toBeNull();               // Load retired
    expect(document.querySelector('#appbar .icon-btn[aria-label="Refresh now"]')).toBeTruthy();
    expect(document.querySelector("#appbar .icon-btn[aria-label='Toggle theme']")?.getAttribute("title")).toMatch(/^Theme:/);
  });

  it("opens connection status without opening Settings and deep-links its actions", async () => {
    sessionStorage.setItem("triagekit.cred.github", "token");
    localStorage.setItem(
      "triagekit.scope.github",
      JSON.stringify({
        repos: Array.from(
          { length: 11 },
          (_, index) => `acme-corp/repository-${index + 1}`,
        ),
      }),
    );
    const fetchSpy = mockGithubItems([]);
    try {
      bootstrap(config);
      await flush();
      await flush();

      const pill = document.querySelector<HTMLButtonElement>(
        "[data-connection-status-trigger]",
      )!;
      expect(pill.textContent).toContain("11 repositories");
      pill.click();
      expect(document.querySelector(
        "[data-connection-status-menu]",
      )?.hasAttribute("hidden")).toBe(false);
      expect(document.querySelector("[data-panel]")?.classList.contains("open"))
        .toBe(false);

      document.querySelector<HTMLButtonElement>(
        "[data-status-repositories]",
      )!.click();
      expect(document.querySelector(
        "[data-category='repositories']",
      )?.classList.contains("on")).toBe(true);

      document.querySelector<HTMLButtonElement>(
        "#appbar .icon-btn[aria-label='Settings']",
      )!.click();
      expect(document.querySelector(
        "[data-category='connections']",
      )?.classList.contains("on")).toBe(true);
      expect(document.querySelector("#appbar .last-sync")).toBeNull();
      expect(pill.textContent).toContain("updated");
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("routes connected no-scope and disconnected empty states to the right category", async () => {
    sessionStorage.setItem("triagekit.cred.github", "token");
    localStorage.setItem(
      "triagekit.scope.github",
      JSON.stringify({ repos: [] }),
    );
    const fetchSpy = mockGithubItems([]);
    try {
      bootstrap(config);
      await flush();
      await flush();

      const choose = document.querySelector<HTMLButtonElement>(
        "[data-choose-repositories]",
      )!;
      expect(choose.textContent).toBe("Choose repositories");
      choose.click();
      expect(document.querySelector(
        "[data-category='repositories']",
      )?.classList.contains("on")).toBe(true);
    } finally {
      fetchSpy.mockRestore();
    }

    scaffold();
    sessionStorage.clear();
    localStorage.clear();
    bootstrap(config);
    const connect = document.querySelector<HTMLButtonElement>(
      "[data-choose-repositories]",
    )!;
    expect(connect.textContent).toBe("Open Connections");
    connect.click();
    expect(document.querySelector(
      "[data-category='connections']",
    )?.classList.contains("on")).toBe(true);
  });

  it("shows List + Insights tabs in the toolbar for the live artifact", () => {
    bootstrap(config);
    // Toolbar mounts in #viewswitch; view modes are .tb-view buttons.
    const tabs = [...document.querySelectorAll<HTMLElement>("#viewswitch .tb-view")];
    expect(tabs.map(t => t.textContent)).toEqual(expect.arrayContaining(["List", "Insights"]));
  });

  it("renders the list in a render-only body with the toolbar driving filters, and a filter change does not refetch", async () => {
    // A ready source with a satisfied cred + scope reaches the rendered-rows path.
    sessionStorage.setItem("triagekit.cred.github", "tok");
    localStorage.setItem(
      "triagekit.scope.github",
      JSON.stringify({ repos: ["acme-corp/web"] }),
    );
    const fetchSpy = mockGithubItems([]);
    try {
      bootstrap(config);
      await flush();

      // (a) the toolbar (Filter/Sort) lives in the nav; #root is a render-only body.
      expect(document.querySelector("#viewswitch .toolbar")).toBeTruthy();
      const body = document.querySelector<HTMLElement>("#root .surface-body");
      expect(body).toBeTruthy();
      expect(document.querySelector("#root .facet-bar")).toBeNull();   // retired renderer's DOM stays out of the surface
      expect(document.querySelector("#root .surface-body table.alerts, #root .surface-body .empty")).toBeTruthy();
      const initialFetches = fetchSpy.mock.calls.length;
      expect(initialFetches).toBeGreaterThan(0);

      // (b) a filter change (sort) via the toolbar re-renders the body without refetching.
      const sortBtn = document.querySelector<HTMLElement>("#viewswitch [data-sort='recent']")!;
      sortBtn.click();
      expect(document.querySelector("#root .surface-body")).toBeTruthy();
      expect(fetchSpy).toHaveBeenCalledTimes(initialFetches);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("renders neutral, provider-agnostic kind nouns in the sidebar rail", async () => {
    // The sidebar rail is a shared nav surface, so it shows the NEUTRAL KIND_LABEL
    // noun ("Change requests"/"Issues"), not a per-provider noun. GitHub's manifest
    // still declares "Pull requests" as forward-facing metadata, but it is not shown.
    bootstrap(config);
    await flush();
    const rail = document.getElementById("domainRail")!;
    const labels = [...rail.querySelectorAll("button")].map(b => b.textContent?.replace(/\s*soon$/, "").trim());
    expect(labels).toContain("Change requests");
    expect(labels).toContain("Issues");
    expect(labels).not.toContain("Pull requests");
  });

  it("writes state changes to the URL query string", async () => {
    history.replaceState(null, "", "/");
    bootstrap(config);
    await flush();
    const rail = document.getElementById("domainRail")!;
    const buttons = rail.querySelectorAll("button");
    (buttons[0] as HTMLElement).click();   // pick the first artifact
    await flush();
    const state = parseSessionQuery(location.search);
    expect(state.kind).toBeTruthy();   // artifact id was written
    expect(state.view).toBe("list");        // rail click resets view to list
  });

  it("applies a valid URL state on load", async () => {
    // artifact id === kind; "issue" is a real artifact (kind `issue`). Its source id
    // is "github" (provider github, kinds [change-request, issue]) — NOT "github"
    // (that id feeds dependency-vuln only), so the provider must be the real source id.
    history.replaceState(null, "", "/?artifact=issue&provider=github&view=list&sort=recent");
    bootstrap(config);
    await flush();
    const state = parseSessionQuery(location.search);
    expect(state.kind).toBe("issue");
    expect(state.provider).toBe("github");
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
    const state = parseSessionQuery(location.search);
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
    const fetchSpy = mockGithubItems([{
        id: "github:acme/web:1", provider: "github", providerRef: {}, kind: "dependency-vuln",
        title: "lodash", location: "acme/web", signal: 100,
        createdAt: new Date().toISOString(), url: "https://github.com/acme/web/security/dependabot/1",
        details: { package: "lodash", severity: "critical", cvss: 10, scope: "runtime", fixAvailable: true, fixVersion: "4.17.22" },
      }]);

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
    const fetchSpy = mockGithubItems([{
        id: "github:acme/web:2", provider: "github", providerRef: {}, kind: "dependency-vuln",
        title: "axios", location: "acme/web", signal: 100,
        createdAt: new Date().toISOString(), url: "https://github.com/acme/web/security/dependabot/2",
        details: { package: "axios", severity: "critical", cvss: 10, scope: "runtime", fixAvailable: true, fixVersion: "1.7.0" },
      }]);

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
