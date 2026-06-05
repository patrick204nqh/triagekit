// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { mountShell } from "../../src/runtime/shell/app-shell";
import type { TriageConfigT } from "../../src/config/schema";

const config: TriageConfigT = {
  source: "github",
  views: ["security-alerts", "insights"],
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
    mountShell(config);
    expect(document.querySelector("#appbar .brand .brand-mark")).toBeTruthy();
    expect(document.querySelector("#appbar .brand .wordmark")?.textContent).toBe("Acme Triage");
    const rail = [...document.querySelectorAll<HTMLElement>("#domainRail button")];
    expect(rail.map(b => b.textContent?.replace(/\s*upcoming$/, "").trim()))
      .toEqual(expect.arrayContaining(["Vulnerabilities", "Misconfigurations", "Tickets"]));
    const vuln = rail.find(b => b.textContent?.startsWith("Vulnerabilities"))!;
    expect(vuln.className).toContain("active");          // live artifact leads
    expect(document.querySelector("#root")?.textContent).toMatch(/connect a token/i);  // empty scope/cred
  });

  it("groups the rail into Findings and Work, with a refresh control and no Load button", () => {
    mountShell(config);
    const groups = [...document.querySelectorAll<HTMLElement>("#domainRail .rail-group-label")].map(g => g.textContent);
    expect(groups).toEqual(["Findings", "Work"]);
    expect(document.querySelector("#appbar .btn-primary")).toBeNull();               // Load retired
    expect(document.querySelector('#appbar .icon-btn[aria-label="Refresh now"]')).toBeTruthy();
    expect(document.querySelector("#appbar .icon-btn[aria-label='Toggle theme']")?.getAttribute("title")).toMatch(/^Theme:/);
  });

  it("shows List + Insights tabs and a provider facet for the live artifact", () => {
    mountShell(config);
    const tabs = [...document.querySelectorAll<HTMLElement>("#viewswitch button:not(.prov-chip)")];
    expect(tabs.map(t => t.textContent)).toEqual(expect.arrayContaining(["List", "Insights"]));
    const facet = document.querySelector("#viewswitch .facet .prov-chip");
    expect(facet?.textContent).toContain("github");
    expect(facet?.className).toContain("on");            // live provider selected by default
  });

  it("switching to an upcoming artifact renders its roadmap placeholder", () => {
    mountShell(config);
    const rail = [...document.querySelectorAll<HTMLElement>("#domainRail button")];
    rail.find(b => b.textContent?.startsWith("Misconfigurations"))!.click();
    expect(document.querySelector("#root .upcoming")).toBeTruthy();
    expect(document.querySelector("#root .badge")?.textContent).toBe("upcoming");
    expect(document.querySelectorAll("#root .prov-roadmap li").length).toBeGreaterThan(0);  // aws/gcp/cloudflare
  });
});
