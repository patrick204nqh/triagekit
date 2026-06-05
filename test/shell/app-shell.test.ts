// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { mountShell } from "../../src/runtime/shell/app-shell";
import type { TriageConfigT } from "../../src/config/schema";

const config: TriageConfigT = {
  source: "github",
  views: ["security-alerts", "insights"],
  scope: {},
  branding: { title: "Acme Triage" },
};

function scaffold() {
  document.body.innerHTML = `<header id="appbar"></header>
    <nav id="domainRail" class="domains"></nav>
    <nav id="viewswitch" class="viewswitch"></nav>
    <main id="root"></main><div id="settings-host"></div>`;
}

describe("mountShell navigation", () => {
  beforeEach(() => { sessionStorage.clear(); localStorage.clear(); scaffold(); });

  it("renders the brand and a domain rail with the live domain active", () => {
    mountShell(config);
    expect(document.querySelector("#appbar .brand .brand-mark")).toBeTruthy();   // funnel mark
    expect(document.querySelector("#appbar .brand .wordmark")?.textContent).toBe("Acme Triage");
    const rail = document.querySelectorAll<HTMLElement>("#domainRail button");
    expect(rail.length).toBeGreaterThan(1);                       // live + roadmap domains
    expect(rail[0].className).toContain("active");                // live domain leads
    expect(rail[0].textContent).toBe("Code & Dependency Security");
  });

  it("shows the live domain's tabs with the first one active", () => {
    mountShell(config);
    const tabs = document.querySelectorAll<HTMLElement>("#viewswitch button");
    expect([...tabs].map(t => t.textContent?.trim())).toEqual(
      expect.arrayContaining(["security-alerts", "insights"]));
    expect([...tabs].find(t => t.textContent === "security-alerts")?.className).toContain("active");
  });

  it("switches to a roadmap domain and renders its upcoming source", () => {
    mountShell(config);
    const rail = [...document.querySelectorAll<HTMLElement>("#domainRail button")];
    rail.find(b => b.textContent === "Cloud & Infra Posture")!.click();
    expect(document.querySelector("#viewswitch .chip")?.textContent).toBe("upcoming");
    expect(document.querySelector("#root .upcoming")).toBeTruthy();
  });
});
