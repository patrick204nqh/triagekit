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
  drawer: (r) => { const d = det(r); return `<div class="drawer-inner">
    <h3>${esc(d.package)} <span class="tier tier-${r.tier}">${r.tier}</span></h3>
    <p class="muted">${esc(r.location)} · score ${r.score}</p>
    <dl><dt>Severity</dt><dd>${esc(d.severity)} (CVSS ${d.cvss})</dd>
    <dt>Scope</dt><dd>${esc(d.scope ?? "unknown")}</dd>
    <dt>Fix</dt><dd>${d.fixAvailable ? (d.fixVersion ? "available: " + esc(d.fixVersion) : "available") : "none yet"}</dd>
    <dt>Advisory</dt><dd>${r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noreferrer">${esc(r.url)}</a>` : "—"}</dd></dl>
    <button class="drawer-close">Close</button></div>`; },
};
registerKindRenderer(renderer);
registerView({ id: "security-alerts", kind: DEPENDENCY_VULN });
