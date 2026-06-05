import type { Scope } from "../ingest/source";
// Per-source scope bag — non-secret, localStorage, survives sessions.
const KEY = (id: string) => `triagekit.scope.${id}`;
export class ScopeStore {
  get(sourceId: string): Scope {
    try { return JSON.parse(localStorage.getItem(KEY(sourceId)) ?? "{}"); } catch { return {}; }
  }
  set(sourceId: string, scope: Scope) { localStorage.setItem(KEY(sourceId), JSON.stringify(scope)); }
}
