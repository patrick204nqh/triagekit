// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { mountSettings } from "../../src/runtime/shell/settings";
import { PolicyStore } from "../../src/runtime/shell/policy-store";
import { provider } from "../helpers/provider";
import { createConnectionSettingsFixture } from "../helpers/connection-settings";

const src = provider({ kinds: ["issue"] });

function host() { const h = document.createElement("div"); document.body.appendChild(h); return h; }

describe("connection token field", () => {
  it("renders a show/hide toggle for the credential", () => {
    const h = host();
    const fixture = createConnectionSettingsFixture();
    fixture.creds.set("github", "tok");
    const s = mountSettings(h, { providers: [src], connections: fixture.connections, policy: new PolicyStore(), onChange: () => {} });
    s.open("github");
    const toggle = h.querySelector<HTMLElement>("[data-cred-toggle]");
    const input = h.querySelector<HTMLInputElement>("[data-cred]")!;
    expect(toggle).toBeTruthy();
    expect(input.type).toBe("password");
    toggle!.click();
    expect(h.querySelector<HTMLInputElement>("[data-cred]")!.type).toBe("text");
  });
});
