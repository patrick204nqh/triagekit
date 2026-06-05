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

describe("mountSettings", () => {
  beforeEach(() => { sessionStorage.clear(); localStorage.clear(); document.body.innerHTML = ""; });
  it("renders a connections list and a credential field for the selected source", () => {
    const host = document.createElement("div"); document.body.appendChild(host);
    const s = mountSettings(host, { sources: [github], creds: new CredStore(), scopes: new ScopeStore(), onChange: () => {} });
    s.open("github");
    expect(host.querySelector(".conn-item")).toBeTruthy();
    expect(host.querySelector("[data-cred]")).toBeTruthy();
  });
  it("persists a typed credential per source", () => {
    const host = document.createElement("div"); document.body.appendChild(host);
    const creds = new CredStore();
    const s = mountSettings(host, { sources: [github], creds, scopes: new ScopeStore(), onChange: () => {} });
    s.open("github");
    const input = host.querySelector<HTMLInputElement>("[data-cred]")!;
    input.value = "ghp_x"; input.dispatchEvent(new Event("input"));
    expect(creds.has("github")).toBe(true);
  });
});
