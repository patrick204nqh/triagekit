// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { githubSource } from "../../../src/runtime/ingest/github/adapter";
import type { DependencyVulnDetails } from "../../../src/runtime/dataset/kinds/dependency-vuln";

describe("githubSource.fetch", () => {
  it("normalizes a raw dependabot alert into a TriageItem", async () => {
    const raw = [{ number: 7, security_advisory: { severity: "high", cvss: { score: 7.5 } },
      security_vulnerability: { first_patched_version: { identifier: "1.2.3" } },
      dependency: { scope: "runtime", package: { name: "axios" } },
      created_at: "2026-01-01T00:00:00Z", html_url: "https://example/ghsa" }];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(raw), { status: 200 })));
    const { items, errors } = await githubSource.fetch({ org: "acme-corp", targets: ["web-app"] }, "t");
    expect(errors).toEqual([]);
    expect(items[0]).toMatchObject({ source: "github", kind: "dependency-vuln", location: "web-app", title: "axios", url: "https://example/ghsa" });
    const d = items[0].details as DependencyVulnDetails;
    expect(d).toMatchObject({ package: "axios", severity: "high", cvss: 7.5, fixAvailable: true, fixVersion: "1.2.3", scope: "runtime" });
  });
  it("surfaces a failed repo non-fatally", async () => {
    const ok = [{ security_advisory: { severity: "low", cvss: { score: 2.0 } }, dependency: { scope: "runtime", package: { name: "lodash" } } }];
    vi.stubGlobal("fetch", vi.fn(async (url: string) =>
      url.includes("/disabled/")
        ? new Response(JSON.stringify({ message: "Dependabot alerts are disabled for this repository." }), { status: 403 })
        : new Response(JSON.stringify(ok), { status: 200 })));
    const { items, errors } = await githubSource.fetch({ org: "acme-corp", targets: ["healthy", "disabled"] }, "t");
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ location: "healthy", title: "lodash" });
    expect(errors).toEqual([{ target: "disabled", message: "403 Dependabot alerts are disabled for this repository." }]);
  });
});
