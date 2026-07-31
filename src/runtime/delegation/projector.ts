import type { RuntimeCatalog } from "../catalog/types";
import type { HandoffValueV1 } from "../handoff/types";
import {
  projectTarget,
  type TargetProjectionInput,
} from "../handoff/projector";
import type { ScoredItem } from "../layout/table/kind-renderer";
import type { ScoreExplanation } from "../scoring/score-model";

const BODY_LIMIT = 4_000;

export interface DelegationFreshness {
  readonly validatedAt: string;
  readonly stale: boolean;
}

export interface DelegationTargetProjectionInput {
  readonly item: ScoredItem;
  readonly explanation: ScoreExplanation | null;
  readonly catalog: RuntimeCatalog;
  readonly freshness?: DelegationFreshness;
  readonly note?: string;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function actorLogin(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  return stringValue(record(value).login);
}

function actorLogins(value: unknown): string[] {
  return Array.isArray(value)
    ? value.flatMap((actor) => {
      const login = actorLogin(actor);
      return login ? [login] : [];
    })
    : [];
}

function labelNames(value: unknown): string[] {
  return Array.isArray(value)
    ? value.flatMap((label) => {
      const name = typeof label === "string"
        ? label
        : stringValue(record(label).name);
      return name ? [name] : [];
    })
    : [];
}

function boundedBody(
  details: Record<string, HandoffValueV1>,
  body: unknown,
): void {
  if (typeof body !== "string") return;
  details.body = body.slice(0, BODY_LIMIT);
  if (body.length > BODY_LIMIT) {
    details.truncation = {
      field: "body",
      originalLength: body.length,
    };
  }
}

function curatedDetails(item: ScoredItem): Record<string, HandoffValueV1> {
  const source = record(item.details);
  const details: Record<string, HandoffValueV1> = {};
  if (item.kind === "dependency-vuln") {
    const values = {
      package: stringValue(source.package),
      severity: stringValue(source.severity),
      advisoryId: stringValue(source.advisoryId),
      dependencyScope: stringValue(source.scope),
      fixVersion: stringValue(source.fixVersion),
      fixAvailable: booleanValue(source.fixAvailable),
      manifestPath: stringValue(source.manifestPath),
    };
    for (const [key, value] of Object.entries(values)) {
      if (value !== undefined) details[key] = value;
    }
  } else if (item.kind === "code-scanning") {
    const location = record(source.location);
    const values = {
      ruleId: stringValue(source.ruleId),
      ruleName: stringValue(source.ruleName),
      tool: stringValue(source.tool),
      severity: stringValue(source.securitySeverity),
      filePath: stringValue(location.path),
      line: numberValue(location.line),
      state: stringValue(source.state),
    };
    for (const [key, value] of Object.entries(values)) {
      if (value !== undefined) details[key] = value;
    }
  } else if (item.kind === "change-request") {
    const checks = record(source.checks);
    const values = {
      number: numberValue(source.number),
      state: stringValue(source.state),
      draft: booleanValue(source.draft)
        ?? (source.state === "draft" ? true : undefined),
      author: actorLogin(source.author),
      labels: labelNames(source.labels),
      reviewers: actorLogins(source.reviewers),
      checkState: stringValue(checks.state),
    };
    for (const [key, value] of Object.entries(values)) {
      if (value !== undefined) details[key] = value;
    }
    boundedBody(details, source.body);
  } else if (item.kind === "issue") {
    const values = {
      number: numberValue(source.number),
      state: stringValue(source.state),
      author: actorLogin(source.author),
      assignees: actorLogins(source.assignees),
      labels: labelNames(source.labels),
    };
    for (const [key, value] of Object.entries(values)) {
      if (value !== undefined) details[key] = value;
    }
    boundedBody(details, source.body);
  }
  return details;
}

export function projectDelegationTarget(
  input: DelegationTargetProjectionInput,
) {
  const targetInput: TargetProjectionInput = input;
  const target = projectTarget(targetInput);
  const details = curatedDetails(input.item);
  if (input.freshness) {
    if (Number.isNaN(Date.parse(input.freshness.validatedAt))) {
      throw new Error("Freshness timestamp must be valid ISO-8601");
    }
    details.freshness = {
      validatedAt: input.freshness.validatedAt,
      stale: input.freshness.stale,
    };
  }
  const note = input.note?.trim();
  return {
    ...target,
    ...(note ? { note } : {}),
    details,
  };
}
