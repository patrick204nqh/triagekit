export const DEPENDENCY_VULN = "dependency-vuln" as const;

export interface DependencyVulnDetails {
  package: string;
  severity: "critical" | "high" | "medium" | "low";
  cvss: number;
  scope: "runtime" | "development" | null;
  fixAvailable: boolean;
  fixVersion: string | null;   // extracted by the adapter (today the VIEW digs into raw JSON)
}

// Severity sets the band; cvss (0–10) refines within it. `signal` is for cross-source
// sorting/display only — the dependency-vuln scorer computes priority separately.
export function severityToSignal(severity: DependencyVulnDetails["severity"], cvss: number): number {
  const base = { critical: 75, high: 55, medium: 30, low: 10 }[severity] ?? 0;
  return Math.min(100, Math.max(0, Math.round(base + cvss * 2.5)));
}
