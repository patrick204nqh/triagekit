// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { scopeSummary } from "../../src/runtime/shell/health";
import { provider } from "../helpers/provider";

describe("provider health", () => {
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
});
