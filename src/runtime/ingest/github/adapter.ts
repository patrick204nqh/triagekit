import type { TriageItem } from "../../dataset/item";
import { type DependencyVulnDetails, DEPENDENCY_VULN, severityToSignal } from "../../dataset/kinds/dependency-vuln";
import { type Source, type TriageError, registerSource } from "../source";
import { ghPaginate, GH_HEADERS } from "./paginate";

type Severity = DependencyVulnDetails["severity"];
const SEVERITIES: Severity[] = ["critical", "high", "medium", "low"];
const normSeverity = (s: unknown): Severity => SEVERITIES.includes(s as Severity) ? (s as Severity) : "low";
const normScope = (s: unknown): DependencyVulnDetails["scope"] => s === "runtime" || s === "development" ? s : null;

function toItem(repo: string, raw: any): TriageItem<DependencyVulnDetails> {
  const adv = raw.security_advisory ?? {}, vuln = raw.security_vulnerability ?? {};
  const severity = normSeverity(adv.severity), cvss = adv.cvss?.score ?? 0;
  const pkg = raw.dependency?.package?.name ?? "";
  return {
    id: `github:${repo}:${raw.number ?? pkg}`, source: "github", kind: DEPENDENCY_VULN,
    title: pkg, location: repo, signal: severityToSignal(severity, cvss),
    createdAt: raw.created_at ?? "", url: raw.html_url ?? "",
    details: { package: pkg, severity, cvss, scope: normScope(raw.dependency?.scope),
      fixAvailable: !!vuln.first_patched_version, fixVersion: vuln.first_patched_version?.identifier ?? null },
  };
}
async function fetchRepoItems(org: string, repo: string, token: string) {
  const out: TriageItem<DependencyVulnDetails>[] = [];
  const url = `https://api.github.com/repos/${org}/${repo}/dependabot/alerts?state=open&per_page=100`;
  const res = await ghPaginate(url, GH_HEADERS(token), (page) => {
    for (const raw of page) { if (raw.auto_dismissed_at) continue; out.push(toItem(repo, raw)); }
  });
  if (!res.ok) {
    let msg = `${res.status}`;
    try { const j = await res.json(); if (j.message) msg += ` ${j.message}`; } catch { /* ignore */ }
    if (res.status === 403 && res.headers.get("x-github-sso")) msg += " — token not SSO-authorized for org";
    throw new Error(msg);
  }
  return out;
}

export const githubSource: Source = {
  id: "github", domain: "code-security", kinds: [DEPENDENCY_VULN],
  connectSrc: ["https://api.github.com"], status: "ready",
  // Plan 1 scope bag: { org, targets }. Plan 2 swaps to { repos:["owner/name"] } + discover().
  scopeSchema: [
    { key: "org", label: "Organization", type: "text", required: true },
    { key: "targets", label: "Repositories", type: "multiselect", discoverable: true, required: true },
  ],
  async fetch(scope, token) {
    const org = String(scope.org ?? ""); const targets = (scope.targets as string[]) ?? [];
    const settled = await Promise.allSettled(targets.map(r => fetchRepoItems(org, r, token)));
    const items: TriageItem[] = []; const errors: TriageError[] = [];
    settled.forEach((res, i) => res.status === "fulfilled"
      ? items.push(...res.value)
      : errors.push({ target: targets[i], message: String(res.reason?.message ?? res.reason) }));
    return { items, errors };
  },
};
registerSource(githubSource);
