// @vitest-environment jsdom
// End-to-end: repo tabs must appear in the .fbar once fetched data spans >1 repo.
// Regression guard for the toolbar not being rebuilt on data arrival (repo options
// derive from lastRows, which is [] at initial buildNav() and only populated post-fetch).
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

const vuln = (loc: string, n: number) => ({
  id: `github:${loc}:${n}`, source: "github", kind: "dependency-vuln",
  title: `vuln-${loc}-${n}`, location: loc, signal: 100,
  createdAt: new Date().toISOString(), url: `https://github.com/${loc}/security/dependabot/${n}`,
  details: { package: "p", severity: "critical", cvss: 10, scope: "runtime", fixAvailable: true, fixVersion: "1.0.0" },
});

describe("repo tabs render end-to-end after data loads", () => {
  beforeEach(() => { sessionStorage.clear(); localStorage.clear(); history.replaceState(null, "", "/"); scaffold(); });

  it("shows All + count-descending repo tabs (with overflow) in the .fbar when loaded rows span >1 repo", async () => {
    sessionStorage.setItem("triagekit.cred.github", "tok");
    localStorage.setItem("triagekit.scope.github", JSON.stringify({ repos: ["acme/web", "acme/api", "acme/cli", "acme/docs"] }));

    // web x4, api x3, cli x2, docs x1 → 4 distinct repos, count-descending web > api > cli > docs.
    const fetchSpy = vi.spyOn(githubSource, "fetch").mockResolvedValue({
      items: [
        vuln("acme/web", 1), vuln("acme/web", 2), vuln("acme/web", 3), vuln("acme/web", 4),
        vuln("acme/api", 1), vuln("acme/api", 2), vuln("acme/api", 3),
        vuln("acme/cli", 1), vuln("acme/cli", 2),
        vuln("acme/docs", 1),
      ],
      errors: [],
    } as any);

    try {
      bootstrap(config);
      await flush();

      const fbar = document.querySelector(".fbar");
      expect(fbar).not.toBeNull();

      const inline = [...document.querySelectorAll<HTMLElement>(".fbar [data-repo]")].map(b => b.dataset.repo);
      // "All" + the top-MAX_REPO_TABS(3) repos inline (count-descending), the rest in overflow.
      expect(inline).toEqual(["", "acme/web", "acme/api", "acme/cli"]);
      // The 4th repo (docs) sits in the +N overflow control, not inline.
      const more = document.querySelector(".fbar .repo-more");
      expect(more?.textContent).toContain("1");    // +1 overflow (acme/docs)
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("renders no repo tabs when loaded rows are confined to a single repo", async () => {
    sessionStorage.setItem("triagekit.cred.github", "tok");
    localStorage.setItem("triagekit.scope.github", JSON.stringify({ repos: ["acme/web"] }));
    const fetchSpy = vi.spyOn(githubSource, "fetch").mockResolvedValue({
      items: [vuln("acme/web", 1), vuln("acme/web", 2)],
      errors: [],
    } as any);
    try {
      bootstrap(config);
      await flush();
      // Single distinct repo → renderRepoTabs renders nothing.
      expect(document.querySelectorAll(".fbar [data-repo]").length).toBe(0);
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
