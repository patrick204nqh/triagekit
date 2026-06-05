// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { githubSource } from "../../../src/runtime/ingest/github/adapter";
import type { DependencyVulnDetails } from "../../../src/runtime/dataset/kinds/dependency-vuln";

describe("githubSource.fetch", () => {
  it("normalizes a raw dependabot alert (scope = owner/name repos)", async () => {
    const raw = [{ number: 7, security_advisory: { severity: "high", cvss: { score: 7.5 } },
      security_vulnerability: { first_patched_version: { identifier: "1.2.3" } },
      dependency: { scope: "runtime", package: { name: "axios" } },
      created_at: "2026-01-01T00:00:00Z", html_url: "https://example/ghsa" }];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(raw), { status: 200 })));
    const { items, errors } = await githubSource.fetch({ repos: ["acme-corp/web-app"] }, "t");
    expect(errors).toEqual([]);
    expect(items[0]).toMatchObject({ source: "github", kind: "dependency-vuln", location: "acme-corp/web-app", title: "axios" });
    expect(items[0].details as DependencyVulnDetails).toMatchObject({ fixVersion: "1.2.3", severity: "high" });
  });
  it("surfaces a failed repo non-fatally with the full name as target", async () => {
    const ok = [{ security_advisory: { severity: "low", cvss: { score: 2 } }, dependency: { package: { name: "lodash" } } }];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.includes("/disabled/")
      ? new Response(JSON.stringify({ message: "Dependabot alerts are disabled for this repository." }), { status: 403 })
      : new Response(JSON.stringify(ok), { status: 200 })));
    const { items, errors } = await githubSource.fetch({ repos: ["acme/healthy", "acme/disabled"] }, "t");
    expect(items).toHaveLength(1);
    expect(errors).toEqual([{ target: "acme/disabled", message: "403 Dependabot alerts are disabled for this repository." }]);
  });
});

describe("githubSource.discover", () => {
  it("maps /user/repos to grouped DiscoveryOptions", async () => {
    const page = [
      { full_name: "acme-corp/web-app", name: "web-app", owner: { login: "acme-corp" } },
      { full_name: "huy/dotfiles", name: "dotfiles", owner: { login: "huy" } },
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(page), { status: 200 })));
    const opts = await githubSource.discover!("t");
    expect(opts).toContainEqual({ value: "acme-corp/web-app", label: "web-app", group: "acme-corp" });
    expect(opts).toContainEqual({ value: "huy/dotfiles", label: "dotfiles", group: "huy" });
  });
});
