// ── GitHub fetch (paginated, CORS-friendly) ──────────────────────────────────
// Walk a paginated GitHub list endpoint, calling onPage(pageArray, response) per page.
// Follows the Link: rel="next" header. onPage returning false stops early (for caps).
// Returns the last Response so callers can read status / rate-limit / error body.
export type OnPage = (page: any[], res: Response) => boolean | void;

export async function ghPaginate(
  url: string | null,
  headers: Record<string, string>,
  onPage: OnPage,
): Promise<Response> {
  let res: Response = undefined as unknown as Response;
  while (url) {
    res = await fetch(url, { headers });
    if (!res.ok) return res;                       // caller inspects res for the error
    if (onPage(await res.json(), res) === false) break;
    const link = res.headers.get("link") || "";
    const next = link.split(",").find(s => s.includes('rel="next"'));
    url = next ? next.slice(next.indexOf("<") + 1, next.indexOf(">")) : null;
  }
  return res;
}

export const GH_HEADERS = (token: string): Record<string, string> => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
});
