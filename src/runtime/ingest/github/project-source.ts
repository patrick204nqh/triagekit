import type { DatasetStore } from "../../core/store";
import { registerEnricher, type PostFetchEnricher } from "../../core/enrichment";
import type { TriageItem } from "../../dataset/item";
import { CHANGE_REQUEST, ISSUE, type ReviewDetails } from "../../dataset/shapes/review";
import { registerFilterAxis, type FilterAxis } from "../../layout/toolbar/axis-registry";
import { ghGraphQL } from "./graphql";

export function parseProjectRef(raw: unknown): { owner: string; number: number } | null {
  if (typeof raw !== "string") return null;
  const match = raw.trim().match(/^([^/\s]+)\/(\d+)$/);
  return match ? { owner: match[1], number: Number(match[2]) } : null;
}

export function projectStatusOf(item: TriageItem): string | undefined {
  return (item.details as Partial<ReviewDetails> | null)?.projectStatus;
}

const STATUS_QUERY = `query($owner:String!,$number:Int!){
  organization(login:$owner){ projectV2(number:$number){ ...P } }
  user(login:$owner){ projectV2(number:$number){ ...P } }
}
fragment P on ProjectV2 { items(first:100){ nodes {
  content { __typename ... on Issue { number repository { nameWithOwner } } ... on PullRequest { number repository { nameWithOwner } } }
  fieldValueByName(name:"Status"){ ... on ProjectV2ItemFieldSingleSelectValue { name } }
} } }`;

export function parseBoard(data: any): Map<string, string> {
  const map = new Map<string, string>();
  const project = data?.organization?.projectV2 ?? data?.user?.projectV2;
  for (const node of project?.items?.nodes ?? []) {
    const content = node?.content;
    const status = node?.fieldValueByName?.name;
    if (!content?.repository?.nameWithOwner || content.number == null || !status) continue;
    map.set(`${content.repository.nameWithOwner}#${content.number}`, status);
  }
  return map;
}

export function applyProjectStatuses(store: DatasetStore, map: Map<string, string>): void {
  store.updateItems((item) => {
    if (item.kind !== CHANGE_REQUEST && item.kind !== ISSUE) return;
    const details = item.details as ReviewDetails;
    const status = map.get(`${item.location}#${details.number}`);
    if (status) details.projectStatus = status;
  });
}

export const projectStatusEnricher: PostFetchEnricher = {
  id: "project-status",
  async enrich(store, ctx) {
    const github = ctx.jobs.find((job) => job.provider === "github");
    const projectRef = parseProjectRef(github?.scope?.project);
    if (!github || !projectRef) return [];
    const target = `github project ${projectRef.owner}/${projectRef.number}`;
    try {
      const result = await ghGraphQL(github.token, STATUS_QUERY, projectRef);
      if (result.errors?.length) return [{ target, message: result.errors[0].message }];
      applyProjectStatuses(store, parseBoard(result.data));
      return [];
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return [{ target, message }];
    }
  },
};

registerEnricher(projectStatusEnricher);

export const projectStatusAxis: FilterAxis = {
  id: "project-status",
  label: "Status",
  widget: "chips",
  quick: false,
  appliesTo: (rows) => rows.some((row) => projectStatusOf(row) !== undefined),
  optionsFrom: (rows) => [...new Set(rows.map(projectStatusOf).filter((status): status is string => !!status))]
    .sort()
    .map((value) => ({ value, label: value })),
  test: (item, selected) => {
    const status = projectStatusOf(item);
    return status !== undefined && selected.includes(status);
  },
};

registerFilterAxis(projectStatusAxis);
