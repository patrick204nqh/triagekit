import type { ScoredItem } from "./triage-table";
import type { Kind } from "../dataset/item";
import type { Tier } from "../scoring/tier";
import type { Artifact } from "../dataset/artifact";
import { esc } from "./triage-table";

// Client-side filter axes the shell owns. WHERE (provider) is NOT here — it stays
// a fetch-level facet in app-shell. SCOPE/WHAT/STATE filter already-fetched rows.
export interface FacetState {
  scope: string;            // location, or "all"
  kind: Kind | "all";
  tiers: Set<Tier>;         // empty = all tiers
  author: "all" | "bot" | "human";
  sort: "priority" | "recent";
}

export function emptyFacetState(): FacetState {
  return { scope: "all", kind: "all", tiers: new Set(), author: "all", sort: "priority" };
}

// author.kind lives only on review items (ReviewDetails); read it defensively.
function authorKind(i: ScoredItem): string | undefined {
  return (i.details as { author?: { kind?: string } } | null | undefined)?.author?.kind;
}

const TIERS: Tier[] = ["P0", "P1", "P2", "P3"];
const KIND_LABEL: Record<string, string> = {
  "pull-request": "Pull requests", "issue": "Issues",
  "dependency-vuln": "Dependency", "code-scanning": "Code scanning",
  "secret-scanning": "Secrets", "infra-misconfig": "Infra",
  "edge-misconfig": "Edge", "waf-finding": "WAF", "work-item": "Tasks",
};
const kindLabel = (k: Kind): string => KIND_LABEL[k] ?? k;

// Render scope/kind/tier/author/sort axes into `host`, auto-deriving which appear
// from the artifact + rows. Presentation + events only — never fetches. Each
// handler clones `state` and emits the next state via onChange.
export function renderFacetBar(
  host: HTMLElement, artifact: Artifact, rows: ScoredItem[],
  state: FacetState, onChange: (next: FacetState) => void,
): void {
  const scopes = [...new Set(rows.map(r => r.location))].sort();
  const showScope = scopes.length >= 2;
  const showKind = artifact.kinds.length >= 2;
  const showAuthor = rows.length > 0 && rows.every(r => authorKind(r) !== undefined);

  const chip = (attr: string, val: string, label: string, on: boolean) =>
    `<button class="facet-chip${on ? " on" : ""}" ${attr}="${esc(val)}">${esc(label)}</button>`;

  const label = (text: string) => `<span class="facet-label">${esc(text)}</span>`;

  const scopeHtml = showScope
    ? `<div class="facet-group" data-axis="scope">${label("Repo")}<select class="facet-scope" aria-label="Filter by scope">`
      + [`<option value="all">All repos</option>`,
         ...scopes.map(s => `<option value="${esc(s)}"${state.scope === s ? " selected" : ""}>${esc(s)}</option>`)].join("")
      + `</select></div>`
    : "";

  const kindHtml = showKind
    ? `<div class="facet-group" data-axis="kind">${label("Type")}`
      + chip("data-kind", "all", "All", state.kind === "all")
      + artifact.kinds.map(k => chip("data-kind", k, kindLabel(k), state.kind === k)).join("")
      + `</div>`
    : "";

  const tierHtml = `<div class="facet-group" data-axis="tier">${label("Priority")}`
    + TIERS.map(t => chip("data-tier", t, t, state.tiers.has(t))).join("")
    + `</div>`;

  const authorHtml = showAuthor
    ? `<div class="facet-group" data-axis="author">${label("Author")}`
      + (["all", "bot", "human"] as const).map(a =>
          chip("data-author", a, a === "all" ? "All" : a[0].toUpperCase() + a.slice(1), state.author === a)).join("")
      + `</div>`
    : "";

  const sortHtml = `<div class="facet-group" data-axis="sort">${label("Sort")}`
    + chip("data-sort", "priority", "Priority", state.sort === "priority")
    + chip("data-sort", "recent", "Recent", state.sort === "recent")
    + `</div>`;

  host.innerHTML = `<div class="facet-bar">${scopeHtml}${kindHtml}${tierHtml}${authorHtml}${sortHtml}</div>`
    + `<div class="facet-summary">${esc(summarize(artifact, state, rows.length))}</div>`;

  const emit = (mut: (s: FacetState) => FacetState) =>
    onChange(mut({ ...state, tiers: new Set(state.tiers) }));

  host.querySelector<HTMLSelectElement>(".facet-scope")
    ?.addEventListener("change", e => emit(s => { s.scope = (e.target as HTMLSelectElement).value; return s; }));
  host.querySelectorAll<HTMLElement>("[data-kind]").forEach(b =>
    b.addEventListener("click", () => emit(s => { s.kind = b.dataset.kind as FacetState["kind"]; return s; })));
  host.querySelectorAll<HTMLElement>("[data-tier]").forEach(b =>
    b.addEventListener("click", () => emit(s => {
      const t = b.dataset.tier as Tier; s.tiers.has(t) ? s.tiers.delete(t) : s.tiers.add(t); return s;
    })));
  host.querySelectorAll<HTMLElement>("[data-author]").forEach(b =>
    b.addEventListener("click", () => emit(s => { s.author = b.dataset.author as FacetState["author"]; return s; })));
  host.querySelectorAll<HTMLElement>("[data-sort]").forEach(b =>
    b.addEventListener("click", () => emit(s => { s.sort = b.dataset.sort as FacetState["sort"]; return s; })));
}

// One-line read-only state summary: concern ▸ scope ▸ kind ▸ tiers.
function summarize(artifact: Artifact, s: FacetState, count: number): string {
  const parts = [artifact.label];
  if (s.scope !== "all") parts.push(s.scope);
  if (s.kind !== "all") parts.push(kindLabel(s.kind));
  if (s.tiers.size) parts.push([...s.tiers].sort().join(" "));
  if (s.author !== "all") parts.push(s.author);
  return `${parts.join(" ▸ ")} · ${count} shown`;
}

// Pure: filter by scope/kind/tiers/author, then order by sort.
export function applyFacets(rows: ScoredItem[], s: FacetState): ScoredItem[] {
  const filtered = rows.filter(i =>
    (s.scope === "all" || i.location === s.scope) &&
    (s.kind === "all" || i.kind === s.kind) &&
    (s.tiers.size === 0 || s.tiers.has(i.tier)) &&
    (s.author === "all" || authorKind(i) === s.author));
  return [...filtered].sort(s.sort === "recent"
    ? (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)
    : (a, b) => b.score - a.score);
}
