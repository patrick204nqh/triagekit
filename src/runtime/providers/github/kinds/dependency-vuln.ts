import type { TriageItem } from "../../../dataset/item";
import {
  DEPENDENCY_VULN,
  severityToSignal,
  type DependencyVulnDetails,
} from "../../../dataset/kinds/dependency-vuln";
import { GithubDependabotAlert } from "../schemas";
import type { GithubKindIngest } from "../repository-ingest";

type Severity = DependencyVulnDetails["severity"];
const severities: readonly Severity[] = ["critical", "high", "medium", "low"];

export const dependencyVulnIngest: GithubKindIngest = {
  kinds: [DEPENDENCY_VULN],
  async fetchRepository(http, repository, credential) {
    const rows = await http.paginate<unknown>(
      `/repos/${repository}/dependabot/alerts?state=open&per_page=100`,
      credential,
    );
    return rows.filter((raw) => {
      const parsed = GithubDependabotAlert.parse(raw);
      return !parsed.auto_dismissed_at;
    }).map((raw) => {
      const parsed = GithubDependabotAlert.parse(raw);
      const advisory = parsed.security_advisory ?? {};
      const vulnerability = parsed.security_vulnerability ?? {};
      const severity = severities.includes(advisory.severity as Severity)
        ? advisory.severity as Severity
        : "low";
      const cvss = advisory.cvss?.score ?? 0;
      const packageName = parsed.dependency?.package?.name ?? "";
      return {
        id: `github:${repository}:${String(parsed.number ?? packageName)}`,
        provider: "github",
        providerRef: { repository, number: parsed.number ?? packageName },
        kind: DEPENDENCY_VULN,
        title: packageName,
        location: repository,
        signal: severityToSignal(severity, cvss),
        createdAt: parsed.created_at ?? "",
        url: parsed.html_url ?? "",
        details: {
          package: packageName,
          severity,
          cvss,
          scope: parsed.dependency?.scope === "runtime"
            || parsed.dependency?.scope === "development"
            ? parsed.dependency.scope
            : null,
          fixAvailable: Boolean(vulnerability.first_patched_version),
          fixVersion: vulnerability.first_patched_version?.identifier ?? null,
        },
      } satisfies TriageItem<DependencyVulnDetails>;
    });
  },
};
