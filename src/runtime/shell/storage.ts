const KEY = "triagekit.token";

export class TokenStore {
  set(token: string, opts: { remember?: boolean } = {}) {
    const store = opts.remember ? localStorage : sessionStorage;
    (opts.remember ? sessionStorage : localStorage).removeItem(KEY);
    store.setItem(KEY, token);
  }
  get(): string | null {
    return sessionStorage.getItem(KEY) ?? localStorage.getItem(KEY);
  }
  clear() { sessionStorage.removeItem(KEY); localStorage.removeItem(KEY); }
}
