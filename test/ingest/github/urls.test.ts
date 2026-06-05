import { describe, it, expect } from "vitest";
import { repoUrl, prUrl, issueUrl, advisoryUrl, packageUrl } from "../../../src/runtime/ingest/github/urls";

describe("github url builders", () => {
  it("builds repo, pr, issue, advisory urls", () => {
    expect(repoUrl("acme-corp/web-app")).toBe("https://github.com/acme-corp/web-app");
    expect(prUrl("acme-corp/web-app", 482)).toBe("https://github.com/acme-corp/web-app/pull/482");
    expect(issueUrl("acme-corp/web-app", 311)).toBe("https://github.com/acme-corp/web-app/issues/311");
    expect(advisoryUrl("GHSA-8h12-abcd")).toBe("https://github.com/advisories/GHSA-8h12-abcd");
  });

  it("maps known ecosystems to their registries and falls back to a search", () => {
    expect(packageUrl("npm", "axios")).toBe("https://www.npmjs.com/package/axios");
    expect(packageUrl("pip", "requests")).toBe("https://pypi.org/project/requests/");
    expect(packageUrl("rubygems", "rails")).toBe("https://rubygems.org/gems/rails");
    expect(packageUrl("cargo", "serde")).toBe("https://crates.io/crates/serde");
    expect(packageUrl("unknown", "thing")).toBe("https://github.com/search?q=thing&type=registrypackages");
  });
});
