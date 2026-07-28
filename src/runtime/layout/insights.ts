import type { TriageFailure } from "../catalog/types";
import type { Kind } from "../dataset/item";
import type { InsightRoute } from "../insights/routes";
import type {
  CoverageMetric,
  InsightSnapshot,
} from "../insights/types";
import { esc } from "./util";

export interface RenderInsightsOptions {
  state: "loading" | "partial" | "empty" | "ready";
  emptyReason?: "no-provider" | "no-scope" | "no-items" | "unavailable";
  failures?: readonly TriageFailure[];
  onRoute(route: InsightRoute): void;
}

const EMPTY_COPY: Record<
  NonNullable<RenderInsightsOptions["emptyReason"]>,
  { title: string; body: string }
> = {
  "no-provider": {
    title: "Connect a provider",
    body: "Insights needs a connected provider before it can inspect the backlog.",
  },
  "no-scope": {
    title: "Choose repositories",
    body: "Add at least one repository to build the operator briefing.",
  },
  "no-items": {
    title: "No open items",
    body: "The configured scope has no open work to summarize.",
  },
  unavailable: {
    title: "Insights unavailable",
    body: "None of the configured surfaces could be refreshed.",
  },
};

function coverageHtml(label: string, metric: CoverageMetric): string {
  if (metric.status === "unavailable") {
    return `<div class="insight-coverage-row"><span>${esc(label)} coverage unavailable</span><span class="muted">not supported by these surfaces</span></div>`;
  }
  const percentage = metric.denominator === 0
    ? 0
    : Math.round(metric.ratio * 100);
  return `<div class="insight-coverage-row"><span>${esc(label)} coverage</span><strong class="tnum">${percentage}%</strong><span class="muted">${metric.numerator} of ${metric.denominator}</span></div>`;
}

function failureHtml(failures: readonly TriageFailure[]): string {
  if (failures.length === 0) return "";
  return `<ul class="insight-failures">${failures.map((failure) =>
    `<li><span class="tnum">${esc(failure.kind ?? failure.provider)}</span> ${esc(failure.message)}</li>`
  ).join("")}</ul>`;
}

export function renderInsights(
  root: HTMLElement,
  snapshot: InsightSnapshot | null,
  options: RenderInsightsOptions,
): void {
  if (options.state === "loading") {
    root.innerHTML = `
      <div class="insight-loading" aria-busy="true">
        <h1>Operator briefing</h1>
        <p role="status">Refreshing all surfaces…</p>
        <div class="insight-skeleton" aria-hidden="true"></div>
      </div>`;
    return;
  }

  if (options.state === "empty" || !snapshot) {
    const copy = EMPTY_COPY[options.emptyReason ?? "unavailable"];
    root.innerHTML = `
      <div class="empty insight-empty">
        <h1>${esc(copy.title)}</h1>
        <p>${esc(copy.body)}</p>
      </div>`;
    return;
  }

  const readyCount = snapshot.coverage.readyKinds.length;
  const refreshedCount = snapshot.coverage.refreshedKinds.length;
  const partial = options.state === "partial" || refreshedCount < readyCount;
  const leadKind = snapshot.concentrations[0]?.kinds[0]
    ?? snapshot.coverage.readyKinds[0];
  const attentionAction = leadKind
    ? `<button class="act primary" data-attention data-kind="${esc(leadKind)}">Review this queue</button>`
    : "";
  const concentrations = snapshot.concentrations.length
    ? `<ol class="insight-ranking">${snapshot.concentrations.map((entry) => {
        const kind = entry.kinds[0];
        const action = kind
          ? ` data-kind="${esc(kind)}"`
          : " disabled";
        return `<li>
          <button class="insight-rank-row" data-concentration="${esc(entry.location)}"${action} aria-label="Open ${esc(entry.location)} priority queue">
            <span class="insight-rank-name tnum" title="${esc(entry.location)}">${esc(entry.location)}</span>
            <span class="insight-rank-tiers"><strong>${entry.tiers.P0} P0</strong><span>${entry.tiers.P1} P1</span><span>${entry.total} open</span></span>
          </button>
        </li>`;
      }).join("")}</ol>`
    : `<p class="muted">No repository concentration is available.</p>`;
  const diagnostics = snapshot.diagnostics.length
    ? `<ul class="insight-diagnostics">${snapshot.diagnostics.map((entry) => {
        const action = entry.actionId
          ? `<button class="act" data-diagnostic-action="${entry.actionId}">${entry.actionId === "scoring" ? "Review scoring" : "Review filters"}</button>`
          : "";
        return `<li class="insight-diagnostic" data-severity="${entry.severity}">
          <div><strong>${esc(entry.title)}</strong><p>${esc(entry.explanation)}</p></div>
          ${action}
        </li>`;
      }).join("")}</ul>`
    : `<p class="muted">No effectiveness limits were detected.</p>`;

  root.innerHTML = `
    <article class="insight-briefing">
      <header class="insight-heading">
        <div>
          <h1>Operator briefing</h1>
          <p>Current snapshot across Findings and Work</p>
        </div>
        <span class="insight-freshness tnum">${snapshot.totals.all} open</span>
      </header>
      ${partial
        ? `<aside class="insight-partial" role="status"><strong>${refreshedCount} of ${readyCount} surfaces refreshed</strong>${failureHtml(options.failures ?? [])}</aside>`
        : ""}
      <section class="insight-attention" data-section="attention">
        <h2>Attention now</h2>
        <p><strong>${snapshot.attention.urgent} P0/P1 items</strong> need attention; ${snapshot.attention.directlyActionable} of ${snapshot.attention.actionableUrgentDenominator} supported urgent items have a direct remediation path.</p>
        ${attentionAction}
      </section>
      <div class="insight-columns">
        <section data-section="concentration">
          <h2>Where risk concentrates</h2>
          <p class="muted">Severity before raw volume.</p>
          ${concentrations}
        </section>
        <section data-section="pressure">
          <h2>Backlog pressure</h2>
          <dl class="insight-age">
            <div><dt>&lt;7 days</dt><dd>${snapshot.age.under7Days}</dd></div>
            <div><dt>7–30 days</dt><dd>${snapshot.age.from7To30Days}</dd></div>
            <div><dt>30–90 days</dt><dd>${snapshot.age.from30To90Days}</dd></div>
            <div><dt>&gt;90 days</dt><dd>${snapshot.age.over90Days}</dd></div>
          </dl>
          <p class="muted"><span class="tnum">${snapshot.age.staleHighPriority}</span> stale high-priority · oldest <span class="tnum">${snapshot.age.oldestDays}d</span></p>
        </section>
      </div>
      <section data-section="coverage">
        <h2>Actionability and coverage</h2>
        <div class="insight-coverage">
          ${coverageHtml("Actionability", snapshot.actionability)}
          ${coverageHtml("Ownership", snapshot.ownership)}
          ${coverageHtml("Evidence", snapshot.evidence)}
        </div>
      </section>
      <section data-section="effectiveness">
        <h2>Function effectiveness</h2>
        ${diagnostics}
      </section>
    </article>`;

  root.querySelector<HTMLElement>("[data-attention]")?.addEventListener(
    "click",
    (event) => {
      const kind = (event.currentTarget as HTMLElement).dataset.kind;
      if (!kind) return;
      options.onRoute({
        destination: "list",
        kind: kind as Kind,
        filters: { tier: ["P0", "P1"] },
      });
    },
  );
  root.querySelectorAll<HTMLElement>("[data-concentration]").forEach((button) => {
    button.addEventListener("click", () => {
      const kind = button.dataset.kind;
      if (!kind) return;
      options.onRoute({
        destination: "list",
        kind: kind as Kind,
        repository: button.dataset.concentration,
        filters: { tier: ["P0", "P1"] },
      });
    });
  });
  root.querySelectorAll<HTMLElement>("[data-diagnostic-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const destination = button.dataset.diagnosticAction;
      if (destination === "scoring" || destination === "filters") {
        options.onRoute({ destination });
      }
    });
  });
}
