import { vi } from "vitest";
import type { TriageItem } from "../../src/runtime/dataset/item";

const repositoryFrom = (url: string): string => {
  const match = url.match(/\/repos\/([^/]+\/[^/]+)\//);
  return match?.[1] ?? "";
};

const dependencyAlert = (item: TriageItem) => {
  const details = item.details as Record<string, unknown>;
  return {
    number: (item.providerRef as { number?: unknown }).number ?? item.id,
    security_advisory: {
      severity: details.severity,
      cvss: { score: details.cvss },
    },
    security_vulnerability: {
      first_patched_version: details.fixAvailable
        ? { identifier: details.fixVersion }
        : null,
    },
    dependency: {
      scope: details.scope,
      package: { name: details.package ?? item.title },
    },
    created_at: item.createdAt,
    html_url: item.url,
  };
};

export function mockGithubItems(items: readonly TriageItem[]) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    const repository = repositoryFrom(url);
    const repositoryItems = items.filter((item) => item.location === repository);

    if (url.includes("/dependabot/alerts")) {
      return new Response(JSON.stringify(
        repositoryItems
          .filter((item) => item.kind === "dependency-vuln")
          .map(dependencyAlert),
      ), { status: 200 });
    }

    return new Response("[]", { status: 200 });
  });
}
