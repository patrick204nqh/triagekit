import { type ScoredItem, type KindRenderer, esc } from "../../layout/triage-table";
import { type CodeScanningDetails, CODE_SCANNING } from "../../dataset/kinds/code-scanning";
import { registerView } from "../registry";
import { type FilterAxis, registerSortKey } from "../../layout/facet-registry";
import { registerChart } from "../../layout/charts/registry";
// TODO(2.4): import "../../ingest/github/code-scanning-source";   // side-effect: register source

const cs = (r: ScoredItem) => r.details as CodeScanningDetails;
const SEV_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

export const codeScanningRenderer: KindRenderer = {
  kind: CODE_SCANNING,
  columns: [
    { header: "Rule", cell: (r) => esc(cs(r).ruleName) },
    { header: "Severity", cell: (r) => { const s = cs(r).securitySeverity; return `<span class="sev sev-${esc(s)}">${esc(s)}</span>`; } },
    { header: "Location", cell: (r) => `${esc(cs(r).location.path)}:${cs(r).location.line}` },
  ],
  detail: (host, r) => {
    const d = cs(r);
    host.innerHTML = `<div class="drawer-inner">
    <h3>${esc(d.ruleName)} <span class="tier tier-${r.tier}">${r.tier}</span></h3>
    <p class="muted">${esc(d.location.path)}:${d.location.line} · score ${r.score}</p>
    <dl><dt>Severity</dt><dd>${esc(d.securitySeverity)}</dd>
    <dt>Rule</dt><dd>${esc(d.ruleId)}</dd>
    <dt>Tool</dt><dd>${esc(d.tool)}</dd>
    <dt>State</dt><dd>${esc(d.state)}</dd>
    <dt>Alert</dt><dd>${d.permalink ? `<a href="${esc(d.permalink)}" target="_blank" rel="noreferrer">${esc(d.permalink)}</a>` : "—"}</dd></dl></div>`;
  },
};
registerView({ id: "code-scanning", kind: CODE_SCANNING });

// Axes are exported, not self-registered: the kind manifest (Task 2.5) passes them to registerKinds → registerFilterAxis.
export const severityAxis: FilterAxis = {
  id: "cs-severity", label: "Severity", widget: "chips", quick: false,
  appliesTo: (rows) => rows.some(r => r.kind === CODE_SCANNING),
  optionsFrom: (rows) => [...new Set(rows.filter(r => r.kind === CODE_SCANNING).map(r => cs(r).securitySeverity))]
    .sort((a, b) => (SEV_RANK[b] ?? 0) - (SEV_RANK[a] ?? 0)).map(s => ({ value: s, label: s })),
  test: (i, sel) => i.kind === CODE_SCANNING && sel.includes(cs(i).securitySeverity),
};

export const toolAxis: FilterAxis = {
  id: "cs-tool", label: "Tool", widget: "chips", quick: false,
  appliesTo: (rows) => rows.some(r => r.kind === CODE_SCANNING),
  optionsFrom: (rows) => [...new Set(rows.filter(r => r.kind === CODE_SCANNING).map(r => cs(r).tool))]
    .sort().map(t => ({ value: t, label: t })),
  test: (i, sel) => i.kind === CODE_SCANNING && sel.includes(cs(i).tool),
};

export const stateAxis: FilterAxis = {
  id: "cs-state", label: "State", widget: "chips", quick: false,
  appliesTo: (rows) => rows.some(r => r.kind === CODE_SCANNING),
  optionsFrom: () => [{ value: "open", label: "Open" }, { value: "dismissed", label: "Dismissed" }, { value: "fixed", label: "Fixed" }],
  test: (i, sel) => i.kind === CODE_SCANNING && sel.includes(cs(i).state),
};

registerSortKey({
  id: "cs-severity", label: "Severity",
  compare: (a, b) => {
    const sa = a.kind === CODE_SCANNING ? (SEV_RANK[cs(a).securitySeverity] ?? 0) : 0;
    const sb = b.kind === CODE_SCANNING ? (SEV_RANK[cs(b).securitySeverity] ?? 0) : 0;
    return (sb - sa) || (b.score - a.score);
  },
});

export const renderOpenBySev = (rows: ScoredItem[], el: HTMLElement): void => {
  const csRows = rows.filter(r => r.kind === CODE_SCANNING);
  const open = csRows.filter(r => cs(r).state === "open");
  const counts = (["critical", "high", "medium", "low"] as const).map(s => ({ s, n: open.filter(r => cs(r).securitySeverity === s).length }));
  const max = Math.max(1, ...counts.map(c => c.n));
  el.innerHTML = `<div class="barlist">${counts.map(c =>
    `<div class="barrow"><span class="bl">${c.s}</span><span class="track"><span style="width:${(100 * c.n / max).toFixed(1)}%"></span></span><span class="n">${c.n}</span></div>`).join("")}</div>`;
};
registerChart({
  id: "cs-open-by-sev", title: "Open by severity", kinds: [CODE_SCANNING],
  render: renderOpenBySev,
});

export const renderByTool = (rows: ScoredItem[], el: HTMLElement): void => {
  const csRows = rows.filter(r => r.kind === CODE_SCANNING);
  const tools = [...new Set(csRows.map(r => cs(r).tool))].sort();
  const total = csRows.length || 1;
  el.innerHTML = `<div class="barlist">${tools.map(t => {
    const n = csRows.filter(r => cs(r).tool === t).length;
    return `<div class="barrow"><span class="bl">${esc(t)}</span><span class="track"><span style="width:${(100 * n / total).toFixed(1)}%"></span></span><span class="n">${n}</span></div>`;
  }).join("")}</div>`;
};
registerChart({
  id: "cs-by-tool", title: "By tool", kinds: [CODE_SCANNING],
  render: renderByTool,
});
