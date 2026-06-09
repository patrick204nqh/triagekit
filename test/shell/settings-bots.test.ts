// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { mountSettings } from "../../src/runtime/shell/settings";
import { PolicyStore } from "../../src/runtime/shell/policy-store";
import type { Source } from "../../src/runtime/ingest/source";

function setup() {
  const host = document.createElement("div"); document.body.appendChild(host);
  const policy = new PolicyStore();
  const api = mountSettings(host, {
    sources: [] as Source[], creds: { get: () => "", set: () => {} } as any,
    scopes: { get: () => ({}), set: () => {} } as any,
    policy, onChange: () => {},
  });
  api.open();
  host.querySelector<HTMLButtonElement>('[data-category="filters"]')!.click();
  return { host, policy };
}

function addBot(host: HTMLElement, value: string, key = "Enter") {
  const inp = host.querySelector<HTMLInputElement>("[data-bot-add]")!;
  inp.value = value;
  inp.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
}

function setupAuto(autoBots: string[]) {
  const host = document.createElement("div"); document.body.appendChild(host);
  const policy = new PolicyStore();
  const api = mountSettings(host, {
    sources: [] as Source[], creds: { get: () => "", set: () => {} } as any,
    scopes: { get: () => ({}), set: () => {} } as any,
    policy, onChange: () => {}, getAutoBots: () => autoBots,
  });
  api.open();
  host.querySelector<HTMLButtonElement>('[data-category="filters"]')!.click();
  return { host, policy };
}

describe("Settings → Bot accounts", () => {
  beforeEach(() => { localStorage.clear(); document.body.innerHTML = ""; });

  it("renders existing bot logins as chips", () => {
    new PolicyStore().setBotLogins(["renovate"]);
    const { host } = setup();
    expect(host.querySelector('[data-rm-bot="renovate"]')).not.toBeNull();
  });
  it("adds a login via Enter and persists it on Save", () => {
    const { host, policy } = setup();
    addBot(host, "dependabot");
    host.querySelector<HTMLButtonElement>("[data-save]")!.click();
    expect(policy.getBotLogins()).toEqual(["dependabot"]);
  });
  it("adds a login via comma and ignores blanks/dupes", () => {
    const { host, policy } = setup();
    addBot(host, "renovate", ",");
    addBot(host, "  ", "Enter");        // blank ignored
    addBot(host, "renovate", "Enter");  // dupe ignored
    host.querySelector<HTMLButtonElement>("[data-save]")!.click();
    expect(policy.getBotLogins()).toEqual(["renovate"]);
  });
  it("removes a chip and persists the removal on Save", () => {
    new PolicyStore().setBotLogins(["renovate", "octobot"]);
    const { host, policy } = setup();
    host.querySelector<HTMLButtonElement>('[data-rm-bot="renovate"]')!.click();
    host.querySelector<HTMLButtonElement>("[data-save]")!.click();
    expect(policy.getBotLogins()).toEqual(["octobot"]);
  });
  it("discards staged bot edits on Cancel", () => {
    new PolicyStore().setBotLogins(["renovate"]);
    const { host, policy } = setup();
    addBot(host, "dependabot");
    host.querySelector<HTMLButtonElement>("[data-cancel]")!.click();
    expect(policy.getBotLogins()).toEqual(["renovate"]);
  });
});

describe("Settings → Auto-detected bots", () => {
  beforeEach(() => { localStorage.clear(); document.body.innerHTML = ""; });

  it("renders auto-detected bots as read-only chips (no remove button)", () => {
    const { host } = setupAuto(["dependabot[bot]", "github-actions[bot]"]);
    const wrap = host.querySelector("[data-auto-bots]")!;
    expect(wrap.textContent).toContain("dependabot[bot]");
    expect(wrap.textContent).toContain("github-actions[bot]");
    expect(wrap.querySelector(".x")).toBeNull();          // not removable
    expect(wrap.querySelector("[data-rm-bot]")).toBeNull();
  });

  it("shows an empty state when there are no auto-detected bots", () => {
    const { host } = setupAuto([]);
    expect(host.querySelector("[data-auto-bots]")!.textContent).toContain("No provider-flagged bots");
  });

  it("keeps the manual list working alongside the auto group", () => {
    const { host, policy } = setupAuto(["dependabot[bot]"]);
    addBot(host, "renovate");
    host.querySelector<HTMLButtonElement>("[data-save]")!.click();
    expect(policy.getBotLogins()).toEqual(["renovate"]);
  });
});
