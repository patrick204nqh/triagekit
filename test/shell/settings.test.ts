// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { mountSettings } from "../../src/runtime/shell/settings";
import { CredStore } from "../../src/runtime/shell/cred-store";
import { ScopeStore } from "../../src/runtime/shell/scope-store";
import { PolicyStore } from "../../src/runtime/shell/policy-store";
import type { Source } from "../../src/runtime/ingest/source";

const github: Source = {
  id: "github", domain: "code-security", kinds: ["dependency-vuln"], connectSrc: [], status: "ready",
  scopeSchema: [{ key: "repos", label: "Repositories", type: "multiselect", discoverable: true }],
  discover: async () => [{ value: "acme/web", label: "web", group: "acme" }],
  fetch: async () => ({ items: [], errors: [] }),
};

function mount(extra?: Partial<Parameters<typeof mountSettings>[1]>) {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: true, media: q, addEventListener() {}, removeEventListener() {} }) as any);
  const host = document.createElement("div"); document.body.appendChild(host);
  const creds = new CredStore(); const scopes = new ScopeStore(); const policy = new PolicyStore();
  const s = mountSettings(host, { sources: [github], creds, scopes, policy, onChange: () => {}, ...extra });
  return { host, creds, scopes, policy, s };
}

describe("mountSettings", () => {
  beforeEach(() => { sessionStorage.clear(); localStorage.clear(); document.body.innerHTML = ""; });

  it("opens with the source expanded, showing its credential field and an Appearance control", () => {
    const { host, s } = mount();
    s.open("github");
    expect(host.querySelector(".conn-item")).toBeTruthy();
    expect(host.querySelector("[data-cred]")).toBeTruthy();          // auto-expanded
    expect(host.querySelectorAll("[data-theme-seg] [data-theme]").length).toBe(3);
  });

  it("commits a typed credential only on Save", () => {
    const { host, creds, s } = mount();
    s.open("github");
    const input = host.querySelector<HTMLInputElement>("[data-cred]")!;
    input.value = "ghp_x"; input.dispatchEvent(new Event("input"));
    expect(creds.has("github")).toBe(false);                          // staged
    host.querySelector<HTMLElement>("[data-save]")!.click();
    expect(creds.has("github")).toBe(true);
  });

  it("discards staged edits on Cancel", () => {
    const { host, creds, s } = mount();
    s.open("github");
    const input = host.querySelector<HTMLInputElement>("[data-cred]")!;
    input.value = "ghp_x"; input.dispatchEvent(new Event("input"));
    host.querySelector<HTMLElement>("[data-cancel]")!.click();
    expect(creds.has("github")).toBe(false);
  });

  it("applies a theme choice immediately via the segmented control", () => {
    let synced = 0;
    const { host, s } = mount({ onThemeChange: () => { synced++; } });
    s.open("github");
    host.querySelector<HTMLElement>('[data-theme="light"]')!.click();
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(synced).toBe(1);
  });

  it("clears credentials on confirm", () => {
    vi.stubGlobal("confirm", () => true);
    const { host, creds, s } = mount();
    creds.set("github", "ghp_x");
    s.open("github");
    host.querySelector<HTMLElement>('[data-clear="creds"]')!.click();
    expect(creds.has("github")).toBe(false);
  });

  it("exposes an auto-refresh control wired to the preference", () => {
    let bumped = 0;
    const { host, s } = mount({ onRefreshChange: () => { bumped++; } });
    s.open("github");
    const opts = host.querySelectorAll("[data-refresh-seg] [data-refresh]");
    expect(opts.length).toBe(3);
    host.querySelector<HTMLElement>('[data-refresh="300"]')!.click();
    expect(localStorage.getItem("triagekit.refresh")).toBe("300");
    expect(bumped).toBe(1);
  });

  it("catalogs connections as Connected vs Available and filters them", () => {
    const { host, creds, s } = mount();
    s.open();
    let labels = [...host.querySelectorAll(".conn-group-label")].map(g => g.textContent);
    expect(labels.some(l => l?.startsWith("Available"))).toBe(true);   // no cred yet
    expect(host.querySelector(".conn-item .cstat.add")?.textContent).toBe("+ Add");

    creds.set("github", "ghp_x");
    s.open();
    labels = [...host.querySelectorAll(".conn-group-label")].map(g => g.textContent);
    expect(labels.some(l => l?.startsWith("Connected"))).toBe(true);

    const filter = host.querySelector<HTMLInputElement>("[data-conn-filter]")!;
    filter.value = "gitlab"; filter.dispatchEvent(new Event("input"));
    expect(host.querySelector(".conn-item")).toBeNull();               // nothing matches
    expect(host.querySelector("[data-conns] .muted")).toBeTruthy();
  });

  it("discovers into a tag-style multiselect (chips + add-list) and caches the result", async () => {
    const discover = vi.fn(async () => [
      { value: "acme/web", label: "web", group: "acme" },
      { value: "acme/api", label: "api", group: "acme" },
    ]);
    const src: Source = { ...github, discover };
    const host = document.createElement("div"); document.body.appendChild(host);
    const creds = new CredStore(); const scopes = new ScopeStore();
    creds.set("github", "ghp_x");
    const s = mountSettings(host, { sources: [src], creds, scopes, policy: new PolicyStore(), onChange: () => {} });
    s.open("github");

    host.querySelector<HTMLElement>('[data-discover="repos"]')!.click();
    await Promise.resolve(); await Promise.resolve();
    expect(discover).toHaveBeenCalledTimes(1);
    expect(host.querySelectorAll(".ms-options .opt-row").length).toBe(2);   // both addable
    expect(host.querySelectorAll(".ms-chip").length).toBe(0);               // none selected
    expect(host.querySelector("[data-count]")?.textContent).toBe("0 selected");

    // clicking an add-row promotes it to a chip and drops it from the list
    host.querySelector<HTMLElement>('[data-add="acme/web"]')!.click();
    expect(host.querySelectorAll(".ms-chip").length).toBe(1);
    expect(host.querySelectorAll(".ms-options .opt-row").length).toBe(1);
    expect(scopes.get("github")).toEqual({});                               // staged, not yet saved

    // removing the chip returns it to the add-list
    host.querySelector<HTMLElement>("[data-rm]")!.click();
    expect(host.querySelectorAll(".ms-chip").length).toBe(0);
    expect(host.querySelectorAll(".ms-options .opt-row").length).toBe(2);

    // searching narrows the add-list (input stays mounted, keeps focus)
    const lf = host.querySelector<HTMLInputElement>("[data-lf]")!;
    lf.value = "api"; lf.dispatchEvent(new Event("input"));
    expect(host.querySelectorAll(".ms-options .opt-row").length).toBe(1);

    // "Add all" over the current filter, then Save commits to scope
    host.querySelector<HTMLElement>("[data-all]")!.click();
    expect(host.querySelector("[data-count]")?.textContent).toBe("1 selected");
    host.querySelector<HTMLElement>("[data-save]")!.click();
    expect(scopes.get("github")).toEqual({ repos: ["acme/api"] });

    // re-opening re-renders from cache, no second API call
    s.open("github");
    expect(discover).toHaveBeenCalledTimes(1);
    expect(host.querySelectorAll(".ms-chip").length).toBe(1);               // saved selection shown
  });

  it("shows one connection row per provider and saves the credential under the provider key", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: true, media: q, addEventListener() {}, removeEventListener() {} }) as any);
    const alerts: Source = {
      id: "github", domain: "code-security", kinds: ["dependency-vuln"], connectSrc: [], status: "ready",
      scopeSchema: [{ key: "repos", label: "Repositories", type: "multiselect", discoverable: true }],
      discover: async () => [{ value: "acme/web", label: "web", group: "acme" }],
      fetch: async () => ({ items: [], errors: [] }),
    };
    const reviews: Source = { ...alerts, id: "github-review", provider: "github", kinds: ["pull-request"] };
    const host = document.createElement("div"); document.body.appendChild(host);
    const creds = new CredStore(); const scopes = new ScopeStore();
    const s = mountSettings(host, { sources: [alerts, reviews], creds, scopes, policy: new PolicyStore(), onChange: () => {} });
    s.open("github");

    // one row for the shared provider, not two
    expect(host.querySelectorAll(".conn-item").length).toBe(1);
    const input = host.querySelector<HTMLInputElement>("[data-cred]")!;
    input.value = "ghp_x"; input.dispatchEvent(new Event("input"));
    host.querySelector<HTMLElement>("[data-save]")!.click();
    expect(creds.get("github")).toBe("ghp_x");        // saved under provider, shared by both sources
  });

  it("shows saved repos as chips on open, before any discovery", () => {
    const discover = vi.fn(async () => [{ value: "acme/web", label: "web", group: "acme" }]);
    const src: Source = { ...github, discover };
    const host = document.createElement("div"); document.body.appendChild(host);
    const creds = new CredStore(); const scopes = new ScopeStore();
    creds.set("github", "tok");
    scopes.set("github", { repos: ["acme/web", "acme/api"] });
    const s = mountSettings(host, { sources: [src], creds, scopes, policy: new PolicyStore(), onChange: () => {} });
    s.open("github");
    const chips = [...host.querySelectorAll(".ms-chip .repo")].map(c => c.textContent);
    expect(chips).toEqual(expect.arrayContaining(["acme/web", "acme/api"]));
    expect(discover).not.toHaveBeenCalled();   // saved scope shown without discovery
  });

  it("surfaces provider setup guidance (row ⓘ + form link)", () => {
    const src: Source = { ...github, setup: { hint: "Use a fine-grained PAT.", url: "https://example.test/pat" } };
    const host = document.createElement("div"); document.body.appendChild(host);
    const s = mountSettings(host, { sources: [src], creds: new CredStore(), scopes: new ScopeStore(), policy: new PolicyStore(), onChange: () => {} });
    s.open("github");
    expect(host.querySelector(".conn-item .info")?.getAttribute("title")).toBe("Use a fine-grained PAT.");
    const link = host.querySelector<HTMLAnchorElement>(".set-link");
    expect(link?.getAttribute("href")).toBe("https://example.test/pat");
    expect(host.querySelector(".conn-item .cmeta")?.textContent).not.toMatch(/Security/);   // domain noise gone
  });

  it("ignores negative tier input and leaves the default unchanged", () => {
    localStorage.clear(); sessionStorage.clear();
    document.body.innerHTML = `<div id="h3"></div>`;
    const creds = new CredStore(); const scopes = new ScopeStore(); const policy = new PolicyStore();
    const host = document.getElementById("h3")!;
    const s = mountSettings(host, { sources: [github], creds, scopes, policy, onChange: () => {} });
    s.open("github");
    // switch to Scoring & priority
    host.querySelector<HTMLElement>("[data-category='scoring']")!.click();
    const p0 = host.querySelector<HTMLInputElement>("[data-tier-input='p0']")!;
    p0.value = "-5"; p0.dispatchEvent(new Event("input"));
    host.querySelector<HTMLElement>("[data-save]")!.click();
    expect(new PolicyStore().getTiers().p0).toBe(130);
  });

  it("ignores non-finite tier input (empty string) and leaves the default unchanged", () => {
    localStorage.clear(); sessionStorage.clear();
    document.body.innerHTML = `<div id="h2"></div>`;
    const creds = new CredStore(); const scopes = new ScopeStore(); const policy = new PolicyStore();
    const host = document.getElementById("h2")!;
    const s = mountSettings(host, { sources: [github], creds, scopes, policy, onChange: () => {} });
    s.open("github");
    // switch to Scoring & priority
    host.querySelector<HTMLElement>("[data-category='scoring']")!.click();
    const p0 = host.querySelector<HTMLInputElement>("[data-tier-input='p0']")!;
    p0.value = ""; p0.dispatchEvent(new Event("input"));
    host.querySelector<HTMLElement>("[data-save]")!.click();
    expect(new PolicyStore().getTiers().p0).toBe(130);
  });

  it("Scoring pane edits tier thresholds and persists on save", () => {
    localStorage.clear(); sessionStorage.clear();
    document.body.innerHTML = `<div id="h"></div>`;
    const creds = new CredStore(); const scopes = new ScopeStore(); const policy = new PolicyStore();
    let changed = 0;
    const host = document.getElementById("h")!;
    const s = mountSettings(host, { sources: [github], creds, scopes, policy, onChange: () => { changed++; } });
    s.open("github");
    // switch to Scoring & priority
    host.querySelector<HTMLElement>("[data-category='scoring']")!.click();
    const p0 = host.querySelector<HTMLInputElement>("[data-tier-input='p0']")!;
    expect(p0.value).toBe("130");
    p0.value = "150"; p0.dispatchEvent(new Event("input"));
    host.querySelector<HTMLElement>("[data-save]")!.click();
    expect(new PolicyStore().getTiers().p0).toBe(150);
    expect(changed).toBeGreaterThan(0);
  });

  it("labels the global cutoffs as the built-in scoring default", () => {
    localStorage.clear(); sessionStorage.clear();
    document.body.innerHTML = `<div id="hbid"></div>`;
    const creds = new CredStore(); const scopes = new ScopeStore(); const policy = new PolicyStore();
    const host = document.getElementById("hbid")!;
    const s = mountSettings(host, { sources: [github], creds, scopes, policy, onChange: () => {} });
    s.open("github");
    host.querySelector<HTMLElement>("[data-category='scoring']")!.click();
    expect(host.querySelector<HTMLElement>("[data-cat-pane='scoring']")!.textContent).toContain("built-in scoring");
  });

  it("flags non-decreasing global cutoffs inline (presentational only)", () => {
    localStorage.clear(); sessionStorage.clear();
    document.body.innerHTML = `<div id="hgv"></div>`;
    const creds = new CredStore(); const scopes = new ScopeStore(); const policy = new PolicyStore();
    const host = document.getElementById("hgv")!;
    const s = mountSettings(host, { sources: [github], creds, scopes, policy, onChange: () => {} });
    s.open("github");
    host.querySelector<HTMLElement>("[data-category='scoring']")!.click();
    const pane = host.querySelector<HTMLElement>("[data-cat-pane='scoring']")!;
    const p0 = host.querySelector<HTMLInputElement>("[data-tier-input='p0']")!;
    const p1 = host.querySelector<HTMLInputElement>("[data-tier-input='p1']")!;
    // p0 below p1 → non-decreasing ordering
    p1.value = "60"; p1.dispatchEvent(new Event("input"));
    p0.value = "50"; p0.dispatchEvent(new Event("input"));
    expect(pane.querySelector("[data-tier-invalid]")).toBeTruthy();
    expect(p0.getAttribute("aria-invalid")).toBe("true");
    // does not block Save / persist semantics
    expect(host.querySelector<HTMLButtonElement>("[data-save]")!.disabled).toBe(false);
  });

  it("clears the inline flag when global cutoffs strictly decrease", () => {
    localStorage.clear(); sessionStorage.clear();
    document.body.innerHTML = `<div id="hgv2"></div>`;
    const creds = new CredStore(); const scopes = new ScopeStore(); const policy = new PolicyStore();
    const host = document.getElementById("hgv2")!;
    const s = mountSettings(host, { sources: [github], creds, scopes, policy, onChange: () => {} });
    s.open("github");
    host.querySelector<HTMLElement>("[data-category='scoring']")!.click();
    const pane = host.querySelector<HTMLElement>("[data-cat-pane='scoring']")!;
    const p0 = host.querySelector<HTMLInputElement>("[data-tier-input='p0']")!;
    const p1 = host.querySelector<HTMLInputElement>("[data-tier-input='p1']")!;
    const p2 = host.querySelector<HTMLInputElement>("[data-tier-input='p2']")!;
    p2.value = "10"; p2.dispatchEvent(new Event("input"));
    p1.value = "50"; p1.dispatchEvent(new Event("input"));
    p0.value = "100"; p0.dispatchEvent(new Event("input"));
    expect(pane.querySelector("[data-tier-invalid]")).toBeNull();
    expect(p0.getAttribute("aria-invalid")).toBe("false");
  });

  it("offers four sidebar categories", () => {
    const { host, s } = mount();
    s.open("github");
    const cats = [...host.querySelectorAll("[data-category]")].map(c => (c as HTMLElement).dataset.category);
    expect(cats).toEqual(["connections", "scoring", "filters", "general"]);
  });

  it("defaults to the Connections category on open", () => {
    const { host, s } = mount();
    s.open("github");
    expect(host.querySelector("[data-category='connections']")!.classList.contains("on")).toBe(true);
    expect(host.querySelector<HTMLElement>("[data-cat-pane='connections']")!.hidden).toBe(false);
    for (const id of ["scoring", "filters", "general"]) {
      expect(host.querySelector<HTMLElement>(`[data-cat-pane='${id}']`)!.hidden).toBe(true);
    }
  });

  it("switches to the Scoring pane on click, hiding the others", () => {
    const { host, s } = mount();
    s.open("github");
    host.querySelector<HTMLElement>("[data-category='scoring']")!.click();
    expect(host.querySelector("[data-category='scoring']")!.classList.contains("on")).toBe(true);
    expect(host.querySelector("[data-category='connections']")!.classList.contains("on")).toBe(false);
    expect(host.querySelector<HTMLElement>("[data-cat-pane='scoring']")!.hidden).toBe(false);
    expect(host.querySelector<HTMLElement>("[data-cat-pane='connections']")!.hidden).toBe(true);
  });

  it("open('github') defaults to connections and expands the provider", () => {
    const { host, s } = mount();
    s.open("github");
    expect(host.querySelector("[data-category='connections']")!.classList.contains("on")).toBe(true);
    expect(host.querySelector("[data-cat-pane='connections'] [data-cred]")).toBeTruthy();
  });

  it("marks only the edited category with an unsaved dot, cleared on Cancel", () => {
    const { host, s } = mount();
    s.open("github");
    // navigate to Filters and stage a bot add
    host.querySelector<HTMLElement>("[data-category='filters']")!.click();
    const botAdd = host.querySelector<HTMLInputElement>("[data-bot-add]")!;
    botAdd.value = "renovate";
    botAdd.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));

    expect(host.querySelector("[data-category='filters'] [data-unsaved]")).toBeTruthy();
    expect(host.querySelector("[data-category='connections'] [data-unsaved]")).toBeNull();
    expect(host.querySelector("[data-category='scoring'] [data-unsaved]")).toBeNull();
    expect(host.querySelector("[data-category='general'] [data-unsaved]")).toBeNull();

    host.querySelector<HTMLElement>("[data-cancel]")!.click();
    expect(host.querySelector("[data-unsaved]")).toBeNull();
  });

  it("clears the unsaved dot after Save", () => {
    const { host, s } = mount();
    s.open("github");
    host.querySelector<HTMLElement>("[data-category='filters']")!.click();
    const botAdd = host.querySelector<HTMLInputElement>("[data-bot-add]")!;
    botAdd.value = "dependabot";
    botAdd.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    expect(host.querySelector("[data-category='filters'] [data-unsaved]")).toBeTruthy();
    host.querySelector<HTMLElement>("[data-save]")!.click();
    expect(host.querySelector("[data-unsaved]")).toBeNull();
  });

  it("Escape closes the sheet without saving", () => {
    const { host, creds, s } = mount();
    s.open("github");
    const panel = host.querySelector<HTMLElement>("[data-panel]")!;
    expect(panel.classList.contains("open")).toBe(true);
    const input = host.querySelector<HTMLInputElement>("[data-cred]")!;
    input.value = "ghp_x"; input.dispatchEvent(new Event("input"));
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    expect(panel.classList.contains("open")).toBe(false);            // dismissed
    expect(creds.has("github")).toBe(false);                          // draft discarded, not saved
  });
});
