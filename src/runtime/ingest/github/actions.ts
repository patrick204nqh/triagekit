import { GH_HEADERS } from "./paginate";
import type { ReviewActions, ReviewItem, MergeMethod } from "../../dataset/kinds/review";

function target(item: ReviewItem): { owner: string; name: string; number: number } {
  const [owner, name] = item.location.split("/");
  return { owner, name, number: item.details.number };
}

async function ok(res: Response, what: string): Promise<void> {
  if (res.ok) return;
  let msg = `${res.status}`;
  try { const j = await res.json(); if (j.message) msg += ` ${j.message}`; } catch { /* ignore */ }
  throw new Error(`${what} failed: ${msg}`);
}

export function makeGithubActions(token: string): ReviewActions {
  const headers = { ...GH_HEADERS(token), "content-type": "application/json" };
  const api = "https://api.github.com";

  return {
    async merge(item: ReviewItem, method: MergeMethod) {
      const { owner, name, number } = target(item);
      const res = await fetch(`${api}/repos/${owner}/${name}/pulls/${number}/merge`,
        { method: "PUT", headers, body: JSON.stringify({ merge_method: method }) });
      await ok(res, "merge");
    },
    async comment(item: ReviewItem, body: string) {
      const { owner, name, number } = target(item);
      const res = await fetch(`${api}/repos/${owner}/${name}/issues/${number}/comments`,
        { method: "POST", headers, body: JSON.stringify({ body }) });
      await ok(res, "comment");
    },
    async addLabels(item: ReviewItem, names: string[]) {
      const { owner, name, number } = target(item);
      const res = await fetch(`${api}/repos/${owner}/${name}/issues/${number}/labels`,
        { method: "POST", headers, body: JSON.stringify({ labels: names }) });
      await ok(res, "add labels");
    },
    async assign(item: ReviewItem, logins: string[]) {
      const { owner, name, number } = target(item);
      const res = await fetch(`${api}/repos/${owner}/${name}/issues/${number}/assignees`,
        { method: "POST", headers, body: JSON.stringify({ assignees: logins }) });
      await ok(res, "assign");
    },
    async close(item: ReviewItem) {
      const { owner, name, number } = target(item);
      const res = await fetch(`${api}/repos/${owner}/${name}/issues/${number}`,
        { method: "PATCH", headers, body: JSON.stringify({ state: "closed" }) });
      await ok(res, "close");
    },
  };
}
