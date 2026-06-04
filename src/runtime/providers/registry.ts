export interface Alert {
  repo: string; package: string; severity: "critical" | "high" | "medium" | "low";
  cvss: number; fixAvailable: boolean; scope: "runtime" | "development" | null;
  createdAt: string; ghsaUrl: string; raw: unknown;
}

export interface ProviderAdapter {
  id: string;
  connectSrc: string[];            // origins the CSP must allow, e.g. ["https://api.github.com"]
  alerts(opts: { org: string; repos: string[]; token: string }): Promise<Alert[]>;
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
