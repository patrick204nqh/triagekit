// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { mountSettings } from "../../src/runtime/shell/settings";
import { CredStore } from "../../src/runtime/shell/cred-store";
import { ScopeStore } from "../../src/runtime/shell/scope-store";
import { PolicyStore } from "../../src/runtime/shell/policy-store";

function host() { const h = document.createElement("div"); document.body.appendChild(h); return h; }

describe("unified save bar", () => {
  it("shows a 0-change baseline and increments when a bot is added", () => {
    const h = host();
    const s = mountSettings(h, { sources: [], creds: new CredStore(), scopes: new ScopeStore(), policy: new PolicyStore(), onChange: () => {} });
    s.open();
    const count = () => h.querySelector("[data-unsaved-count]")!.textContent;
    expect(count()).toContain("0");
    h.querySelector<HTMLElement>("[data-category='filters']")!.click();
    const add = h.querySelector<HTMLInputElement>("[data-bot-add]")!;
    add.value = "spambot";
    add.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(count()).toContain("1");
    // singular wording: "1 unsaved change" not "1 unsaved changes"
    expect(count()).toBe("1 unsaved change");
    // discard resets the count to 0 (panel hides but markup persists)
    h.querySelector<HTMLElement>("[data-cancel]")!.click();
    expect(count()).toContain("0");
  });
});
