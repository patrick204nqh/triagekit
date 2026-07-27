// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { healthOf, scopeSummary } from "../../src/runtime/shell/health";
import { CredStore } from "../../src/runtime/shell/cred-store";
import { provider } from "../helpers/provider";

describe("provider health", () => {
  beforeEach(() => sessionStorage.clear());

  it("upcoming providers are always upcoming", () => {
    expect(healthOf(provider({ status: "upcoming" }), new CredStore()))
      .toBe("upcoming");
  });

  it("a ready provider needs its credential", () => {
    const creds = new CredStore();
    const github = provider();

    expect(healthOf(github, creds)).toBe("needs-token");
    creds.set("github", "token");
    expect(healthOf(github, creds)).toBe("connected");
  });

  it("summarizes multiselect scope fields", () => {
    const github = provider({
      scopeFields: [{
        key: "repos",
        label: "Repositories",
        type: "multiselect",
      }],
    });

    expect(scopeSummary(github, {})).toBe("scope not set");
    expect(scopeSummary(github, { repos: ["a", "b", "c"] }))
      .toBe("3 repositories");
  });

  it("keys credentials by the stable Provider id", () => {
    const creds = new CredStore();
    const github = provider({ kinds: ["issue", "change-request"] });

    creds.set(github.id, "token");

    expect(healthOf(github, creds)).toBe("connected");
  });
});
