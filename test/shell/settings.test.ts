// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { mountSettings } from "../../src/runtime/shell/settings";
import { PolicyStore } from "../../src/runtime/shell/policy-store";
import { provider } from "../helpers/provider";
import { createConnectionSettingsFixture } from "../helpers/connection-settings";
import type {
  FocusPolicySnapshot,
  FocusPolicyStore,
} from "../../src/runtime/focus/types";

const github = provider({
  scopeFields: [{
    key: "repos",
    label: "Repositories",
    type: "multiselect",
    discoverable: true,
  }],
  capabilities: {
    discoverScope: true,
    enrich: [],
    actions: {},
  },
  adapter: {
    refresh: async () => [],
    discoverScope: async () => [{
      value: "acme/web",
      label: "web",
      group: "acme",
    }],
  },
});

function mount(extra?: Partial<Parameters<typeof mountSettings>[1]>) {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: true, media: q, addEventListener() {}, removeEventListener() {} }) as any);
  const host = document.createElement("div"); document.body.appendChild(host);
  const fixture = createConnectionSettingsFixture();
  const policy = new PolicyStore();
  const s = mountSettings(host, {
    providers: [github],
    connections: fixture.connections,
    policy,
    onChange: () => {},
    ...extra,
  });
  return { host, ...fixture, policy, s };
}

async function clickAndFlush(host: HTMLElement, selector: string): Promise<void> {
  host.querySelector<HTMLElement>(selector)!.click();
  await Promise.resolve();
  await Promise.resolve();
}

class MemoryFocusPolicyStore implements FocusPolicyStore {
  private readonly policies = new Map<string, FocusPolicySnapshot>();

  get(provider: string): FocusPolicySnapshot {
    return this.policies.get(provider) ?? {
      provider,
      repositoryOrder: [],
      labels: { include: [], exclude: [], enabled: true },
    };
  }

  set(policy: FocusPolicySnapshot): void {
    this.policies.set(policy.provider, policy);
  }
}

function mountWithRepositories(repositories: string[]) {
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: true,
    media: q,
    addEventListener() {},
    removeEventListener() {},
  }) as any);
  const host = document.createElement("div");
  document.body.appendChild(host);
  const fixture = createConnectionSettingsFixture();
  fixture.creds.set("github", "token");
  fixture.scopes.set("github", { repos: repositories });
  const focusPolicies = new MemoryFocusPolicyStore();
  const policy = new PolicyStore(focusPolicies);
  const s = mountSettings(host, {
    providers: [github],
    connections: fixture.connections,
    policy,
    onChange: () => {},
  });
  return { host, s, focusPolicies };
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

  it.each(["scoring", "repositories", "exclusions"] as const)(
    "opens directly to the requested %s category",
    (category) => {
      const { host, s } = mount();
      s.open("github", category);

      expect(
        host.querySelector<HTMLElement>("[data-category].on")?.dataset.category,
      ).toBe(category);
      expect(
        host.querySelector<HTMLElement>(`[data-cat-pane="${category}"]`)?.hidden,
      ).toBe(false);
    },
  );

  it("reorders active repositories without committing before Save", async () => {
    const { host, s, focusPolicies } = mountWithRepositories([
      "acme-corp/core",
      "acme-corp/web",
      "acme-corp/docs",
    ]);
    s.open("github", "repositories");
    const web = host.querySelector<HTMLElement>(
      '[data-selected-repository][data-repository="acme-corp/web"]',
    )!;
    web.dispatchEvent(new KeyboardEvent("keydown", {
      key: "ArrowUp",
      altKey: true,
      bubbles: true,
    }));
    expect(focusPolicies.get("github").repositoryOrder).toEqual([]);
    host.querySelector<HTMLElement>("[data-save]")!.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(focusPolicies.get("github").repositoryOrder).toEqual([
      "acme-corp/web",
      "acme-corp/core",
      "acme-corp/docs",
    ]);
    expect(host.querySelector("[role=status]")?.textContent)
      .toContain("acme-corp/web moved to priority 1");
  });

  it("filters repository rows without rewriting their staged order", () => {
    const { host, s, focusPolicies } = mountWithRepositories([
      "acme-corp/core",
      "acme-corp/web",
      "acme-corp/docs",
    ]);
    s.open("github", "repositories");
    const search = host.querySelector<HTMLInputElement>(
      "[data-selected-search]",
    )!;
    search.value = "docs";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    expect(host.querySelectorAll("[data-selected-repository]")).toHaveLength(1);
    host.querySelector<HTMLElement>("[data-save]")!.click();
    expect(focusPolicies.get("github").repositoryOrder).toEqual([]);
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

  it("disconnects while retaining cached data", async () => {
    vi.stubGlobal("confirm", () => true);
    const { host, creds, s } = mount();
    creds.set("github", "ghp_x");
    s.open("github");
    host.querySelector<HTMLElement>('[data-disconnect="retain-cache"]')!.click();
    await Promise.resolve();
    expect(creds.has("github")).toBe(false);
  });

  it("exposes an auto-refresh control wired to the preference", () => {
    const { host, s, connections } = mount();
    s.open("github");
    const opts = host.querySelectorAll("[data-refresh-seg] [data-refresh]");
    expect([...opts].map((option) =>
      (option as HTMLElement).dataset.refresh))
      .toEqual(["off", "300", "600", "900"]);
    host.querySelector<HTMLElement>('[data-refresh="300"]')!.click();
    expect(connections.cadence("github")).toBe(300);
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

  it("stages repository discovery and selection until Save", async () => {
    const discover = vi.fn(async () => [
      { value: "acme/web", label: "web", group: "acme" },
      { value: "acme/api", label: "api", group: "acme" },
    ]);
    const src = github;
    const host = document.createElement("div"); document.body.appendChild(host);
    const fixture = createConnectionSettingsFixture();
    const { creds, scopes } = fixture;
    fixture.setDiscover(discover);
    creds.set("github", "ghp_x");
    const s = mountSettings(host, {
      providers: [src],
      connections: fixture.connections,
      policy: new PolicyStore(),
      onChange: () => {},
    });
    s.open("github", "repositories");

    host.querySelector<HTMLElement>("[data-discover-repositories]")!.click();
    await Promise.resolve(); await Promise.resolve();
    expect(discover).toHaveBeenCalledTimes(1);
    expect(host.querySelectorAll("[data-available-repository]")).toHaveLength(2);

    host.querySelector<HTMLElement>(
      '[data-add-repository="acme/api"]',
    )!.click();
    expect(host.querySelectorAll("[data-selected-repository]")).toHaveLength(1);
    expect(scopes.get("github")).toEqual({});

    host.querySelector<HTMLElement>("[data-save]")!.click();
    expect(scopes.get("github")).toEqual({ repos: ["acme/api"] });

    s.open("github", "repositories");
    expect(discover).toHaveBeenCalledTimes(1);
    expect(host.querySelector(
      '[data-selected-repository][data-repository="acme/api"]',
    )).not.toBeNull();
  });

  it("discards staged repository selection and order on Cancel", async () => {
    const { host, s, creds, scopes, policy, setDiscover } = mount();
    creds.set("github", "token");
    scopes.set("github", {
      repos: ["acme-corp/core", "acme-corp/web"],
    });
    const discover = vi.fn(async () => [
      { value: "acme-corp/core", label: "core", group: "acme-corp" },
      { value: "acme-corp/web", label: "web", group: "acme-corp" },
      { value: "acme-corp/api", label: "api", group: "acme-corp" },
    ]);
    setDiscover(discover);

    s.open("github", "repositories");
    const discoverButton = host.querySelector<HTMLElement>(
      "[data-discover-repositories]",
    )!;
    discoverButton.click();
    await Promise.resolve();
    await Promise.resolve();
    host.querySelector<HTMLElement>(
      '[data-add-repository="acme-corp/api"]',
    )!.click();
    host.querySelector<HTMLElement>(
      '[data-selected-repository][data-repository="acme-corp/web"]',
    )!.dispatchEvent(new KeyboardEvent("keydown", {
      key: "ArrowUp",
      altKey: true,
      bubbles: true,
    }));
    host.querySelector<HTMLElement>("[data-cancel]")!.click();

    expect(scopes.get("github")).toEqual({
      repos: ["acme-corp/core", "acme-corp/web"],
    });
    expect(policy.getFocusPolicy("github").repositoryOrder).toEqual([]);
  });

  it("keeps repository drafts independent while switching providers", async () => {
    const gitlab = provider({
      id: "gitlab",
      label: "GitLab",
      scopeFields: [{
        key: "repos",
        label: "Repositories",
        type: "multiselect",
        discoverable: true,
      }],
    });
    const host = document.createElement("div");
    document.body.appendChild(host);
    const fixture = createConnectionSettingsFixture();
    fixture.creds.set("github", "github-token");
    fixture.creds.set("gitlab", "gitlab-token");
    fixture.setDiscover(async (providerId) => providerId === "github"
      ? [{ value: "acme-corp/api", label: "api", group: "acme-corp" }]
      : [{ value: "acme-labs/app", label: "app", group: "acme-labs" }]);
    const settings = mountSettings(host, {
      providers: [github, gitlab],
      connections: fixture.connections,
      policy: new PolicyStore(),
      onChange: () => {},
    });
    settings.open("github", "repositories");

    await clickAndFlush(host, "[data-discover-repositories]");
    host.querySelector<HTMLElement>(
      '[data-add-repository="acme-corp/api"]',
    )!.click();

    const providerSelect = host.querySelector<HTMLSelectElement>(
      "[data-provider-select]",
    )!;
    providerSelect.value = "gitlab";
    providerSelect.dispatchEvent(new Event("change", { bubbles: true }));
    await clickAndFlush(host, "[data-discover-repositories]");
    host.querySelector<HTMLElement>(
      '[data-add-repository="acme-labs/app"]',
    )!.click();

    providerSelect.value = "github";
    providerSelect.dispatchEvent(new Event("change", { bubbles: true }));
    expect(host.querySelector(
      '[data-selected-repository][data-repository="acme-corp/api"]',
    )).not.toBeNull();

    host.querySelector<HTMLElement>("[data-save]")!.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(fixture.scopes.get("github")).toEqual({
      repos: ["acme-corp/api"],
    });
    expect(fixture.scopes.get("gitlab")).toEqual({
      repos: ["acme-labs/app"],
    });
  });

  it("keeps repository drafts open and retryable when Save fails", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const fixture = createConnectionSettingsFixture();
    fixture.creds.set("github", "token");
    fixture.setDiscover(async () => [
      { value: "acme-corp/api", label: "api", group: "acme-corp" },
    ]);
    const settings = mountSettings(host, {
      providers: [github],
      connections: {
        ...fixture.connections,
        async save() {
          throw new Error("credential rejected");
        },
      },
      policy: new PolicyStore(),
      onChange: () => {},
    });
    settings.open("github", "repositories");
    await clickAndFlush(host, "[data-discover-repositories]");
    host.querySelector<HTMLElement>(
      '[data-add-repository="acme-corp/api"]',
    )!.click();

    host.querySelector<HTMLElement>("[data-save]")!.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(host.querySelector("[data-panel]")?.classList.contains("open"))
      .toBe(true);
    expect(host.querySelector("[data-save-error]")?.textContent)
      .toContain("credential rejected");
    expect(host.querySelector(
      "[data-category='repositories'] [data-unsaved]",
    )).not.toBeNull();
  });

  it("saves credentials under the stable provider id", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: true,
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }) as any);
    const host = document.createElement("div");
    document.body.appendChild(host);
    const fixture = createConnectionSettingsFixture();
    const { creds } = fixture;
    const settings = mountSettings(host, {
      providers: [github],
      connections: fixture.connections,
      policy: new PolicyStore(),
      onChange: () => {},
    });

    settings.open("github");
    const input = host.querySelector<HTMLInputElement>("[data-cred]")!;
    input.value = "ghp_x";
    input.dispatchEvent(new Event("input"));
    host.querySelector<HTMLElement>("[data-save]")!.click();
    await Promise.resolve();

    expect(host.querySelectorAll(".conn-item")).toHaveLength(1);
    expect(creds.get("github")).toBe("ghp_x");
  });
  it("shows saved repositories on open before any discovery", () => {
    const discover = vi.fn(async () => [{ value: "acme/web", label: "web", group: "acme" }]);
    const src = github;
    const host = document.createElement("div"); document.body.appendChild(host);
    const fixture = createConnectionSettingsFixture();
    const { creds, scopes } = fixture;
    fixture.setDiscover(discover);
    creds.set("github", "tok");
    scopes.set("github", { repos: ["acme/web", "acme/api"] });
    const s = mountSettings(host, {
      providers: [src],
      connections: fixture.connections,
      policy: new PolicyStore(),
      onChange: () => {},
    });
    s.open("github", "repositories");
    const repositories = [
      ...host.querySelectorAll<HTMLElement>("[data-selected-repository]"),
    ].map((row) => row.dataset.repository);
    expect(repositories).toEqual(["acme/web", "acme/api"]);
    expect(discover).not.toHaveBeenCalled();
  });

  it("surfaces provider setup guidance (row ⓘ + form link)", () => {
    const src = {
      ...github,
      connection: {
        ...github.connection,
        setupHint: "Use a fine-grained PAT.",
        setupUrl: "https://example.test/pat",
      },
    };
    const host = document.createElement("div"); document.body.appendChild(host);
    const s = mountSettings(host, {
      providers: [src],
      connections: createConnectionSettingsFixture().connections,
      policy: new PolicyStore(),
      onChange: () => {},
    });
    s.open("github");
    expect(host.querySelector(".conn-item .info")?.getAttribute("title")).toBe("Use a fine-grained PAT.");
    const link = host.querySelector<HTMLAnchorElement>(".set-link");
    expect(link?.getAttribute("href")).toBe("https://example.test/pat");
    expect(host.querySelector(".conn-item .cmeta")?.textContent).not.toMatch(/Security/);   // domain noise gone
  });

  it("ignores negative tier input and leaves the default unchanged", () => {
    localStorage.clear(); sessionStorage.clear();
    document.body.innerHTML = `<div id="h3"></div>`;
    const policy = new PolicyStore();
    const host = document.getElementById("h3")!;
    const s = mountSettings(host, { providers: [github], connections: createConnectionSettingsFixture().connections, policy, onChange: () => {} });
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
    const policy = new PolicyStore();
    const host = document.getElementById("h2")!;
    const s = mountSettings(host, { providers: [github], connections: createConnectionSettingsFixture().connections, policy, onChange: () => {} });
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
    const policy = new PolicyStore();
    let changed = 0;
    const host = document.getElementById("h")!;
    const s = mountSettings(host, { providers: [github], connections: createConnectionSettingsFixture().connections, policy, onChange: () => { changed++; } });
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
    const policy = new PolicyStore();
    const host = document.getElementById("hbid")!;
    const s = mountSettings(host, { providers: [github], connections: createConnectionSettingsFixture().connections, policy, onChange: () => {} });
    s.open("github");
    host.querySelector<HTMLElement>("[data-category='scoring']")!.click();
    expect(host.querySelector<HTMLElement>("[data-cat-pane='scoring']")!.textContent).toContain("built-in scoring");
  });

  it("flags non-decreasing global cutoffs inline (presentational only)", () => {
    localStorage.clear(); sessionStorage.clear();
    document.body.innerHTML = `<div id="hgv"></div>`;
    const policy = new PolicyStore();
    const host = document.getElementById("hgv")!;
    const s = mountSettings(host, { providers: [github], connections: createConnectionSettingsFixture().connections, policy, onChange: () => {} });
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
    const policy = new PolicyStore();
    const host = document.getElementById("hgv2")!;
    const s = mountSettings(host, { providers: [github], connections: createConnectionSettingsFixture().connections, policy, onChange: () => {} });
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

  it("offers the five approved sidebar categories", () => {
    const { host, s } = mount();
    s.open("github");
    const cats = [...host.querySelectorAll("[data-category]")].map(c => (c as HTMLElement).dataset.category);
    expect(cats).toEqual([
      "connections",
      "repositories",
      "scoring",
      "exclusions",
      "general",
    ]);
  });

  it("keeps repository discovery out of Connections and mounts its workspace separately", () => {
    const { host, s } = mount();
    s.open("github", "connections");

    expect(host.querySelector(
      "[data-cat-pane='connections'] [data-discover]",
    )).toBeNull();
    expect(host.querySelector(
      "[data-cat-pane='connections'] [data-selected-repository]",
    )).toBeNull();

    s.open("github", "repositories");
    expect(host.querySelector(
      "[data-cat-pane='repositories'] [data-repository-settings]",
    )).not.toBeNull();
  });

  it("defaults to the Connections category on open", () => {
    const { host, s } = mount();
    s.open("github");
    expect(host.querySelector("[data-category='connections']")!.classList.contains("on")).toBe(true);
    expect(host.querySelector<HTMLElement>("[data-cat-pane='connections']")!.hidden).toBe(false);
    for (const id of ["repositories", "scoring", "exclusions", "general"]) {
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
    // navigate to Exclusions and stage a bot add
    host.querySelector<HTMLElement>("[data-category='exclusions']")!.click();
    const botAdd = host.querySelector<HTMLInputElement>("[data-bot-add]")!;
    botAdd.value = "renovate";
    botAdd.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));

    expect(host.querySelector("[data-category='exclusions'] [data-unsaved]")).toBeTruthy();
    expect(host.querySelector("[data-category='connections'] [data-unsaved]")).toBeNull();
    expect(host.querySelector("[data-category='scoring'] [data-unsaved]")).toBeNull();
    expect(host.querySelector("[data-category='general'] [data-unsaved]")).toBeNull();

    host.querySelector<HTMLElement>("[data-cancel]")!.click();
    expect(host.querySelector("[data-unsaved]")).toBeNull();
  });

  it("clears the unsaved dot after Save", () => {
    const { host, s } = mount();
    s.open("github");
    host.querySelector<HTMLElement>("[data-category='exclusions']")!.click();
    const botAdd = host.querySelector<HTMLInputElement>("[data-bot-add]")!;
    botAdd.value = "dependabot";
    botAdd.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    expect(host.querySelector("[data-category='exclusions'] [data-unsaved]")).toBeTruthy();
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
