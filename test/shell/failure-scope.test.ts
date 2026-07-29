import { describe, expect, it } from "vitest";
import type {
  DatasetSnapshot,
} from "../../src/runtime/cached-dataset/types";
import {
  failuresForKinds,
  providerFailures,
} from "../../src/runtime/shell/failure-scope";

const snapshot: DatasetSnapshot = {
  phase: "partial",
  provider: "github",
  scope: { repos: ["acme-corp/api", "acme-corp/web"] },
  cadence: "off",
  items: [],
  slices: [
    {
      target: "acme-corp/api",
      kind: "dependency-vuln",
      freshness: "failed",
      failure: {
        provider: "github",
        kind: "dependency-vuln",
        target: "acme-corp/api",
        category: "provider",
        message: "Dependabot unavailable",
      },
    },
    {
      target: "acme-corp/web",
      kind: "code-scanning",
      freshness: "failed",
      failure: {
        provider: "github",
        kind: "code-scanning",
        target: "acme-corp/web",
        category: "scope",
        message: "Code Security must be enabled",
      },
    },
    {
      target: "acme-corp/api",
      kind: "issue",
      freshness: "fresh",
    },
  ],
  persistence: "indexeddb",
  warnings: [],
};

describe("failure scope selectors", () => {
  it("keeps provider-wide failures while filtering active artifact kinds", () => {
    expect(providerFailures(snapshot).map(({ kind }) => kind))
      .toEqual(["dependency-vuln", "code-scanning"]);
    expect(failuresForKinds(snapshot, ["dependency-vuln"]))
      .toEqual([expect.objectContaining({
        kind: "dependency-vuln",
        target: "acme-corp/api",
      })]);
    expect(failuresForKinds(snapshot, ["issue"])).toEqual([]);
    expect(providerFailures(undefined)).toEqual([]);
  });
});
