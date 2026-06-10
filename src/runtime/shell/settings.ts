import type { Source, Scope, DiscoveryOption } from "../ingest/source";
import { providerOf } from "../ingest/source";
import type { CredStore } from "./cred-store";
import type { ScopeStore } from "./scope-store";
import type { PolicyStore } from "./policy-store";
import { type TierThresholds } from "../scoring/tier";
import { mountScoringEditor } from "./scoring-editor";
import { validateModel, type ScoreModel } from "../scoring/score-model";
import { fieldsFor } from "../scoring/field-catalog";
import type { Kind } from "../dataset/item";
import { scopeSummary } from "./health";
import { providerIcon, categoryIcon } from "./provider-icons";
import { getThemeChoice, setThemeChoice, type ThemeChoice } from "./theme";
import { getRefreshInterval, setRefreshInterval, REFRESH_OPTIONS } from "./refresh";
import { dismissible } from "./dismissible";
import type { ScoredItem } from "../layout/table/kind-renderer";
import { esc } from "../layout/util";

// Single source of truth for the sidebar nav — id paired with its label. The id
// drives data-category, the categoryIcon() lookup, and the per-category unsaved-dot.
const CATEGORIES = [
  ["connections", "Connections"],
  ["scoring", "Scoring &amp; priority"],
  ["filters", "Filters"],
  ["general", "General"],
] as const;

interface Opts {
  sources: Source[]; creds: CredStore; scopes: ScopeStore; policy: PolicyStore;
  onChange: () => void;            // credentials/scope committed or cleared
  onThemeChange?: () => void;      // theme applied (resync the top-right toggle)
  onRefreshChange?: () => void;    // auto-refresh cadence changed (reset the timer)
  getRows?: () => ScoredItem[];    // loaded scored rows — for the scoring editor's live preview
  getAutoBots?: () => string[];    // provider-flagged bot logins in current data (read-only display)
}

// Discovery results cached per source+credential so re-opening Settings or
// re-filtering never re-hits the API; a "Re-scan" action forces a fresh call.
const discoverCache = new Map<string, DiscoveryOption[]>();
function fingerprint(token: string): string {
  let h = 0; for (let i = 0; i < token.length; i++) h = (h * 31 + token.charCodeAt(i)) | 0;
  return h.toString(36);
}

export function mountSettings(host: HTMLElement, opts: Opts) {
  const { sources, creds, scopes, policy, onChange, onThemeChange, onRefreshChange, getRows, getAutoBots } = opts;
  // One connection per provider: pick a representative (prefer a ready source), and
  // key credentials/scope by provider so sources that share a provider share a token.
  const providerReps: Source[] = (() => {
    const byProv = new Map<string, Source>();
    for (const s of sources) {
      const p = providerOf(s);
      const cur = byProv.get(p);
      if (!cur || (cur.status !== "ready" && s.status === "ready")) byProv.set(p, s);
    }
    return [...byProv.values()];
  })();
  host.innerHTML = `<div class="scrim" data-scrim></div>
    <aside class="sheet panel" data-panel aria-hidden="true">
      <div class="panel-head"><h3>Settings</h3>
        <button class="icon-btn" data-close aria-label="Close"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>
      <div class="panel-body">
        <nav class="set-sidebar">${CATEGORIES.map(([id, label], i) =>
          `<button class="cat${i === 0 ? " on" : ""}" data-category="${id}">${categoryIcon(id)}<span>${label}</span><span class="unsaved-dot" aria-hidden="true"></span></button>`).join("")}
        </nav>
        <div class="set-content">
          <div class="cat-pane" data-cat-pane="connections">
            <section class="set-section wide"><label class="set-label">Connections</label>
              <input class="conn-filter" data-conn-filter type="text" placeholder="Filter integrations…" aria-label="Filter integrations"/>
              <div class="conn-list" data-conns></div>
              <span class="set-helper">One credential per provider — kept in this tab only (session), never persisted or embedded.</span></section>
          </div>
          <div class="cat-pane" data-cat-pane="scoring" hidden>
            <section class="set-section"><label class="set-label">Default priority cutoffs</label>
              <p class="set-helper">Minimum score for each tier, applied to any kind using built-in scoring (no custom model). Items below P2 are P3.</p>
              <div class="tier-thresholds">
                <label>P0 ≥ <input type="number" min="0" step="1" data-tier-input="p0"></label>
                <label>P1 ≥ <input type="number" min="0" step="1" data-tier-input="p1"></label>
                <label>P2 ≥ <input type="number" min="0" step="1" data-tier-input="p2"></label>
              </div>
              <span class="set-helper">Saved in this browser; re-tiers on Save.</span></section>
            <section class="set-section wide"><label class="set-label">Scoring</label>
              <p class="set-helper">Per-kind score model. Simple = weight sliders; Advanced = formula + signals. Saved in this browser.</p>
              <div data-scoring-editor></div></section>
          </div>
          <div class="cat-pane" data-cat-pane="filters" hidden>
            <section class="set-section wide">
              <label class="set-label">Auto-detected bots</label>
              <p class="set-helper">Accounts the provider flags as bots in the current data — always treated as bots.</p>
              <div class="bot-chips" data-auto-bots></div>
              <label class="set-label">Manual bots</label>
              <p class="set-helper">Extra logins to treat as bots, in addition to the above. Affects the Author filter. Saved in this browser.</p>
              <div class="bot-chips" data-bot-chips></div>
              <input class="bot-add" data-bot-add type="text" placeholder="Add a login — Enter or comma" aria-label="Add bot login"></section>
          </div>
          <div class="cat-pane" data-cat-pane="general" hidden>
            <section class="set-section"><label class="set-label">Appearance</label>
              <div class="seg" data-theme-seg></div></section>
            <section class="set-section"><label class="set-label">Auto-refresh</label>
              <div class="seg" data-refresh-seg></div>
              <span class="set-helper">Re-fetch on a timer. Snapshot only — there is no backend history to trend.</span></section>
            <section class="set-section"><label class="set-label">Data</label>
              <div class="data-actions">
                <button class="btn-ghost" data-clear="creds">Clear credentials</button>
                <button class="btn-ghost" data-clear="scope">Clear saved scope</button></div>
              <span class="set-helper">Credentials live in this tab's session; scope is saved in this browser.</span></section>
          </div>
        </div>
      </div>
      <div class="panel-foot">
        <span class="unsaved-summary"><span class="dot" data-unsaved-any hidden></span><span data-unsaved-count>0 unsaved changes</span></span>
        <span class="foot-actions"><button class="btn-ghost" data-cancel>Cancel</button><button class="btn-primary" data-save>Save</button></span>
      </div>
    </aside>`;
  const scrim = host.querySelector<HTMLElement>("[data-scrim]")!;
  const panel = host.querySelector<HTMLElement>("[data-panel]")!;
  const conns = host.querySelector<HTMLElement>("[data-conns]")!;
  const seg = host.querySelector<HTMLElement>("[data-theme-seg]")!;
  const rseg = host.querySelector<HTMLElement>("[data-refresh-seg]")!;
  const filter = host.querySelector<HTMLInputElement>("[data-conn-filter]")!;

  // Credential/scope edits are staged and committed on Save; clear applies now.
  const draftCred = new Map<string, string>();
  const draftScope = new Map<string, Scope>();
  // Theme + auto-refresh are staged like the rest: a click live-previews the value
  // immediately, but Discard restores the baseline captured on open() and Save commits it.
  let savedTheme = getThemeChoice();      // baseline captured on open()
  let draftTheme: ThemeChoice | null = null;
  let savedRefresh = getRefreshInterval(); // baseline captured on open()
  let draftRefresh: number | null = null;
  let draftTiers: TierThresholds | null = null;
  // Score-model edits per kind: a ScoreModel to persist, or "reset" to clear back to default.
  const draftModels = new Map<string, ScoreModel | "reset">();
  let draftBots: string[] | null = null;
  const getBots = () => draftBots ?? policy.getBotLogins();
  const allDraftsValid = () => {
    for (const [k, d] of draftModels) {
      if (d === "reset") continue;
      if (validateModel(d, fieldsFor(k as Kind)).length) return false;
    }
    return true;
  };
  const getTierDraft = () => draftTiers ?? policy.getTiers();
  const getCred = (prov: string) => draftCred.has(prov) ? draftCred.get(prov)! : (creds.get(prov) ?? "");
  const getScope = (prov: string) => draftScope.has(prov) ? draftScope.get(prov)! : scopes.get(prov);
  const isConnected = (s: Source) => s.status !== "upcoming" && !!getCred(providerOf(s));
  let expanded: string | null = null;   // now holds a provider key
  const repOf = (prov: string) => providerReps.find(s => providerOf(s) === prov)!;

  function renderTheme() {
    const choice = getThemeChoice();
    const opt = (v: ThemeChoice, label: string) =>
      `<button data-theme="${v}" class="${v === choice ? "on" : ""}">${label}</button>`;
    seg.innerHTML = opt("auto", "Auto") + opt("light", "Light") + opt("dark", "Dark");
    seg.querySelectorAll<HTMLElement>("[data-theme]").forEach(b =>
      b.addEventListener("click", () => {
        draftTheme = b.dataset.theme as ThemeChoice;
        setThemeChoice(draftTheme);     // live preview
        renderTheme(); onThemeChange?.(); updateSaveGate();
      }));
  }

  function renderRefresh() {
    const cur = getRefreshInterval();
    rseg.innerHTML = REFRESH_OPTIONS.map(o => `<button data-refresh="${o.value}" class="${o.value === cur ? "on" : ""}">${esc(o.label)}</button>`).join("");
    rseg.querySelectorAll<HTMLElement>("[data-refresh]").forEach(b =>
      b.addEventListener("click", () => {
        draftRefresh = Number(b.dataset.refresh);
        setRefreshInterval(draftRefresh);   // live preview
        renderRefresh(); onRefreshChange?.(); updateSaveGate();
      }));
  }

  function addBot(raw: string) {
    const login = raw.replace(/,/g, "").trim();
    if (!login) return;
    const cur = getBots();
    if (cur.includes(login)) return;
    draftBots = [...cur, login];
    renderBots(); updateSaveGate();
  }
  function renderBots() {
    const wrap = host.querySelector<HTMLElement>("[data-bot-chips]");
    if (!wrap) return;
    const bots = getBots();
    wrap.innerHTML = bots.length
      ? bots.map(b => `<span class="ms-chip"><span class="repo">${esc(b)}</span><button class="x" data-rm-bot="${esc(b)}" aria-label="Remove ${esc(b)}">×</button></span>`).join("")
      : `<span class="muted">No bots hidden — add a login to filter it out</span>`;
    wrap.querySelectorAll<HTMLElement>("[data-rm-bot]").forEach(btn =>
      btn.addEventListener("click", () => { draftBots = getBots().filter(b => b !== btn.dataset.rmBot); renderBots(); updateSaveGate(); }));
  }
  function renderAutoBots() {
    const wrap = host.querySelector<HTMLElement>("[data-auto-bots]");
    if (!wrap) return;
    const logins = getAutoBots?.() ?? [];
    wrap.innerHTML = logins.length
      ? logins.map(l => `<span class="ms-chip"><span class="repo">${esc(l)}</span></span>`).join("")
      : `<span class="muted">No provider-flagged bots in the current data.</span>`;
  }
  // Inline mirror of the tier "strictly decrease" rule for the GLOBAL cutoffs
  // (equivalent of scoring-editor's per-kind renderTierBands hint — that closure
  // can't be imported here). Presentational only: flags offending [data-tier-input]
  // with aria-invalid and renders a [data-tier-invalid] hint; never blocks Save.
  function updateGlobalTierValidity() {
    const keys = ["p0", "p1", "p2"] as const;
    const inputs = keys.map(k => host.querySelector<HTMLInputElement>(`[data-tier-input="${k}"]`));
    if (inputs.some(inp => !inp)) return;
    // Read the live input values; chain ends at the implicit P3 floor of 0.
    const chain = [...inputs.map(inp => Number(inp!.value)), 0];
    const offending = new Set<number>();
    for (let i = 0; i < chain.length - 1; i++) {
      if (chain[i] <= chain[i + 1]) { offending.add(i); offending.add(i + 1); }
    }
    keys.forEach((_, i) => inputs[i]!.setAttribute("aria-invalid", offending.has(i) ? "true" : "false"));
    const pane = host.querySelector<HTMLElement>("[data-cat-pane='scoring']")!;
    pane.querySelector("[data-tier-invalid]")?.remove();
    if ([...offending].some(i => i < keys.length)) {
      pane.querySelector(".tier-thresholds")!.insertAdjacentHTML("afterend",
        `<span class="se-error" data-tier-invalid>Cutoffs must strictly decrease.</span>`);
    }
  }
  function renderScoring() {
    editor.render();
    const t = getTierDraft();
    (["p0", "p1", "p2"] as const).forEach(k => {
      const inp = host.querySelector<HTMLInputElement>(`[data-tier-input="${k}"]`);
      if (!inp) return;
      inp.value = String(t[k]);
      inp.oninput = () => {
        const v = Number(inp.value);
        if (inp.value.trim() && Number.isFinite(v) && v >= 0) draftTiers = { ...getTierDraft(), [k]: v };
        updateGlobalTierValidity();
      };
    });
    updateGlobalTierValidity();
  }

  // ── Integrations catalog: Connected on top, Available below, filterable ──
  function renderConns() {
    const q = filter.value.trim().toLowerCase();
    const matches = (s: Source) => !q || providerOf(s).toLowerCase().includes(q);
    const visible = providerReps.filter(matches);
    const connected = visible.filter(isConnected);
    const available = visible.filter(s => !isConnected(s));

    const row = (s: Source) => {
      const prov = providerOf(s);
      const open = expanded === prov;
      const off = s.status === "upcoming";
      const meta = off ? "" : scopeSummary(s, getScope(prov));
      const info = s.setup ? `<span class="info" title="${esc(s.setup.hint)}" aria-label="How to connect ${esc(prov)}">i</span>` : "";
      const action = off ? `<span class="cstat">upcoming</span>`
        : isConnected(s) ? `<span class="cstat">connected</span>`
        : `<span class="cstat add">+ Add</span>`;
      const chev = off ? "" : `<svg class="chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m6 9 6 6 6-6"/></svg>`;
      return `<div class="conn ${open ? "open" : ""}">
        <button class="conn-item ${isConnected(s) ? "ok" : ""}" data-src="${esc(prov)}" aria-expanded="${open}" ${off ? "disabled" : ""}>
          ${providerIcon(prov, 16)}<span class="cinfo"><span class="cname">${esc(prov)}</span>
          ${meta ? `<span class="cmeta">${esc(meta)}</span>` : ""}</span>
          ${info}${action}${chev}</button>
        <div class="conn-body" data-body="${esc(prov)}" ${open ? "" : "hidden"}></div></div>`;
    };
    const group = (label: string, list: Source[]) => list.length
      ? `<div class="conn-group"><span class="conn-group-label">${label}<span class="count">${list.length}</span></span>${list.map(row).join("")}</div>` : "";

    conns.innerHTML = group("Connected", connected) + group("Available", available)
      || `<p class="muted">No integrations match “${esc(filter.value)}”.</p>`;
    conns.querySelectorAll<HTMLElement>(".conn-item:not([disabled])").forEach(b =>
      b.addEventListener("click", () => { const p = b.dataset.src!; expanded = expanded === p ? null : p; renderConns(); }));
    if (expanded && visible.some(s => providerOf(s) === expanded)) renderForm(expanded);
  }

  function renderForm(prov: string) {
    const body = conns.querySelector<HTMLElement>(`[data-body="${prov}"]`);
    if (!body) return;
    const s = repOf(prov); const off = s.status === "upcoming"; const scope = getScope(prov);
    const setup = s.setup
      ? `<span class="set-helper">${esc(s.setup.hint)}${s.setup.url ? ` <a class="set-link" href="${esc(s.setup.url)}" target="_blank" rel="noopener noreferrer">Create one ↗</a>` : ""}</span>`
      : "";
    let html = `<div class="set-group"><label class="set-label">Credential</label>
        <div class="cred-row">
          <input type="password" data-cred ${off ? "disabled" : ""} value="${getCred(prov) ? "••••••••" : ""}" placeholder="token / key — stored in this tab only"/>
          <button type="button" class="btn-ghost mini" data-cred-toggle ${off ? "disabled" : ""}>show</button>
        </div>
        ${setup}<span class="set-helper">Session-only, never persisted or embedded.</span></div>`;
    for (const f of s.scopeSchema) {
      html += `<div class="set-group"><label class="set-label">${esc(f.label)}</label>`;
      if (f.discoverable) {
        const cached = getCred(prov) ? discoverCache.get(`${prov}:${fingerprint(getCred(prov))}`) : undefined;
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
    cred?.addEventListener("input", () => { draftCred.set(prov, cred.value.includes("•") ? getCred(prov) : cred.value); renderMeta(prov); });
    const credToggle = body.querySelector<HTMLButtonElement>("[data-cred-toggle]");
    credToggle?.addEventListener("click", () => {
      const i = body.querySelector<HTMLInputElement>("[data-cred]")!;
      if (i.type === "password") { i.type = "text"; if (i.value.includes("•")) i.value = getCred(prov); credToggle.textContent = "hide"; }
      else { i.type = "password"; if (getCred(prov)) i.value = "••••••••"; credToggle.textContent = "show"; }
    });
    body.querySelectorAll<HTMLInputElement>("[data-field]").forEach(inp =>
      inp.addEventListener("change", () => { draftScope.set(prov, { ...getScope(prov), [inp.dataset.field!]: inp.value.split(/[\s,]+/).filter(Boolean) }); renderMeta(prov); }));
    body.querySelectorAll<HTMLElement>("[data-discover]").forEach(btn =>
      btn.addEventListener("click", () => runDiscover(s, btn.dataset.discover!, true)));
    // Always surface the *selected* scope as chips (independent of discovery);
    // the "Find/Re-scan" button loads the option list to add more.
    for (const f of s.scopeSchema) if (f.discoverable && getCred(prov)) {
      const cached = discoverCache.get(`${prov}:${fingerprint(getCred(prov))}`) ?? [];
      mountMultiSelect(body.querySelector<HTMLElement>(`[data-list="${f.key}"]`)!, s, f.key, cached);
    }
  }

  // Refresh just the collapsed-row summary/status without collapsing the open body.
  function renderMeta(prov: string) {
    const s = repOf(prov), ok = isConnected(s);
    const item = conns.querySelector<HTMLElement>(`.conn-item[data-src="${prov}"]`);
    item?.classList.toggle("ok", ok);
    const meta = item?.querySelector(".cmeta"); if (meta) meta.textContent = scopeSummary(s, getScope(prov));
    const cstat = item?.querySelector(".cstat");
    if (cstat) { cstat.textContent = s.status === "upcoming" ? "upcoming" : ok ? "connected" : "+ Add"; cstat.classList.toggle("add", !ok && s.status !== "upcoming"); }
  }

  async function runDiscover(s: Source, key: string, force: boolean) {
    const prov = providerOf(s);
    const list = conns.querySelector<HTMLElement>(`[data-list="${key}"]`)!;
    const cacheKey = `${prov}:${fingerprint(getCred(prov))}`;
    if (!force && discoverCache.has(cacheKey)) { mountMultiSelect(list, s, key, discoverCache.get(cacheKey)!); return; }
    list.innerHTML = `<div class="muted">Querying…</div>`;
    let options: DiscoveryOption[] = [];
    try { options = (await s.discover?.(getCred(prov))) ?? []; }
    catch (e: any) { list.innerHTML = `<div class="error">${esc(e?.message ?? e)}</div>`; return; }
    discoverCache.set(cacheKey, options);
    const btn = conns.querySelector<HTMLElement>(`[data-discover="${key}"]`);
    const f = s.scopeSchema.find(x => x.key === key);
    if (btn && f) btn.textContent = `Re-scan ${f.label.toLowerCase()}`;
    mountMultiSelect(list, s, key, options);
  }

  // Tag-style multiselect: the chosen targets sit at the top as removable chips
  // (one-click removal, see-at-a-glance), and the searchable list below holds only
  // the *unselected* options — so at 100+ repos you only scroll what you can add.
  function mountMultiSelect(list: HTMLElement, s: Source, key: string, options: DiscoveryOption[]) {
    const noun = s.scopeSchema.find(f => f.key === key)?.label.toLowerCase() ?? "items";
    const prov = providerOf(s);
    const sel = new Set((getScope(prov)[key] as string[]) ?? []);
    const byVal = new Map(options.map(o => [o.value, o]));
    const labelOf = (v: string) => { const o = byVal.get(v); return o ? `${o.group ? o.group + "/" : ""}${o.label}` : v; };
    let q = "";

    list.innerHTML = `<div class="ms-chips" data-chips></div>
      <div class="list-tools">
        <input class="list-filter" data-lf type="text" placeholder="Search ${esc(noun)} to add…"/>
        <button class="btn-ghost mini" data-all>Add all</button>
        <button class="btn-ghost mini" data-none>Clear</button>
        <span class="list-count" data-count></span></div>
      <div class="ms-options checklist" data-options></div>`;
    const chips = list.querySelector<HTMLElement>("[data-chips]")!;
    const opts = list.querySelector<HTMLElement>("[data-options]")!;
    const count = list.querySelector<HTMLElement>("[data-count]")!;
    const lf = list.querySelector<HTMLInputElement>("[data-lf]")!;

    const commit = () => { draftScope.set(prov, { ...getScope(prov), [key]: [...sel] }); renderMeta(prov); };
    const drawCount = () => { count.textContent = `${sel.size} selected`; };
    const drawChips = () => {
      chips.innerHTML = sel.size
        ? [...sel].map(v => `<span class="ms-chip"><span class="repo">${esc(labelOf(v))}</span><button class="x" data-rm="${esc(v)}" aria-label="Remove ${esc(labelOf(v))}">×</button></span>`).join("")
        : `<span class="muted ms-empty">No ${esc(noun)} selected yet — add from below.</span>`;
      chips.querySelectorAll<HTMLElement>("[data-rm]").forEach(b =>
        b.addEventListener("click", () => { sel.delete(b.dataset.rm!); commit(); drawChips(); drawOptions(); drawCount(); }));
    };
    const drawOptions = () => {
      const ql = q.trim().toLowerCase();
      const avail = options.filter(o => !sel.has(o.value) && (!ql || labelOf(o.value).toLowerCase().includes(ql)));
      opts.innerHTML = avail.length
        ? avail.map(o => `<button class="opt-row" data-add="${esc(o.value)}"><span class="repo">${o.group ? `<span class="org">${esc(o.group)}/</span>` : ""}${esc(o.label)}</span><span class="plus">+</span></button>`).join("")
        : `<div class="muted ms-none">${ql ? "No matches." : options.length ? "All added." : `Use “Find ${esc(noun)}” to load more.`}</div>`;
      opts.querySelectorAll<HTMLElement>("[data-add]").forEach(b =>
        b.addEventListener("click", () => { sel.add(b.dataset.add!); commit(); drawChips(); drawOptions(); drawCount(); }));
    };

    lf.addEventListener("input", () => { q = lf.value; drawOptions(); });   // input is static → keeps focus
    list.querySelector<HTMLElement>("[data-all]")!.addEventListener("click", () => {
      const ql = q.trim().toLowerCase();
      options.forEach(o => { if (!ql || labelOf(o.value).toLowerCase().includes(ql)) sel.add(o.value); });
      commit(); drawChips(); drawOptions(); drawCount();
    });
    list.querySelector<HTMLElement>("[data-none]")!.addEventListener("click", () => {
      sel.clear(); commit(); drawChips(); drawOptions(); drawCount();
    });
    drawChips(); drawOptions(); drawCount();
  }

  function clearData(kind: "creds" | "scope") {
    const noun = kind === "creds" ? "credentials (this session)" : "saved scope";
    if (typeof confirm === "function" && !confirm(`Clear all ${noun}? This cannot be undone.`)) return;
    for (const prov of new Set(sources.map(providerOf))) {
      if (kind === "creds") { creds.set(prov, ""); draftCred.delete(prov); }
      else { scopes.set(prov, {}); draftScope.delete(prov); }
    }
    renderConns(); onChange();
  }

  // Modal sheet: Escape / scrim dismiss, Tab trapped within, background inert, focus restored.
  const dismiss = dismissible(panel, { onDismiss: () => discard(), scrim, modal: true });
  function setHidden(hidden: boolean) {
    panel.classList.toggle("open", !hidden); scrim.classList.toggle("open", !hidden);
    panel.setAttribute("aria-hidden", String(hidden));
    if (hidden) dismiss.release(); else dismiss.activate();
  }
  function discard() {
    if (draftTheme !== null) { setThemeChoice(savedTheme); onThemeChange?.(); }
    if (draftRefresh !== null) { setRefreshInterval(savedRefresh); onRefreshChange?.(); }
    draftTheme = null; draftRefresh = null;
    draftCred.clear(); draftScope.clear(); draftTiers = null; draftModels.clear(); draftBots = null;
    updateSaveGate(); setHidden(true);
  }
  function save() {
    for (const [prov, v] of draftCred) creds.set(prov, v);
    for (const [prov, sc] of draftScope) scopes.set(prov, sc);
    if (draftTiers) { policy.setTiers(draftTiers); draftTiers = null; }
    for (const [k, d] of draftModels) { if (d === "reset") policy.clearScoreModel(k); else policy.setScoreModel(k, d); }
    draftModels.clear();
    if (draftBots) { policy.setBotLogins(draftBots); draftBots = null; }
    // Theme/refresh are already applied via live preview; just commit the baseline.
    if (draftTheme !== null) { savedTheme = draftTheme; draftTheme = null; }
    if (draftRefresh !== null) { savedRefresh = draftRefresh; draftRefresh = null; }
    draftCred.clear(); draftScope.clear(); updateSaveGate(); onChange(); setHidden(true);
  }
  host.querySelector("[data-close]")!.addEventListener("click", discard);
  host.querySelector("[data-cancel]")!.addEventListener("click", discard);
  const saveBtn = host.querySelector<HTMLButtonElement>("[data-save]")!;
  saveBtn.addEventListener("click", save);
  // Per-category unsaved marker: pure derived view of the draft collections. The
  // [data-unsaved] attribute is toggled on each category's dot span so CSS can pin
  // it and tests can query it; absent when that category has no pending edits.
  const updateUnsavedDots = () => {
    const dirty: Record<string, boolean> = {
      connections: draftCred.size > 0 || draftScope.size > 0,
      scoring: draftModels.size > 0 || draftTiers !== null,
      filters: draftBots !== null,
      general: draftTheme !== null || draftRefresh !== null,
    };
    host.querySelectorAll<HTMLElement>("[data-category]").forEach(b => {
      const dot = b.querySelector<HTMLElement>(".unsaved-dot");
      if (!dot) return;
      if (dirty[b.dataset.category!]) dot.setAttribute("data-unsaved", "");
      else dot.removeAttribute("data-unsaved");
    });
  };
  // Unified save-bar count: total pending edits across every draft collection.
  // Maps contribute their .size; the null-or-value drafts contribute 1 when set.
  const totalDrafts = () =>
    draftCred.size + draftScope.size + draftModels.size + (draftTiers !== null ? 1 : 0)
    + (draftBots !== null ? 1 : 0) + (draftTheme !== null ? 1 : 0) + (draftRefresh !== null ? 1 : 0);
  const updateSaveBar = () => {
    const n = totalDrafts();
    const el = host.querySelector<HTMLElement>("[data-unsaved-count]");
    if (el) el.textContent = `${n} unsaved change${n === 1 ? "" : "s"}`;
    host.querySelector<HTMLElement>("[data-unsaved-any]")?.toggleAttribute("hidden", n === 0);
  };
  const updateSaveGate = () => { saveBtn.disabled = !allDraftsValid(); updateUnsavedDots(); updateSaveBar(); };
  const botAdd = host.querySelector<HTMLInputElement>("[data-bot-add]");
  botAdd?.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== ",") return;
    e.preventDefault();
    addBot(botAdd.value);
    botAdd.value = "";
  });
  const editor = mountScoringEditor(host.querySelector<HTMLElement>("[data-scoring-editor]")!, {
    // Seed precedence: staged draft > persisted model > (editor falls back to default).
    // A "reset" draft returns null so the editor previews the default before Save commits the clear.
    getDraft: (k) => {
      const d = draftModels.get(k);
      if (d === "reset") return null;
      if (d) return d;
      return policy.getScoreModel(k);
    },
    setDraft: (k, m) => { draftModels.set(k, m); updateSaveGate(); },
    clearDraft: (k) => { draftModels.set(k, "reset"); updateSaveGate(); },
    onChange: () => updateSaveGate(),
    previewRows: (k) => (getRows?.() ?? []).filter(r => r.kind === k),
  });
  filter.addEventListener("input", () => renderConns());
  host.querySelectorAll<HTMLElement>("[data-clear]").forEach(b =>
    b.addEventListener("click", () => clearData(b.dataset.clear as "creds" | "scope")));

  // Sidebar category switching. All four panes live in the DOM at once (only
  // visibility toggles), so every render function still finds its controls by
  // [data-…] regardless of which category is active. The scoring pane renders
  // lazily on first reveal — preserving the old Advanced-tab behavior.
  let scoringRendered = false;
  function showCategory(id: string) {
    host.querySelectorAll<HTMLElement>("[data-category]").forEach(b =>
      b.classList.toggle("on", b.dataset.category === id));
    host.querySelectorAll<HTMLElement>("[data-cat-pane]").forEach(p =>
      p.hidden = p.dataset.catPane !== id);
    if (id === "scoring" && !scoringRendered) { renderScoring(); scoringRendered = true; }
  }
  host.querySelectorAll<HTMLElement>("[data-category]").forEach(b =>
    b.addEventListener("click", () => showCategory(b.dataset.category!)));

  return {
    open(provider?: string) {
      expanded = provider ?? (providerReps[0] ? providerOf(providerReps[0]) : null);
      draftCred.clear(); draftScope.clear(); draftTiers = null; draftModels.clear(); draftBots = null;
      savedTheme = getThemeChoice(); draftTheme = null;
      savedRefresh = getRefreshInterval(); draftRefresh = null;
      updateSaveGate(); filter.value = "";
      scoringRendered = false;
      showCategory("connections");
      // Theme/refresh/bots live in other panes but their elements exist in the
      // DOM regardless of visibility, so render them up front like before.
      renderTheme(); renderRefresh(); renderAutoBots(); renderBots(); renderConns(); setHidden(false);
    },
  };
}
