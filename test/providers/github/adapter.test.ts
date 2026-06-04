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
    const out = await githubAdapter.alerts({ org: "acme-corp", repos: ["web-app"], token: "t" });
    expect(out[0]).toMatchObject({ repo: "web-app", package: "axios", severity: "high", cvss: 7.5, fixAvailable: true, scope: "runtime" });
  });
});
