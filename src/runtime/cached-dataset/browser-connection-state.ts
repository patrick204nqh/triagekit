import type { Scope } from "../catalog/types";
import type {
  DisconnectMode,
  RefreshCadence,
} from "./types";

export interface ConnectionState {
  credential(provider: string): string | null;
  saveCredential(provider: string, credential: string): void;
  scope(provider: string): Scope;
  saveScope(provider: string, scope: Scope): void;
  cadence(provider: string): RefreshCadence;
  saveCadence(provider: string, cadence: RefreshCadence): void;
  disconnect(provider: string, mode: DisconnectMode): void;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const credentialKey = (provider: string) => `triagekit.cred.${provider}`;
const scopeKey = (provider: string) => `triagekit.scope.${provider}`;
const cadenceKey = (provider: string) => `triagekit.cadence.${provider}`;
const discoveryKey = (provider: string) => `triagekit.discovery.${provider}`;

const parseScope = (value: string | null): Scope => {
  if (value === null) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Scope
      : {};
  } catch {
    return {};
  }
};

const parseCadence = (value: string | null): RefreshCadence =>
  value === "300" || value === "600" || value === "900"
    ? Number(value) as 300 | 600 | 900
    : "off";

export const createBrowserConnectionState = (
  session: StorageLike = sessionStorage,
  local: StorageLike = localStorage,
): ConnectionState => ({
  credential: (provider) => session.getItem(credentialKey(provider)),
  saveCredential(provider, credential) {
    const trimmed = credential.trim();
    if (trimmed.length > 0) session.setItem(credentialKey(provider), trimmed);
    else session.removeItem(credentialKey(provider));
  },
  scope: (provider) => parseScope(local.getItem(scopeKey(provider))),
  saveScope(provider, scope) {
    local.setItem(scopeKey(provider), JSON.stringify(scope));
  },
  cadence: (provider) => parseCadence(
    local.getItem(cadenceKey(provider))
      ?? local.getItem("triagekit.refresh"),
  ),
  saveCadence(provider, cadence) {
    if (cadence === "off") local.removeItem(cadenceKey(provider));
    else local.setItem(cadenceKey(provider), String(cadence));
  },
  disconnect(provider, mode) {
    session.removeItem(credentialKey(provider));
    if (mode === "erase") {
      local.removeItem(scopeKey(provider));
      local.removeItem(cadenceKey(provider));
      local.removeItem(discoveryKey(provider));
    }
  },
});

const createStorage = (): StorageLike => {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
};

export const createMemoryConnectionState = (): ConnectionState =>
  createBrowserConnectionState(createStorage(), createStorage());
