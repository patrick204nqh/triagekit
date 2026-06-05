// Non-secret runtime preferences (org + repos) for the generic dashboard. Persisted
// in localStorage — unlike the token, these are not credentials, so they survive
// across sessions for convenience.
const ORG = "triagekit.org";
const REPOS = "triagekit.repos";

function splitRepos(s: string): string[] {
  return s.split(/[\s,]+/).map(r => r.trim()).filter(Boolean);
}

export class PrefsStore {
  getOrg(): string { return localStorage.getItem(ORG) ?? ""; }
  setOrg(v: string) { localStorage.setItem(ORG, v.trim()); }

  getRepos(): string[] {
    const raw = localStorage.getItem(REPOS);
    return raw ? splitRepos(raw) : [];
  }
  setRepos(v: string[] | string) {
    const arr = Array.isArray(v) ? v.map(r => r.trim()).filter(Boolean) : splitRepos(v);
    localStorage.setItem(REPOS, arr.join(","));
  }

  clear() { localStorage.removeItem(ORG); localStorage.removeItem(REPOS); }
}
