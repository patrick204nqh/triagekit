import { type ScoredItem, type KindRenderer } from "../../layout/table/kind-renderer";
import { esc } from "../../layout/util";
import { type DependencyVulnDetails, DEPENDENCY_VULN } from "../../dataset/kinds/dependency-vuln";
import { detailsAs } from "../../dataset/details";
import type { DetailView } from "../../layout/table/detail-view";
import type { ViewModule } from "../registry";

const det = (r: ScoredItem) => detailsAs<DependencyVulnDetails>(r)!;

// Footer "Open in provider" link — the shared shape for security kinds that
// have no write actions, so every detail still has a footer.
export function openLink(url: string, label: string): (host: HTMLElement) => void {
  return (host) => {
    host.innerHTML = url
      ? `<a class="act" data-action="open" href="${esc(url)}" target="_blank" rel="noreferrer">${esc(label)} ↗</a>`
      : "";
  };
}

export function dependencyVulnDetailView(r: ScoredItem): DetailView {
  const d = det(r);
  return {
    header: { title: d.package, tier: r.tier, provider: r.provider },
    body: (host) => {
      host.innerHTML = `<dl>
        <dt>Severity</dt><dd>${esc(d.severity)} (CVSS ${d.cvss})</dd>
        <dt>Scope</dt><dd>${esc(d.scope ?? "unknown")}</dd>
        <dt>Fix</dt><dd>${d.fixAvailable ? (d.fixVersion ? "available: " + esc(d.fixVersion) : "available") : "none yet"}</dd>
        <dt>Advisory</dt><dd>${r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noreferrer">${esc(r.url)}</a>` : "—"}</dd></dl>`;
    },
    actions: openLink(r.url, "Open advisory"),
  };
}

export const dependencyVulnRenderer: KindRenderer = {
  kind: DEPENDENCY_VULN,
  columns: [
    { header: "Package", cell: (r) => esc(det(r).package) },
    { header: "Severity", cell: (r) => { const s = det(r).severity; return `<span class="sev sev-${esc(s)}">${esc(s)}</span>`; } },
  ],
  detail: (r) => dependencyVulnDetailView(r),
};
export const dependencyVulnView: ViewModule = {
  id: "code-security",
  kind: DEPENDENCY_VULN,
};

import type { TriageChart } from "../../layout/charts/registry";
import type { FilterAxis, SortKey } from "../../layout/toolbar/axis-registry";

const SEV_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, moderate: 2, low: 1 };

export const severityAxis: FilterAxis = {
  id: "severity", label: "Severity", widget: "chips", quick: false,
  appliesTo: (rows) => rows.some(r => r.kind === DEPENDENCY_VULN),
  optionsFrom: (rows) => [...new Set(rows.filter(r => r.kind === DEPENDENCY_VULN).map(r => det(r).severity))]
    .sort((a, b) => (SEV_RANK[b] ?? 0) - (SEV_RANK[a] ?? 0)).map(s => ({ value: s, label: s })),
  test: (i, sel) => i.kind === DEPENDENCY_VULN && sel.includes(det(i).severity),
};
export const fixAvailableAxis: FilterAxis = {
  id: "fix-available", label: "Fix", widget: "chips", quick: false,
  appliesTo: (rows) => rows.some(r => r.kind === DEPENDENCY_VULN),
  optionsFrom: () => [{ value: "yes", label: "Fix available" }, { value: "no", label: "No fix" }],
  test: (i, sel) => i.kind === DEPENDENCY_VULN && sel.includes(det(i).fixAvailable ? "yes" : "no"),
};
export const dependencyVulnSeveritySort: SortKey = {
  id: "severity", label: "Severity",
  appliesTo: (ctx) => ctx.artifact.kinds.includes(DEPENDENCY_VULN),   // scope to the dependencies tab; otherwise it leaks onto every list
  compare: (a, b) => {
    const sa = a.kind === DEPENDENCY_VULN ? (SEV_RANK[det(a).severity] ?? 0) : 0;
    const sb = b.kind === DEPENDENCY_VULN ? (SEV_RANK[det(b).severity] ?? 0) : 0;
    return (sb - sa) || (b.score - a.score);
  },
};

export const dependencyVulnFixableChart: TriageChart = {
  id: "dv-fixable", title: "Quick wins · fix available", kinds: [DEPENDENCY_VULN],
  render(rows, el) {
    const total = rows.length || 1, fixable = rows.filter(r => det(r).fixAvailable).length;
    const pct = Math.round(100 * fixable / total);
    el.innerHTML = `<div class="ratio"><div class="big">${pct}%</div>
      <div class="track"><span style="width:${pct}%"></span></div>
      <div class="sub">${fixable} of ${rows.length} have a patched version available</div></div>`;
  },
};
export const dependencyVulnScopeChart: TriageChart = {
  id: "dv-scope", title: "Runtime vs development", kinds: [DEPENDENCY_VULN],
  render(rows, el) {
    const total = rows.length || 1, rt = rows.filter(r => det(r).scope === "runtime").length, dev = rows.length - rt;
    el.innerHTML = `<div class="tierbar"><span style="width:${(100 * rt / total).toFixed(2)}%;background:var(--accent)"></span><span style="width:${(100 * dev / total).toFixed(2)}%;background:var(--inert)"></span></div>
      <div class="legend"><span class="it"><span class="sw" style="background:var(--accent)"></span>runtime <span class="n">${rt}</span></span>
      <span class="it"><span class="sw" style="background:var(--inert)"></span>development <span class="n">${dev}</span></span></div>`;
  },
};

export const dependencyVulnSorts: readonly SortKey[] = Object.freeze([
  dependencyVulnSeveritySort,
]);
export const dependencyVulnCharts: readonly TriageChart[] = Object.freeze([
  dependencyVulnFixableChart,
  dependencyVulnScopeChart,
]);
