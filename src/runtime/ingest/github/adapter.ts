import type { TriageItem } from "../../dataset/item";
import { type DependencyVulnDetails, DEPENDENCY_VULN, severityToSignal } from "../../dataset/kinds/dependency-vuln";
import { type Source, type TriageError, type DiscoveryOption, registerSource } from "../source";
import { ghPaginate, GH_HEADERS } from "./paginate";

type Severity = DependencyVulnDetails["severity"];
const SEVERITIES: Severity[] = ["critical", "high", "medium", "low"];
const normSeverity = (s: unknown): Severity => SEVERITIES.includes(s as Severity) ? (s as Severity) : "low";
const normScope = (s: unknown): DependencyVulnDetails["scope"] => s === "runtime" || s === "development" ? s : null;

function toItem(full: string, raw: any): TriageItem<DependencyVulnDetails> {
  const adv = raw.security_advisory ?? {}, vuln = raw.security_vulnerability ?? {};
  const severity = normSeverity(adv.severity), cvss = adv.cvss?.score ?? 0;
  const pkg = raw.dependency?.package?.name ?? "";
  return {
    id: `github:${full}:${raw.number ?? pkg}`, source: "github", kind: DEPENDENCY_VULN,
    title: pkg, location: full, signal: severityToSignal(severity, cvss),
    createdAt: raw.created_at ?? "", url: raw.html_url ?? "",
    details: { package: pkg, severity, cvss, scope: normScope(raw.dependency?.scope),
      fixAvailable: !!vuln.first_patched_version, fixVersion: vuln.first_patched_version?.identifier ?? null },
  };
}
async function fetchRepoItems(full: string, token: string) {
  const out: TriageItem<DependencyVulnDetails>[] = [];
  const [owner, name] = full.split("/");
  const url = `https://api.github.com/repos/${owner}/${name}/dependabot/alerts?state=open&per_page=100`;
  const res = await ghPaginate(url, GH_HEADERS(token), (page) => {
    for (const raw of page) { if (raw.auto_dismissed_at) continue; out.push(toItem(full, raw)); }
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
  scopeSchema: [
    { key: "repos", label: "Repositories", type: "multiselect", discoverable: true, required: true },
  ],
  async fetch(scope, token) {
    const repos = (scope.repos as string[]) ?? [];
    const settled = await Promise.allSettled(repos.map(full => fetchRepoItems(full, token)));
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
registerSource(githubSource);
