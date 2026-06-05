import type { Source, Scope, DiscoveryOption } from "../ingest/source";
import { getDomain } from "../dataset/domain";
import type { CredStore } from "./cred-store";
import type { ScopeStore } from "./scope-store";
import { scopeSummary } from "./health";
import { providerIcon } from "./provider-icons";
import { getThemeChoice, setThemeChoice, type ThemeChoice } from "./theme";

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}
interface Opts {
  sources: Source[]; creds: CredStore; scopes: ScopeStore;
  onChange: () => void;            // credentials/scope committed or cleared
  onThemeChange?: () => void;      // theme applied (resync the top-right toggle)
}

export function mountSettings(host: HTMLElement, opts: Opts) {
  const { sources, creds, scopes, onChange, onThemeChange } = opts;
  host.innerHTML = `<div class="scrim" data-scrim></div>
    <aside class="sheet panel" data-panel aria-hidden="true">
      <div class="panel-head"><h3>Settings</h3><button class="icon-btn" data-close aria-label="Close"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>
      <div class="panel-body">
        <section class="set-section"><label class="set-label">Appearance</label>
          <div class="seg" data-theme-seg></div></section>
        <section class="set-section"><label class="set-label">Connections</label>
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

  // Credential/scope edits are staged and committed on Save; theme + clear apply now.
  const draftCred = new Map<string, string>();
  const draftScope = new Map<string, Scope>();
  const getCred = (id: string) => draftCred.has(id) ? draftCred.get(id)! : (creds.get(id) ?? "");
  const getScope = (id: string) => draftScope.has(id) ? draftScope.get(id)! : scopes.get(id);
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

  function renderConns() {
    conns.innerHTML = sources.map(s => {
      const ok = s.status !== "upcoming" && !!getCred(s.id);
      const stat = s.status === "upcoming" ? "upcoming" : (ok ? "connected" : "no token");
      const open = expanded === s.id;
      return `<div class="conn ${open ? "open" : ""}">
        <button class="conn-item ${ok ? "ok" : ""}" data-src="${esc(s.id)}" aria-expanded="${open}">
          ${providerIcon(s.id, 16)}<span class="cinfo"><span class="cname">${esc(s.id)}</span>
          <span class="cmeta">${esc(getDomain(s.domain).label)} · ${esc(scopeSummary(s, getScope(s.id)))}</span></span>
          <span class="cstat">${stat}</span>
          <svg class="chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m6 9 6 6 6-6"/></svg></button>
        <div class="conn-body" data-body="${esc(s.id)}" ${open ? "" : "hidden"}></div></div>`;
    }).join("");
    conns.querySelectorAll<HTMLElement>(".conn-item").forEach(b =>
      b.addEventListener("click", () => { const id = b.dataset.src!; expanded = expanded === id ? null : id; renderConns(); }));
    if (expanded) renderForm(expanded);
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
      html += f.discoverable
        ? `<button class="btn-ghost" data-discover="${esc(f.key)}" ${off ? "disabled" : ""}>Find ${esc(f.label.toLowerCase())} I can access</button>
           <div class="checklist" data-list="${esc(f.key)}"></div>`
        : `<input type="text" data-field="${esc(f.key)}" ${off ? "disabled" : ""} value="${esc(((scope[f.key] as string[]) ?? []).join(", "))}" placeholder="${esc(f.label)} (comma-separated)"/>`;
      html += `</div>`;
    }
    body.innerHTML = html;

    const cred = body.querySelector<HTMLInputElement>("[data-cred]");
    cred?.addEventListener("input", () => { draftCred.set(id, cred.value.includes("•") ? getCred(id) : cred.value); renderMeta(id); });
    body.querySelectorAll<HTMLInputElement>("[data-field]").forEach(inp =>
      inp.addEventListener("change", () => { draftScope.set(id, { ...getScope(id), [inp.dataset.field!]: inp.value.split(/[\s,]+/).filter(Boolean) }); renderMeta(id); }));
    body.querySelectorAll<HTMLElement>("[data-discover]").forEach(btn =>
      btn.addEventListener("click", () => runDiscover(s, btn.dataset.discover!)));
  }

  // Refresh just the collapsed-row summary/status without collapsing the open body.
  function renderMeta(id: string) {
    const s = byId(id), ok = s.status !== "upcoming" && !!getCred(id);
    const item = conns.querySelector<HTMLElement>(`.conn-item[data-src="${id}"]`);
    item?.classList.toggle("ok", ok);
    const meta = item?.querySelector(".cmeta"); if (meta) meta.textContent = `${getDomain(s.domain).label} · ${scopeSummary(s, getScope(id))}`;
    const cstat = item?.querySelector(".cstat"); if (cstat) cstat.textContent = s.status === "upcoming" ? "upcoming" : (ok ? "connected" : "no token");
  }

  async function runDiscover(s: Source, key: string) {
    const list = conns.querySelector<HTMLElement>(`[data-list="${key}"]`)!;
    list.innerHTML = `<div class="muted">Querying…</div>`;
    let options: DiscoveryOption[] = [];
    try { options = (await s.discover?.(getCred(s.id))) ?? []; }
    catch (e: any) { list.innerHTML = `<div class="error">${esc(e?.message ?? e)}</div>`; return; }
    const sel = new Set((getScope(s.id)[key] as string[]) ?? []);
    list.innerHTML = options.map(o => `<label class="crow"><input type="checkbox" value="${esc(o.value)}" ${sel.has(o.value) ? "checked" : ""}>
      <span class="repo"><span class="org">${esc(o.group)}/</span>${esc(o.label)}</span></label>`).join("");
    list.querySelectorAll<HTMLInputElement>("input").forEach(cb => cb.addEventListener("change", () => {
      cb.checked ? sel.add(cb.value) : sel.delete(cb.value);
      draftScope.set(s.id, { ...getScope(s.id), [key]: [...sel] }); renderMeta(s.id);
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
  host.querySelectorAll<HTMLElement>("[data-clear]").forEach(b =>
    b.addEventListener("click", () => clearData(b.dataset.clear as "creds" | "scope")));

  return {
    open(sourceId?: string) {
      expanded = sourceId ?? sources[0]?.id ?? null;
      draftCred.clear(); draftScope.clear();
      renderTheme(); renderConns(); setHidden(false);
    },
  };
}
