import type {
  DiscoveryOption,
  Scope,
} from "../../src/runtime/catalog/types";
import type {
  RefreshCadence,
} from "../../src/runtime/cached-dataset/types";
import type {
  ConnectionSettingsPort,
} from "../../src/runtime/shell/settings";

export const createConnectionSettingsFixture = () => {
  const credentials = new Map<string, string>();
  const scopes = new Map<string, Scope>();
  const cadences = new Map<string, RefreshCadence>();
  let discover = async (
    _provider: string,
    _credential?: string,
  ): Promise<readonly DiscoveryOption[]> => [];

  const creds = {
    get: (provider: string) => credentials.get(provider) ?? null,
    has: (provider: string) => Boolean(credentials.get(provider)),
    set(provider: string, value: string) {
      const trimmed = value.trim();
      if (trimmed) credentials.set(provider, trimmed);
      else credentials.delete(provider);
    },
  };
  const scopeStore = {
    get: (provider: string) => scopes.get(provider) ?? {},
    set: (provider: string, scope: Scope) => {
      scopes.set(provider, scope);
    },
  };
  const connections: ConnectionSettingsPort = {
    has: creds.has,
    scope: scopeStore.get,
    cadence: (provider) => cadences.get(provider) ?? "off",
    discover: (provider, credential) => discover(provider, credential),
    async save(provider, credential, scope) {
      if (credential !== undefined) creds.set(provider, credential);
      scopeStore.set(provider, scope);
    },
    setCadence(provider, cadence) {
      cadences.set(provider, cadence);
    },
    async clearCachedData() {},
    async disconnect(provider, mode) {
      creds.set(provider, "");
      if (mode === "erase") scopeStore.set(provider, {});
    },
  };

  return {
    connections,
    creds,
    scopes: scopeStore,
    setDiscover(next: typeof discover) {
      discover = next;
    },
  };
};
