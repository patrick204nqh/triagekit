// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { PrefsStore } from "../../src/runtime/shell/prefs";

describe("PrefsStore", () => {
  beforeEach(() => { localStorage.clear(); });

  it("persists org and repos in localStorage", () => {
    const p = new PrefsStore();
    p.setOrg("acme-corp");
    p.setRepos(["web-app", "api-gateway"]);
    expect(new PrefsStore().getOrg()).toBe("acme-corp");
    expect(new PrefsStore().getRepos()).toEqual(["web-app", "api-gateway"]);
  });

  it("parses a comma/space separated repo string", () => {
    const p = new PrefsStore();
    p.setRepos("web-app, api-gateway  billing-service");
    expect(p.getRepos()).toEqual(["web-app", "api-gateway", "billing-service"]);
  });

  it("returns empty defaults when nothing is stored", () => {
    const p = new PrefsStore();
    expect(p.getOrg()).toBe("");
    expect(p.getRepos()).toEqual([]);
  });
});
