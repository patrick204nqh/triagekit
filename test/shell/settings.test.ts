// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { mountSettings } from "../../src/runtime/shell/settings";
import { CredStore } from "../../src/runtime/shell/cred-store";
import { ScopeStore } from "../../src/runtime/shell/scope-store";
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
  const creds = new CredStore(); const scopes = new ScopeStore();
  const s = mountSettings(host, { sources: [github], creds, scopes, onChange: () => {}, ...extra });
  return { host, creds, scopes, s };
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
    const s = mountSettings(host, { sources: [src], creds, scopes, onChange: () => {} });
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

  it("surfaces provider setup guidance (row ⓘ + form link)", () => {
    const src: Source = { ...github, setup: { hint: "Use a fine-grained PAT.", url: "https://example.test/pat" } };
    const host = document.createElement("div"); document.body.appendChild(host);
    const s = mountSettings(host, { sources: [src], creds: new CredStore(), scopes: new ScopeStore(), onChange: () => {} });
    s.open("github");
    expect(host.querySelector(".conn-item .info")?.getAttribute("title")).toBe("Use a fine-grained PAT.");
    const link = host.querySelector<HTMLAnchorElement>(".set-link");
    expect(link?.getAttribute("href")).toBe("https://example.test/pat");
    expect(host.querySelector(".conn-item .cmeta")?.textContent).not.toMatch(/Security/);   // domain noise gone
  });
});
