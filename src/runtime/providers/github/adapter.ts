import { type Alert, type ProviderAdapter, registerProvider } from "../registry";
import { ghPaginate, GH_HEADERS } from "./paginate";

type Severity = Alert["severity"];
const SEVERITIES: Severity[] = ["critical", "high", "medium", "low"];
function normSeverity(s: unknown): Severity {
  return SEVERITIES.includes(s as Severity) ? (s as Severity) : "low";
}

function normScope(s: unknown): Alert["scope"] {
  return s === "runtime" || s === "development" ? s : null;
}

function toAlert(repo: string, raw: any): Alert {
  const adv = raw.security_advisory ?? {};
  return {
    repo,
    package: raw.dependency?.package?.name ?? "",
    severity: normSeverity(adv.severity),
    cvss: adv.cvss?.score ?? 0,
    fixAvailable: !!raw.security_vulnerability?.first_patched_version,
    scope: normScope(raw.dependency?.scope),
    createdAt: raw.created_at ?? "",
    ghsaUrl: raw.html_url ?? "",
    raw,
  };
}

async function fetchRepoAlerts(org: string, repo: string, token: string): Promise<Alert[]> {
  const out: Alert[] = [];
  const url = `https://api.github.com/repos/${org}/${repo}/dependabot/alerts?state=open&per_page=100`;
  const res = await ghPaginate(url, GH_HEADERS(token), (page) => {
    for (const raw of page) {
      if (raw.auto_dismissed_at) continue;
      out.push(toAlert(repo, raw));
    }
  });
  if (!res.ok) {
    let msg = `${repo}: ${res.status}`;
    try { const j = await res.json(); msg += ` ${j.message || ""}`; } catch { /* ignore */ }
    if (res.status === 403 && res.headers.get("x-github-sso")) msg += " — token not SSO-authorized for org";
    throw new Error(msg);
  }
  return out;
}

export const githubAdapter: ProviderAdapter = {
  id: "github",
  connectSrc: ["https://api.github.com"],
  async alerts({ org, repos, token }) {
    const results = await Promise.all(repos.map(r => fetchRepoAlerts(org, r, token)));
    return results.flat();
  },
};

registerProvider(githubAdapter);
