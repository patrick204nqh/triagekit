import type { Source, Scope, DiscoveryOption } from "../ingest/source";
import { getDomain } from "../dataset/domain";
import type { CredStore } from "./cred-store";
import type { ScopeStore } from "./scope-store";
import { scopeSummary } from "./health";
import { providerIcon } from "./provider-icons";
import { getThemeChoice, setThemeChoice, type ThemeChoice } from "./theme";
import { getRefreshInterval, setRefreshInterval, REFRESH_OPTIONS } from "./refresh";

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}
interface Opts {
  sources: Source[]; creds: CredStore; scopes: ScopeStore;
  onChange: () => void;            // credentials/scope committed or cleared
  onThemeChange?: () => void;      // theme applied (resync the top-right toggle)
  onRefreshChange?: () => void;    // auto-refresh cadence changed (reset the timer)
}

// Discovery results cached per source+credential so re-opening Settings or
// re-filtering never re-hits the API; a "Re-scan" action forces a fresh call.
const discoverCache = new Map<string, DiscoveryOption[]>();
function fingerprint(token: string): string {
  let h = 0; for (let i = 0; i < token.length; i++) h = (h * 31 + token.charCodeAt(i)) | 0;
  return h.toString(36);
}

export function mountSettings(host: HTMLElement, opts: Opts) {
  const { sources, creds, scopes, onChange, onThemeChange, onRefreshChange } = opts;
  host.innerHTML = `<div class="scrim" data-scrim></div>
    <aside class="sheet panel" data-panel aria-hidden="true">
      <div class="panel-head"><h3>Settings</h3><button class="icon-btn" data-close aria-label="Close"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>
      <div class="panel-body">
        <section class="set-section"><label class="set-label">Appearance</label>
          <div class="seg" data-theme-seg></div></section>
        <section class="set-section"><label class="set-label">Auto-refresh</label>
          <div class="seg" data-refresh-seg></div>
          <span class="set-helper">Re-fetch on a timer. Snapshot only — there is no backend history to trend.</span></section>
        <section class="set-section"><label class="set-label">Connections</label>
          <input class="conn-filter" data-conn-filter type="text" placeholder="Filter integrations…" aria-label="Filter integrations"/>
          <div class="conn-list" data-conns></div>
          <span class="set-helper">One credential per provider — kept in this tab only (session), never persisted or embedded.</span></section>
        <section class="set-section"><label class="set-label">Data</label>
          <div class="data-actions">
            <button class="btn-ghost" data-clear="creds">Clear credentials</button>
            <button class="btn-ghost" data-clear="scope">Clear saved scope</button></div>
          <span class="set-helper">Credentials live in this tab's session; scope is saved in this browser.</span></section>
      </div>
      <div class="panel-foot"><button class="btn-ghost" data-cancel>Cancel</button><button class="btn-primary" data-save>Save</button></div>
    </aside>`;
  const scrim = host.querySelector<HTMLElement>("[data-scrim]")!;
  const panel = host.querySelector<HTMLElement>("[data-panel]")!;
  const conns = host.querySelector<HTMLElement>("[data-conns]")!;
  const seg = host.querySelector<HTMLElement>("[data-theme-seg]")!;
  const rseg = host.querySelector<HTMLElement>("[data-refresh-seg]")!;
  const filter = host.querySelector<HTMLInputElement>("[data-conn-filter]")!;

  // Credential/scope edits are staged and committed on Save; theme + clear apply now.
  const draftCred = new Map<string, string>();
  const draftScope = new Map<string, Scope>();
  const getCred = (id: string) => draftCred.has(id) ? draftCred.get(id)! : (creds.get(id) ?? "");
  const getScope = (id: string) => draftScope.has(id) ? draftScope.get(id)! : scopes.get(id);
  const isConnected = (s: Source) => s.status !== "upcoming" && !!getCred(s.id);
  let expanded: string | null = null;

  const byId = (id: string) => sources.find(s => s.id === id)!;

  function renderTheme() {
    const choice = getThemeChoice();
    const opt = (v: ThemeChoice, label: string) =>
      `<button data-theme="${v}" class="${v === choice ? "on" : ""}">${label}</button>`;
    seg.innerHTML = opt("auto", "Auto") + opt("light", "Light") + opt("dark", "Dark");
    seg.querySelectorAll<HTMLElement>("[data-theme]").forEach(b =>
      b.addEventListener("click", () => { setThemeChoice(b.dataset.theme as ThemeChoice); renderTheme(); onThemeChange?.(); }));
  }

  function renderRefresh() {
    const cur = getRefreshInterval();
    rseg.innerHTML = REFRESH_OPTIONS.map(o => `<button data-refresh="${o.value}" class="${o.value === cur ? "on" : ""}">${esc(o.label)}</button>`).join("");
    rseg.querySelectorAll<HTMLElement>("[data-refresh]").forEach(b =>
      b.addEventListener("click", () => { setRefreshInterval(Number(b.dataset.refresh)); renderRefresh(); onRefreshChange?.(); }));
  }

  // ── Integrations catalog: Connected on top, Available below, filterable ──
  function renderConns() {
    const q = filter.value.trim().toLowerCase();
    const matches = (s: Source) => !q || s.id.toLowerCase().includes(q) || getDomain(s.domain).label.toLowerCase().includes(q);
    const visible = sources.filter(matches);
    const connected = visible.filter(isConnected);
    const available = visible.filter(s => !isConnected(s));

    const row = (s: Source) => {
      const open = expanded === s.id;
      const off = s.status === "upcoming";
      const action = off ? `<span class="cstat">upcoming</span>`
        : isConnected(s) ? `<span class="cstat">connected</span>`
        : `<span class="cstat add">+ Add</span>`;
      const chev = off ? "" : `<svg class="chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m6 9 6 6 6-6"/></svg>`;
      return `<div class="conn ${open ? "open" : ""}">
        <button class="conn-item ${isConnected(s) ? "ok" : ""}" data-src="${esc(s.id)}" aria-expanded="${open}" ${off ? "disabled" : ""}>
          ${providerIcon(s.id, 16)}<span class="cinfo"><span class="cname">${esc(s.id)}</span>
          <span class="cmeta">${esc(getDomain(s.domain).label)} · ${esc(scopeSummary(s, getScope(s.id)))}</span></span>
          ${action}${chev}</button>
        <div class="conn-body" data-body="${esc(s.id)}" ${open ? "" : "hidden"}></div></div>`;
    };
    const group = (label: string, list: Source[]) => list.length
      ? `<div class="conn-group"><span class="conn-group-label">${label}<span class="count">${list.length}</span></span>${list.map(row).join("")}</div>` : "";

    conns.innerHTML = group("Connected", connected) + group("Available", available)
      || `<p class="muted">No integrations match “${esc(filter.value)}”.</p>`;
    conns.querySelectorAll<HTMLElement>(".conn-item:not([disabled])").forEach(b =>
      b.addEventListener("click", () => { const id = b.dataset.src!; expanded = expanded === id ? null : id; renderConns(); }));
    if (expanded && visible.some(s => s.id === expanded)) renderForm(expanded);
  }

  function renderForm(id: string) {
    const body = conns.querySelector<HTMLElement>(`[data-body="${id}"]`);
    if (!body) return;
    const s = byId(id); const off = s.status === "upcoming"; const scope = getScope(id);
    let html = `<div class="set-group"><label class="set-label">Credential</label>
        <input type="password" data-cred ${off ? "disabled" : ""} value="${getCred(id) ? "••••••••" : ""}" placeholder="token / key — stored in this tab only"/>
        <span class="set-helper">Session-only, never persisted or embedded.</span></div>`;
    for (const f of s.scopeSchema) {
      html += `<div class="set-group"><label class="set-label">${esc(f.label)}</label>`;
      if (f.discoverable) {
        const cached = getCred(id) ? discoverCache.get(`${id}:${fingerprint(getCred(id))}`) : undefined;
        const verb = cached ? "Re-scan" : "Find";
        const tail = cached ? esc(f.label.toLowerCase()) : `${esc(f.label.toLowerCase())} I can access`;
        html += `<button class="btn-ghost" data-discover="${esc(f.key)}" ${off ? "disabled" : ""}>${verb} ${tail}</button>
           <div class="discovery" data-list="${esc(f.key)}"></div>`;
      } else {
        html += `<input type="text" data-field="${esc(f.key)}" ${off ? "disabled" : ""} value="${esc(((scope[f.key] as string[]) ?? []).join(", "))}" placeholder="${esc(f.label)} (comma-separated)"/>`;
      }
      html += `</div>`;
    }
    body.innerHTML = html;

    const cred = body.querySelector<HTMLInputElement>("[data-cred]");
    cred?.addEventListener("input", () => { draftCred.set(id, cred.value.includes("•") ? getCred(id) : cred.value); renderMeta(id); });
    body.querySelectorAll<HTMLInputElement>("[data-field]").forEach(inp =>
      inp.addEventListener("change", () => { draftScope.set(id, { ...getScope(id), [inp.dataset.field!]: inp.value.split(/[\s,]+/).filter(Boolean) }); renderMeta(id); }));
    body.querySelectorAll<HTMLElement>("[data-discover]").forEach(btn =>
      btn.addEventListener("click", () => runDiscover(s, btn.dataset.discover!, true)));
    // Re-show cached results without an API call when the form re-opens.
    for (const f of s.scopeSchema) if (f.discoverable && getCred(id)) {
      const cached = discoverCache.get(`${id}:${fingerprint(getCred(id))}`);
      if (cached) mountChecklist(body.querySelector<HTMLElement>(`[data-list="${f.key}"]`)!, s, f.key, cached);
    }
  }

  // Refresh just the collapsed-row summary/status without collapsing the open body.
  function renderMeta(id: string) {
    const s = byId(id), ok = isConnected(s);
    const item = conns.querySelector<HTMLElement>(`.conn-item[data-src="${id}"]`);
    item?.classList.toggle("ok", ok);
    const meta = item?.querySelector(".cmeta"); if (meta) meta.textContent = `${getDomain(s.domain).label} · ${scopeSummary(s, getScope(id))}`;
    const cstat = item?.querySelector(".cstat");
    if (cstat) { cstat.textContent = s.status === "upcoming" ? "upcoming" : ok ? "connected" : "+ Add"; cstat.classList.toggle("add", !ok && s.status !== "upcoming"); }
  }

  async function runDiscover(s: Source, key: string, force: boolean) {
    const list = conns.querySelector<HTMLElement>(`[data-list="${key}"]`)!;
    const cacheKey = `${s.id}:${fingerprint(getCred(s.id))}`;
    if (!force && discoverCache.has(cacheKey)) { mountChecklist(list, s, key, discoverCache.get(cacheKey)!); return; }
    list.innerHTML = `<div class="muted">Querying…</div>`;
    let options: DiscoveryOption[] = [];
    try { options = (await s.discover?.(getCred(s.id))) ?? []; }
    catch (e: any) { list.innerHTML = `<div class="error">${esc(e?.message ?? e)}</div>`; return; }
    discoverCache.set(cacheKey, options);
    const btn = conns.querySelector<HTMLElement>(`[data-discover="${key}"]`);
    const f = s.scopeSchema.find(x => x.key === key);
    if (btn && f) btn.textContent = `Re-scan ${f.label.toLowerCase()}`;
    mountChecklist(list, s, key, options);
  }

  // A filterable, multi-select checklist: selected pinned to the top, a live
  // count, and select-all / clear over the current filter. Filtering hides rows
  // in place (no rebuild) so typing keeps focus; selection never reorders mid-edit.
  function mountChecklist(list: HTMLElement, s: Source, key: string, options: DiscoveryOption[]) {
    const sel = new Set((getScope(s.id)[key] as string[]) ?? []);
    const ordered = [...options].sort((a, b) => (sel.has(b.value) ? 1 : 0) - (sel.has(a.value) ? 1 : 0));
    list.innerHTML = `<div class="list-tools">
        <input class="list-filter" data-lf type="text" placeholder="Filter ${esc(s.scopeSchema.find(f => f.key === key)?.label.toLowerCase() ?? "")}…"/>
        <button class="btn-ghost mini" data-all>Select all</button>
        <button class="btn-ghost mini" data-none>Clear</button>
        <span class="list-count" data-count>${sel.size} selected</span></div>
      <div class="checklist">${ordered.map(o => `<label class="crow"><input type="checkbox" value="${esc(o.value)}" ${sel.has(o.value) ? "checked" : ""}>
        <span class="repo">${o.group ? `<span class="org">${esc(o.group)}/</span>` : ""}${esc(o.label)}</span></label>`).join("")}</div>`;

    const count = list.querySelector<HTMLElement>("[data-count]")!;
    const rows = [...list.querySelectorAll<HTMLLabelElement>(".crow")];
    const commit = () => { draftScope.set(s.id, { ...getScope(s.id), [key]: [...sel] }); count.textContent = `${sel.size} selected`; renderMeta(s.id); };

    list.querySelector<HTMLInputElement>("[data-lf]")!.addEventListener("input", e => {
      const q = (e.target as HTMLInputElement).value.trim().toLowerCase();
      rows.forEach(r => { r.hidden = !!q && !r.textContent!.toLowerCase().includes(q); });
    });
    list.querySelector<HTMLElement>("[data-all]")!.addEventListener("click", () => {
      rows.filter(r => !r.hidden).forEach(r => { const cb = r.querySelector("input")!; cb.checked = true; sel.add(cb.value); }); commit();
    });
    list.querySelector<HTMLElement>("[data-none]")!.addEventListener("click", () => {
      rows.forEach(r => { const cb = r.querySelector("input")!; cb.checked = false; }); sel.clear(); commit();
    });
    list.querySelectorAll<HTMLInputElement>(".crow input").forEach(cb => cb.addEventListener("change", () => {
      cb.checked ? sel.add(cb.value) : sel.delete(cb.value); commit();
    }));
  }

  function clearData(kind: "creds" | "scope") {
    const noun = kind === "creds" ? "credentials (this session)" : "saved scope";
    if (typeof confirm === "function" && !confirm(`Clear all ${noun}? This cannot be undone.`)) return;
    for (const s of sources) {
      if (kind === "creds") { creds.set(s.id, ""); draftCred.delete(s.id); }
      else { scopes.set(s.id, {}); draftScope.delete(s.id); }
    }
    renderConns(); onChange();
  }

  function setHidden(hidden: boolean) {
    panel.classList.toggle("open", !hidden); scrim.classList.toggle("open", !hidden);
    panel.setAttribute("aria-hidden", String(hidden));
  }
  function discard() { draftCred.clear(); draftScope.clear(); setHidden(true); }
  function save() {
    for (const [id, v] of draftCred) creds.set(id, v);
    for (const [id, sc] of draftScope) scopes.set(id, sc);
    draftCred.clear(); draftScope.clear(); onChange(); setHidden(true);
  }
  scrim.addEventListener("click", discard);
  host.querySelector("[data-close]")!.addEventListener("click", discard);
  host.querySelector("[data-cancel]")!.addEventListener("click", discard);
  host.querySelector("[data-save]")!.addEventListener("click", save);
  filter.addEventListener("input", () => renderConns());
  host.querySelectorAll<HTMLElement>("[data-clear]").forEach(b =>
    b.addEventListener("click", () => clearData(b.dataset.clear as "creds" | "scope")));

  return {
    open(sourceId?: string) {
      expanded = sourceId ?? sources[0]?.id ?? null;
      draftCred.clear(); draftScope.clear(); filter.value = "";
      renderTheme(); renderRefresh(); renderConns(); setHidden(false);
    },
  };
}
