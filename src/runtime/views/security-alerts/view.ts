import { type ScoredItem, type KindRenderer, registerKindRenderer, esc } from "../../layout/triage-table";
import { type DependencyVulnDetails, DEPENDENCY_VULN } from "../../dataset/kinds/dependency-vuln";
import { registerView } from "../registry";
import "../../scoring/dependency-vuln";        // side-effect: register scorer
import "../../ingest/github/adapter";          // side-effect: register source

const det = (r: ScoredItem) => r.details as DependencyVulnDetails;
const renderer: KindRenderer = {
  kind: DEPENDENCY_VULN,
  columns: [
    { header: "Package", cell: (r) => esc(det(r).package) },
    { header: "Severity", cell: (r) => { const s = det(r).severity; return `<span class="sev sev-${esc(s)}">${esc(s)}</span>`; } },
  ],
  detail: (host, r) => { const d = det(r); host.innerHTML = `<div class="drawer-inner">
    <h3>${esc(d.package)} <span class="tier tier-${r.tier}">${r.tier}</span></h3>
    <p class="muted">${esc(r.location)} · score ${r.score}</p>
    <dl><dt>Severity</dt><dd>${esc(d.severity)} (CVSS ${d.cvss})</dd>
    <dt>Scope</dt><dd>${esc(d.scope ?? "unknown")}</dd>
    <dt>Fix</dt><dd>${d.fixAvailable ? (d.fixVersion ? "available: " + esc(d.fixVersion) : "available") : "none yet"}</dd>
    <dt>Advisory</dt><dd>${r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noreferrer">${esc(r.url)}</a>` : "—"}</dd></dl></div>`; },
};
registerKindRenderer(renderer);
registerView({ id: "security-alerts", kind: DEPENDENCY_VULN });

import { registerChart } from "../../layout/charts/registry";

const dv = (r: import("../../layout/triage-table").ScoredItem) => r.details as DependencyVulnDetails;

registerChart({
  id: "dv-fixable", title: "Quick wins · fix available", kinds: [DEPENDENCY_VULN],
  render(rows, el) {
    const total = rows.length || 1, fixable = rows.filter(r => dv(r).fixAvailable).length;
    const pct = Math.round(100 * fixable / total);
    el.innerHTML = `<div class="ratio"><div class="big">${pct}%</div>
      <div class="track"><span style="width:${pct}%"></span></div>
      <div class="sub">${fixable} of ${rows.length} have a patched version available</div></div>`;
  },
});
registerChart({
  id: "dv-scope", title: "Runtime vs development", kinds: [DEPENDENCY_VULN],
  render(rows, el) {
    const total = rows.length || 1, rt = rows.filter(r => dv(r).scope === "runtime").length, dev = rows.length - rt;
    el.innerHTML = `<div class="tierbar"><span style="width:${(100 * rt / total).toFixed(2)}%;background:var(--accent)"></span><span style="width:${(100 * dev / total).toFixed(2)}%;background:var(--inert)"></span></div>
      <div class="legend"><span class="it"><span class="sw" style="background:var(--accent)"></span>runtime <span class="n">${rt}</span></span>
      <span class="it"><span class="sw" style="background:var(--inert)"></span>development <span class="n">${dev}</span></span></div>`;
  },
});
