// @vitest-environment jsdom
/**
 * PARITY TEST — scores/tiers/sort unchanged through the re-layered core.
 *
 * Uses a transparent stored score model so expected results are hand-computable.
 * Proves: (a) correct scores→tiers via the stored model, (b) descending sort order.
 *
 * Score model: formula = "cvss * 1", scale = 100, signals.cvss normalised over [0,10].
 *   normalised(cvss) = cvss / 10  →  score = (cvss / 10) * 100 = cvss * 10
 *
 * GOLDEN (arithmetic):
 *   Item A  cvss 10  → score 100  → P0
 *   Item B  cvss  6  → score  60  → P1
 *   Item C  cvss  2  → score  20  → P3
 *
 * Input order is [A(10), C(2), B(6)] — deliberately unsorted — so the descending
 * sort must reorder to [A, B, C] for the golden to hold.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
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
  vi.stubGlobal(
    "matchMedia",
    (q: string) => ({ matches: true, media: q, addEventListener() {}, removeEventListener() {} }) as any,
  );
  document.body.innerHTML = `
    <header id="appbar"></header>
    <nav id="domainRail" class="domains"></nav>
    <nav id="viewswitch" class="viewswitch"></nav>
    <main id="root"></main>
    <div id="settings-host"></div>
  `;
}

// Fixed, unsorted input: cvss values [10, 2, 6] → expected desc sort → [10, 6, 2]
const ITEMS = [
  {
    id: "github:acme/web:10", source: "github", kind: "dependency-vuln",
    title: "critical-pkg", location: "acme/web", signal: 100,
    createdAt: new Date().toISOString(), url: "https://example.test/10",
    details: { package: "critical-pkg", severity: "critical", cvss: 10, scope: "runtime", fixAvailable: true, fixVersion: "2.0.0" },
  },
  {
    id: "github:acme/web:2", source: "github", kind: "dependency-vuln",
    title: "low-pkg", location: "acme/web", signal: 20,
    createdAt: new Date().toISOString(), url: "https://example.test/2",
    details: { package: "low-pkg", severity: "low", cvss: 2, scope: "runtime", fixAvailable: false, fixVersion: "" },
  },
  {
    id: "github:acme/web:6", source: "github", kind: "dependency-vuln",
    title: "medium-pkg", location: "acme/web", signal: 60,
    createdAt: new Date().toISOString(), url: "https://example.test/6",
    details: { package: "medium-pkg", severity: "medium", cvss: 6, scope: "runtime", fixAvailable: true, fixVersion: "1.1.0" },
  },
];

// GOLDEN: expected tiers in descending score order.
// Arithmetic: score = (cvss/10)*100 = cvss*10
//   cvss 10 → 100 → P0
//   cvss  6 →  60 → P1
//   cvss  2 →  20 → P3
const GOLDEN = {
  tiers: ["P0", "P1", "P3"],
  // Packages in the same descending order (proves sort, not just tier presence)
  packages: ["critical-pkg", "medium-pkg", "low-pkg"],
};

describe("parity — scores/tiers/sort unchanged through the re-layered core", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    scaffold();

    // Transparent score model: score = cvss * 10 (normalised cvss over [0,10], scale 100)
    localStorage.setItem("triagekit.policy.score.dependency-vuln", JSON.stringify({
      kind: "dependency-vuln",
      scale: 100,
      formula: "cvss * 1",
      signals: { cvss: { from: "cvss", transform: { type: "linear", in: [0, 10] } } },
      tiers: [{ name: "P0", min: 80 }, { name: "P1", min: 50 }, { name: "P3", min: 0 }],
    }));

    sessionStorage.setItem("triagekit.cred.github", "tok");
    localStorage.setItem("triagekit.scope.github", JSON.stringify({ repos: ["acme/web"] }));

    fetchSpy = vi.spyOn(githubSource, "fetch").mockResolvedValue({
      items: ITEMS,
      errors: [],
    } as any);
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("renders rows in descending score order with correct tiers (golden parity)", async () => {
    bootstrap(config);
    await flush();

    const body = document.querySelector<HTMLElement>("#root .surface-body");
    expect(body).toBeTruthy();

    const rows = [...document.querySelectorAll<HTMLElement>("#root .surface-body .alert-row")];
    expect(rows.length).toBe(3);

    const tiers = [...document.querySelectorAll<HTMLElement>("#root .surface-body .tier")].map(t => t.textContent?.trim());
    expect(tiers).toEqual(GOLDEN.tiers);

    // Verify package names appear in descending score order — proves sort, not just tier presence.
    const rowTexts = rows.map(r => r.textContent ?? "");
    for (let i = 0; i < GOLDEN.packages.length; i++) {
      expect(rowTexts[i]).toContain(GOLDEN.packages[i]);
    }
  });

  it("score model tiers take precedence (not global threshold fallback)", async () => {
    // Clobber global thresholds so the fallback path would yield P3 for every item.
    localStorage.setItem("triagekit.policy.tiers", JSON.stringify({ p0: 9999, p1: 9998, p2: 9997 }));

    bootstrap(config);
    await flush();

    const tiers = [...document.querySelectorAll<HTMLElement>("#root .surface-body .tier")].map(t => t.textContent?.trim());
    // Stored model must win: P0/P1/P3 via model bands, not all-P3 from absurd thresholds.
    expect(tiers).toEqual(GOLDEN.tiers);
  });
});
