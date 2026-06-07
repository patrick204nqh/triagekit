export interface UrlState {
  provider?: string;
  repo?: string;
  artifact?: string;
  view?: string;
  sort?: string;
  axes?: Record<string, string[]>;   // axisId -> values
}

const RESERVED = ["provider", "repo", "artifact", "view", "sort"] as const;
type Reserved = (typeof RESERVED)[number];

/** Parse a query string into a UrlState (only keys that are present). */
export function readUrlState(search: string = location.search): UrlState {
  const params = new URLSearchParams(search);
  const out: UrlState = {};
  for (const key of RESERVED) {
    const v = params.get(key);
    if (v) out[key as Reserved] = v;
  }
  for (const [key, value] of params.entries()) {
    if ((RESERVED as readonly string[]).includes(key)) continue;
    if (!value) continue;
    (out.axes ??= {})[key] = value.split(",");
  }
  return out;
}

/** Serialize to "?provider=…&repo=…&…" and history.replaceState (no history spam). */
export function writeUrlState(s: UrlState): void {
  const params = new URLSearchParams();
  for (const key of RESERVED) {
    const v = s[key as Reserved];
    if (v) params.set(key, v);
  }
  if (s.axes) {
    for (const [axisId, vals] of Object.entries(s.axes)) {
      if (vals && vals.length) params.set(axisId, vals.join(","));
    }
  }
  const qs = params.toString();
  const url = qs ? `${location.pathname}?${qs}` : location.pathname;
  history.replaceState(history.state, "", url);
}
