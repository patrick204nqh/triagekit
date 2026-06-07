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
});
