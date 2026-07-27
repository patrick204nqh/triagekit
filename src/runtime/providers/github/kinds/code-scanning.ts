import type { TriageItem } from "../../../dataset/item";
import {
  CODE_SCANNING,
  type CodeScanningDetails,
  type CodeScanningSeverity,
  type CodeScanningState,
} from "../../../dataset/kinds/code-scanning";
import { GithubHttpError } from "../http";
import type { GithubKindIngest } from "../repository-ingest";

const severity: Record<string, CodeScanningSeverity> = {
  critical: "critical", high: "high", medium: "medium", low: "low",
};
const state: Record<string, CodeScanningState> = {
  open: "open", dismissed: "dismissed", fixed: "fixed",
};
const signal: Record<CodeScanningSeverity, number> = {
  critical: 100, high: 70, medium: 40, low: 10,
};

export const codeScanningIngest: GithubKindIngest = {
  kinds: [CODE_SCANNING],
  async fetchRepository(http, repository, credential) {
    let rows: readonly any[];
    try {
      rows = await http.paginate<any>(
        `/repos/${repository}/code-scanning/alerts?state=open&per_page=100`,
        credential,
      );
    } catch (error) {
      if (error instanceof GithubHttpError && error.status === 404) return [];
      throw error;
    }
    return rows.map((raw) => {
      const securitySeverity = severity[raw.rule?.security_severity_level] ?? "low";
      const location = raw.most_recent_instance?.location ?? {};
      const number = raw.number;
      return {
        id: `github:${repository}:cs:${number}`,
        provider: "github",
        providerRef: { repository, number },
        kind: CODE_SCANNING,
        title: raw.rule?.name ?? raw.rule?.id ?? "",
        location: repository,
        signal: signal[securitySeverity],
        createdAt: raw.created_at ?? "",
        url: raw.html_url ?? "",
        details: {
          ruleId: raw.rule?.id ?? "",
          ruleName: raw.rule?.name ?? raw.rule?.id ?? "",
          tool: raw.tool?.name ?? "",
          location: {
            path: location.path ?? "",
            line: location.start_line ?? 0,
          },
          securitySeverity,
          state: state[raw.state] ?? "open",
          permalink: raw.html_url ?? "",
        },
      } satisfies TriageItem<CodeScanningDetails>;
    });
  },
};
