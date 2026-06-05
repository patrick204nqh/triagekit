// Per-source credentials — session-only (cleared when the tab closes). Never persisted,
// never embedded. One credential per provider (GitHub PAT, AWS keys, …).
const KEY = (id: string) => `triagekit.cred.${id}`;
export class CredStore {
  get(sourceId: string): string | null { return sessionStorage.getItem(KEY(sourceId)); }
  has(sourceId: string): boolean { return !!this.get(sourceId); }
  set(sourceId: string, v: string) {
    const t = v.trim();
    if (t) sessionStorage.setItem(KEY(sourceId), t); else sessionStorage.removeItem(KEY(sourceId));
  }
}
