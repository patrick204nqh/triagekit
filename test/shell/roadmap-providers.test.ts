// @vitest-environment jsdom
// Roadmap providers (gitlab/bitbucket) are registered as upcoming stubs in
// ingest/upcoming.ts and must surface as non-selectable "soon" chips in the
// provider switch for the code-security artifacts they advertise.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { bootstrap } from "../../src/runtime/bootstrap";
import type { TriageConfigT } from "../../src/config/schema";

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

describe("roadmap providers surface as 'soon' in the provider switch", () => {
  beforeEach(() => { sessionStorage.clear(); localStorage.clear(); history.replaceState(null, "", "/"); scaffold(); });

  it("lists gitlab and bitbucket as non-selectable soon chips alongside the live github source", () => {
    bootstrap(config);
    const opts = [...document.querySelectorAll<HTMLElement>("#viewswitch .prov-opt")];
    const ids = opts.map(b => b.dataset.prov);
    const soon = opts.filter(b => b.querySelector(".prov-soon")).map(b => b.dataset.prov);

    // The default (Dependencies) artifact is served live by github and advertised
    // by the gitlab + bitbucket roadmap stubs.
    expect(ids).toEqual(expect.arrayContaining(["github", "gitlab", "bitbucket"]));
    expect(soon).toEqual(expect.arrayContaining(["gitlab", "bitbucket"]));
    expect(soon).not.toContain("github");   // the live source is selectable, not "soon"

    // Upcoming providers are marked non-selectable.
    const gitlab = opts.find(b => b.dataset.prov === "gitlab")!;
    expect(gitlab.getAttribute("aria-disabled")).toBe("true");
  });

  it("shows the GitHub brand mark on the Change requests artifact (source id 'github-review', provider 'github')", () => {
    bootstrap(config);
    // Navigate to the change-request artifact, whose live source id is "github-review".
    const cr = [...document.querySelectorAll<HTMLElement>("#domainRail button")]
      .find(b => /Change requests/.test(b.textContent || ""));
    cr!.click();
    const chip = document.querySelector<HTMLElement>("#viewswitch [data-prov='github-review']")!;
    expect(chip).not.toBeNull();
    // Brand resolves by provider ("github") — a real path, not the lettered monogram.
    expect(chip.querySelector("path")).not.toBeNull();
    expect(chip.querySelector(".prov-mono")).toBeNull();
  });
});
