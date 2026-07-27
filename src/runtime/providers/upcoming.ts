import type { Kind } from "../dataset/item";
import type { ProviderDeclaration } from "../catalog/types";

const upcoming = (
  id: string,
  label: string,
  kinds: readonly Kind[],
): ProviderDeclaration => ({
  id,
  label,
  status: "upcoming",
  kinds,
  connection: {
    setupHint: `${label} support is on the roadmap.`,
    scopeFields: [],
  },
  capabilities: {
    discoverScope: false,
    enrich: [],
    actions: {},
  },
});

export const upcomingProviders: readonly ProviderDeclaration[] = Object.freeze([
  upcoming("gitlab", "GitLab", [
    "dependency-vuln",
    "change-request",
    "issue",
  ]),
  upcoming("bitbucket", "Bitbucket", [
    "dependency-vuln",
    "change-request",
    "issue",
  ]),
  upcoming("aws", "AWS", ["cloud-misconfig"]),
  upcoming("gcp", "Google Cloud", ["cloud-misconfig"]),
  upcoming("cloudflare", "Cloudflare", [
    "edge-misconfig",
    "waf-finding",
  ]),
  upcoming("jira", "Jira", ["task"]),
]);
