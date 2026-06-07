import type { TriageItem } from "../../dataset/item";
import { type CodeScanningDetails, type CodeScanningSeverity, type CodeScanningState, CODE_SCANNING } from "../../dataset/kinds/code-scanning";
import { type Source, type TriageError, type DiscoveryOption, registerSource } from "../source";
import { ghPaginate, GH_HEADERS } from "./paginate";

const SEV: Record<string, CodeScanningSeverity> = { critical: "critical", high: "high", medium: "medium", low: "low" };
const STATE: Record<string, CodeScanningState> = { open: "open", dismissed: "dismissed", fixed: "fixed" };
const SIGNAL: Record<CodeScanningSeverity, number> = { critical: 100, high: 70, medium: 40, low: 10 };

// Exported for unit testing the mapping in isolation.
export function toCodeScanningItem(full: string, raw: any): TriageItem<CodeScanningDetails> {
  const number = raw.number;
  const loc = raw.most_recent_instance?.location ?? {};
  const sev = SEV[raw.rule?.security_severity_level] ?? "low";
  return {
    id: `github:${full}:cs:${number}`, source: "github", kind: CODE_SCANNING,
    title: raw.rule?.name ?? raw.rule?.id ?? "code scanning alert", location: full,
    signal: SIGNAL[sev],
    createdAt: raw.created_at ?? "", url: raw.html_url ?? "",
    details: {
      ruleId: raw.rule?.id ?? "", ruleName: raw.rule?.name ?? raw.rule?.id ?? "",
      securitySeverity: sev, tool: raw.tool?.name ?? "unknown",
      location: { path: loc.path ?? "", line: loc.start_line ?? 0 },
      state: STATE[raw.state] ?? "open",
      permalink: raw.html_url ?? "",
    },
  };
}

async function fetchRepoAlerts(full: string, token: string) {
  const out: TriageItem<CodeScanningDetails>[] = [];
  const [owner, name] = full.split("/");
  const url = `https://api.github.com/repos/${owner}/${name}/code-scanning/alerts?state=open&per_page=100`;
  const res = await ghPaginate(url, GH_HEADERS(token), (page) => {
    for (const raw of page) out.push(toCodeScanningItem(full, raw));
  });
  if (!res.ok) {
    // 404 = code scanning not enabled on this repo; treat as empty rather than fatal.
    if (res.status === 404) return out;
    let msg = `${res.status}`;
    try { const j = await res.json(); if (j.message) msg += ` ${j.message}`; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return out;
}

export const githubCodeScanningSource: Source = {
  id: "github-code-scanning", provider: "github", domain: "code-security",
  kinds: [CODE_SCANNING],
  connectSrc: ["https://api.github.com"], status: "ready",
  setup: {
    hint: "Use a token with read access to code scanning alerts on the repositories you triage.",
    url: "https://github.com/settings/personal-access-tokens",
  },
  scopeSchema: [
    { key: "repos", label: "Repositories", type: "multiselect", discoverable: true, required: true },
  ],
  async fetch(scope, token) {
    const repos = (scope.repos as string[]) ?? [];
    const settled = await Promise.allSettled(repos.map(full => fetchRepoAlerts(full, token)));
    const items: TriageItem[] = []; const errors: TriageError[] = [];
    settled.forEach((res, i) => res.status === "fulfilled"
      ? items.push(...res.value)
      : errors.push({ target: repos[i], message: String(res.reason?.message ?? res.reason) }));
    return { items, errors };
  },
  async discover(token) {
    const out: DiscoveryOption[] = [];
    const url = "https://api.github.com/user/repos?per_page=100&affiliation=owner,collaborator,organization_member&sort=full_name";
    const res = await ghPaginate(url, GH_HEADERS(token), (page) => {
      for (const r of page) out.push({ value: r.full_name, label: r.name, group: r.owner?.login ?? "" });
    });
    if (!res.ok) { let m = `${res.status}`; try { const j = await res.json(); if (j.message) m += ` ${j.message}`; } catch { /* ignore */ } throw new Error(m); }
    return out;
  },
};
registerSource(githubCodeScanningSource);
