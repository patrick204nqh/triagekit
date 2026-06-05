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
});
