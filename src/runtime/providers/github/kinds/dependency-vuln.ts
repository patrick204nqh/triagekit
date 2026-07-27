import type { TriageItem } from "../../../dataset/item";
import {
  DEPENDENCY_VULN,
  severityToSignal,
  type DependencyVulnDetails,
} from "../../../dataset/kinds/dependency-vuln";
import type { GithubKindIngest } from "../repository-ingest";

type Severity = DependencyVulnDetails["severity"];
const severities: readonly Severity[] = ["critical", "high", "medium", "low"];

export const dependencyVulnIngest: GithubKindIngest = {
  kinds: [DEPENDENCY_VULN],
  async fetchRepository(http, repository, credential) {
    const rows = await http.paginate<any>(
      `/repos/${repository}/dependabot/alerts?state=open&per_page=100`,
      credential,
    );
    return rows.filter((raw) => !raw.auto_dismissed_at).map((raw) => {
      const advisory = raw.security_advisory ?? {};
      const vulnerability = raw.security_vulnerability ?? {};
      const severity = severities.includes(advisory.severity)
        ? advisory.severity as Severity
        : "low";
      const cvss = advisory.cvss?.score ?? 0;
      const packageName = raw.dependency?.package?.name ?? "";
      return {
        id: `github:${repository}:${raw.number ?? packageName}`,
        provider: "github",
        providerRef: { repository, number: raw.number ?? packageName },
        kind: DEPENDENCY_VULN,
        title: packageName,
        location: repository,
        signal: severityToSignal(severity, cvss),
        createdAt: raw.created_at ?? "",
        url: raw.html_url ?? "",
        details: {
          package: packageName,
          severity,
          cvss,
          scope: raw.dependency?.scope === "runtime"
            || raw.dependency?.scope === "development"
            ? raw.dependency.scope
            : null,
          fixAvailable: Boolean(vulnerability.first_patched_version),
          fixVersion: vulnerability.first_patched_version?.identifier ?? null,
        },
      } satisfies TriageItem<DependencyVulnDetails>;
    });
  },
};
