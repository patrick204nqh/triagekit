// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { createBrowserSessionUrl } from "../../src/runtime/adapters/browser-session-url";
import {
  parseSessionQuery,
  serializeSessionQuery,
} from "../../src/runtime/session/serialized-session";

describe("serialized Session state", () => {
  it("maps stable domain fields to existing wire keys", () => {
    const parsed = parseSessionQuery(
      "?artifact=issue&provider=github&repo=acme-corp%2Fapi"
      + "&view=list&sort=recent&tier=P0,P1&labels=security",
    );

    expect(parsed).toEqual({
      kind: "issue",
      provider: "github",
      repository: "acme-corp/api",
      view: "list",
      sort: "recent",
      axes: {
        tier: ["P0", "P1"],
        labels: ["security"],
      },
    });
    expect(serializeSessionQuery(parsed)).toContain("artifact=issue");
    expect(serializeSessionQuery(parsed)).toContain("repo=acme-corp%2Fapi");
  });

  it.each(["github-review", "github-code-scanning"])(
    "canonicalizes the legacy provider alias %s",
    (alias) => {
      expect(parseSessionQuery(`?provider=${alias}`).provider).toBe("github");
    },
  );

  it("omits empty values and preserves multiple axis values", () => {
    const query = serializeSessionQuery({
      provider: "github",
      repository: "",
      axes: {
        tier: ["P0", "P1"],
        labels: [],
      },
    });

    expect(query).toContain("provider=github");
    expect(query).toContain("tier=P0%2CP1");
    expect(query).not.toContain("repo=");
    expect(query).not.toContain("labels=");
  });
});

describe("browser Session URL adapter", () => {
  beforeEach(() => {
    history.replaceState(null, "", "/");
  });

  it("reads aliases and writes canonical state", () => {
    history.replaceState(
      null,
      "",
      "/?artifact=issue&provider=github-review"
      + "&repo=acme-corp%2Fapi&labels=security",
    );
    const adapter = createBrowserSessionUrl(window);

    expect(adapter.read()).toEqual({
      kind: "issue",
      provider: "github",
      repository: "acme-corp/api",
      axes: { labels: ["security"] },
    });

    adapter.write({
      kind: "issue",
      provider: "github",
      repository: "acme-corp/api",
      view: "list",
      sort: "priority",
      axes: {},
    });

    expect(location.search).toContain("provider=github");
    expect(location.search).toContain("repo=acme-corp%2Fapi");
    expect(location.search).not.toContain("github-review");
  });

  it("uses replaceState so repeated writes do not grow history", () => {
    const adapter = createBrowserSessionUrl(window);
    const before = history.length;

    adapter.write({ provider: "github" });
    adapter.write({ provider: "github", view: "insights" });

    expect(history.length).toBe(before);
  });
});
