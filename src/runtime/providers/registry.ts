export interface Alert {
  repo: string; package: string; severity: "critical" | "high" | "medium" | "low";
  cvss: number; fixAvailable: boolean; scope: "runtime" | "development" | null;
  createdAt: string; ghsaUrl: string; raw: unknown;
}

// A single repo that failed to load, surfaced non-fatally alongside the alerts
// that did load (e.g. Dependabot disabled, repo not found, token not scoped).
export interface AlertError { repo: string; message: string; }

// Partial result: alerts from the repos that succeeded, plus per-repo failures.
// One repo erroring must never blank the whole dashboard.
export interface AlertResult { alerts: Alert[]; errors: AlertError[]; }

export interface ProviderAdapter {
  id: string;
  connectSrc: string[];            // origins the CSP must allow, e.g. ["https://api.github.com"]
  alerts(opts: { org: string; repos: string[]; token: string }): Promise<AlertResult>;
}

const adapters = new Map<string, ProviderAdapter>();
export function registerProvider(a: ProviderAdapter) { adapters.set(a.id, a); }
export function getProvider(id: string): ProviderAdapter {
  const a = adapters.get(id);
  if (!a) throw new Error(`unknown provider: ${id}`);
  return a;
}
export function allConnectSrc(): string[] {
  return [...new Set([...adapters.values()].flatMap(a => a.connectSrc))];
}
