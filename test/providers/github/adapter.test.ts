// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { githubAdapter } from "../../../src/runtime/providers/github/adapter";

describe("githubAdapter.alerts", () => {
  it("normalizes a raw dependabot alert into the Alert shape", async () => {
    const raw = [{
      security_advisory: { severity: "high", cvss: { score: 7.5 } },
      security_vulnerability: { first_patched_version: { identifier: "1.2.3" } },
      dependency: { scope: "runtime", package: { name: "axios" } },
      created_at: "2026-01-01T00:00:00Z",
      html_url: "https://example/ghsa",
    }];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(raw), { status: 200 })));
    const { alerts, errors } = await githubAdapter.alerts({ org: "acme-corp", repos: ["web-app"], token: "t" });
    expect(errors).toEqual([]);
    expect(alerts[0]).toMatchObject({ repo: "web-app", package: "axios", severity: "high", cvss: 7.5, fixAvailable: true, scope: "runtime" });
  });

  it("surfaces a failed repo non-fatally while still returning alerts from healthy repos", async () => {
    const ok = [{
      security_advisory: { severity: "low", cvss: { score: 2.0 } },
      dependency: { scope: "runtime", package: { name: "lodash" } },
    }];
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/disabled/")) {
        return new Response(JSON.stringify({ message: "Dependabot alerts are disabled for this repository." }), { status: 403 });
      }
      return new Response(JSON.stringify(ok), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { alerts, errors } = await githubAdapter.alerts({ org: "acme-corp", repos: ["healthy", "disabled"], token: "t" });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ repo: "healthy", package: "lodash" });
    expect(errors).toEqual([{ repo: "disabled", message: "403 Dependabot alerts are disabled for this repository." }]);
  });
});
