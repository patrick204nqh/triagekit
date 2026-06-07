// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { mountSettings } from "../../src/runtime/shell/settings";
import { getThemeChoice, setThemeChoice } from "../../src/runtime/shell/theme";
import { getRefreshInterval, setRefreshInterval, REFRESH_OPTIONS } from "../../src/runtime/shell/refresh";
import { CredStore } from "../../src/runtime/shell/cred-store";
import { ScopeStore } from "../../src/runtime/shell/scope-store";
import { PolicyStore } from "../../src/runtime/shell/policy-store";

function host() { const h = document.createElement("div"); document.body.appendChild(h); return h; }

describe("settings stages theme", () => {
  beforeEach(() => { setThemeChoice("light"); });

  it("previews a theme change but reverts on discard", () => {
    const h = host();
    const s = mountSettings(h, { sources: [], creds: new CredStore(), scopes: new ScopeStore(), policy: new PolicyStore(), onChange: () => {}, onThemeChange: () => {} });
    s.open();
    h.querySelector<HTMLElement>("[data-category='general']")!.click();
    h.querySelector<HTMLElement>('[data-theme="dark"]')!.click();
    expect(getThemeChoice()).toBe("dark");          // live preview applied
    h.querySelector<HTMLElement>("[data-cancel]")!.click();
    expect(getThemeChoice()).toBe("light");          // reverted on discard
  });

  it("keeps the theme change on save", () => {
    const h = host();
    const s = mountSettings(h, { sources: [], creds: new CredStore(), scopes: new ScopeStore(), policy: new PolicyStore(), onChange: () => {}, onThemeChange: () => {} });
    s.open();
    h.querySelector<HTMLElement>("[data-category='general']")!.click();
    h.querySelector<HTMLElement>('[data-theme="dark"]')!.click();
    h.querySelector<HTMLElement>("[data-save]")!.click();
    expect(getThemeChoice()).toBe("dark");
  });
});

describe("settings stages auto-refresh", () => {
  // Baseline: first option (value 0, "Off"); tests pick second option (value 300, "5m").
  beforeEach(() => { setRefreshInterval(REFRESH_OPTIONS[0].value); });

  it("previews a refresh change but reverts on discard", () => {
    const h = host();
    const s = mountSettings(h, { sources: [], creds: new CredStore(), scopes: new ScopeStore(), policy: new PolicyStore(), onChange: () => {}, onRefreshChange: () => {} });
    s.open();
    h.querySelector<HTMLElement>("[data-category='general']")!.click();
    const newValue = REFRESH_OPTIONS[1].value; // 300
    h.querySelector<HTMLElement>(`[data-refresh="${newValue}"]`)!.click();
    expect(getRefreshInterval()).toBe(newValue);  // live preview applied
    h.querySelector<HTMLElement>("[data-cancel]")!.click();
    expect(getRefreshInterval()).toBe(REFRESH_OPTIONS[0].value); // reverted on discard
  });

  it("keeps the refresh change on save", () => {
    const h = host();
    const s = mountSettings(h, { sources: [], creds: new CredStore(), scopes: new ScopeStore(), policy: new PolicyStore(), onChange: () => {}, onRefreshChange: () => {} });
    s.open();
    h.querySelector<HTMLElement>("[data-category='general']")!.click();
    const newValue = REFRESH_OPTIONS[1].value; // 300
    h.querySelector<HTMLElement>(`[data-refresh="${newValue}"]`)!.click();
    h.querySelector<HTMLElement>("[data-save]")!.click();
    expect(getRefreshInterval()).toBe(newValue);
  });
});
