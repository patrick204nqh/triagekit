// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { readUrlState, writeUrlState } from "../../src/runtime/shell/url-state";

beforeEach(() => { history.replaceState(null, "", "/"); });

describe("readUrlState", () => {
  it("parses reserved scalars and axes (repo decoded, axis values split)", () => {
    const s = readUrlState("?provider=github&repo=acme%2Fapi&artifact=change-request&view=list&sort=recent&tier=P0,P1");
    expect(s).toEqual({
      provider: "github",
      repo: "acme/api",
      artifact: "change-request",
      view: "list",
      sort: "recent",
      axes: { tier: ["P0", "P1"] },
    });
  });

  it("returns {} for an empty query", () => {
    expect(readUrlState("?")).toEqual({});
    expect(readUrlState("")).toEqual({});
  });

  it("treats any non-reserved key as an axis", () => {
    const s = readUrlState("?author=bot");
    expect(s.axes).toEqual({ author: ["bot"] });
  });
});

describe("writeUrlState", () => {
  it("round-trips through readUrlState", () => {
    const state = {
      provider: "github", repo: "acme/api", artifact: "issue",
      view: "list", sort: "recent", axes: { tier: ["P0", "P1"], author: ["bot"] },
    };
    writeUrlState(state);
    expect(readUrlState(location.search)).toEqual(state);
  });

  it("omits empty/absent fields from the query string", () => {
    writeUrlState({ provider: "github", repo: "", axes: { tier: [] } });
    const params = new URLSearchParams(location.search);
    expect(params.get("provider")).toBe("github");
    expect(params.has("repo")).toBe(false);   // empty repo omitted
    expect(params.has("tier")).toBe(false);    // empty axis omitted
  });

  it("uses replaceState (does not grow history length)", () => {
    const before = history.length;
    writeUrlState({ provider: "github" });
    writeUrlState({ provider: "github", view: "insights" });
    expect(history.length).toBe(before);
  });
});
