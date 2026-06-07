// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { mountSettings } from "../../src/runtime/shell/settings";
import { CredStore } from "../../src/runtime/shell/cred-store";
import { ScopeStore } from "../../src/runtime/shell/scope-store";
import { PolicyStore } from "../../src/runtime/shell/policy-store";
import type { Source } from "../../src/runtime/ingest/source";

const src = { id: "github-review", provider: "github", domain: "work-items", kinds: ["issue"],
  connectSrc: [], status: "ready", scopeSchema: [], setup: { hint: "h" } } as unknown as Source;

function host() { const h = document.createElement("div"); document.body.appendChild(h); return h; }

describe("connection token field", () => {
  it("renders a show/hide toggle for the credential", () => {
    const h = host();
    const creds = new CredStore(); creds.set("github", "tok");
    const s = mountSettings(h, { sources: [src], creds, scopes: new ScopeStore(), policy: new PolicyStore(), onChange: () => {} });
    s.open("github");
    const toggle = h.querySelector<HTMLElement>("[data-cred-toggle]");
    const input = h.querySelector<HTMLInputElement>("[data-cred]")!;
    expect(toggle).toBeTruthy();
    expect(input.type).toBe("password");
    toggle!.click();
    expect(h.querySelector<HTMLInputElement>("[data-cred]")!.type).toBe("text");
  });
});
