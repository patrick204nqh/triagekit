import type { TriageItem } from "../../../dataset/item";
import {
  CODE_SCANNING,
  type CodeScanningDetails,
  type CodeScanningSeverity,
  type CodeScanningState,
} from "../../../dataset/kinds/code-scanning";
import { GithubHttpError } from "../http";
import { GithubCodeScanningAlert } from "../schemas";
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
    let rows: readonly unknown[];
    try {
      rows = await http.paginate<unknown>(
        `/repos/${repository}/code-scanning/alerts?state=open&per_page=100`,
        credential,
      );
    } catch (error) {
      if (error instanceof GithubHttpError && error.status === 404) return [];
      throw error;
    }
    return rows.map((raw) => {
      const parsed = GithubCodeScanningAlert.parse(raw);
      const securitySeverity = severity[parsed.rule?.security_severity_level ?? ""] ?? "low";
      const location = parsed.most_recent_instance?.location ?? {};
      const number = parsed.number;
      return {
        id: `github:${repository}:cs:${String(number)}`,
        provider: "github",
        providerRef: { repository, number },
        kind: CODE_SCANNING,
        title: parsed.rule?.name ?? parsed.rule?.id ?? "",
        location: repository,
        signal: signal[securitySeverity],
        createdAt: parsed.created_at ?? "",
        url: parsed.html_url ?? "",
        details: {
          ruleId: parsed.rule?.id ?? "",
          ruleName: parsed.rule?.name ?? parsed.rule?.id ?? "",
          tool: parsed.tool?.name ?? "",
          location: {
            path: location.path ?? "",
            line: location.start_line ?? 0,
          },
          securitySeverity,
          state: state[parsed.state ?? ""] ?? "open",
          permalink: parsed.html_url ?? "",
        },
      } satisfies TriageItem<CodeScanningDetails>;
    });
  },
};
