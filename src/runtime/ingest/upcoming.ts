import { type Source, registerSource } from "./source";
import type { DomainId } from "../dataset/domain";
import type { Kind } from "../dataset/item";

const stub = (id: string, domain: DomainId, kinds: Kind[]): Source => ({
  id, domain, kinds, connectSrc: [], status: "upcoming", scopeSchema: [],
  async fetch() { throw new Error(`${id} source is not implemented yet`); },
});
// Roadmap placeholders — advertised under their domain, never fetched.
[
  stub("gitlab",     "code-security", ["dependency-vuln"]),
  stub("aws",        "cloud-posture", ["infra-misconfig"]),
  stub("gcp",        "cloud-posture", ["infra-misconfig"]),
  stub("cloudflare", "edge-security", ["edge-misconfig", "waf-finding"]),
  stub("jira",       "work-items",    ["work-item"]),
].forEach(registerSource);
