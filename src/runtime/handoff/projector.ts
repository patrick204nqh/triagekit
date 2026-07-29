import type { AgentHandoffV1, HandoffTargetV1 } from "./types";
import type { ScoredItem } from "../layout/table/kind-renderer";
import type { ScoreExplanation } from "../scoring/score-model";
import type { SessionState } from "../session/types";
import type { HandoffIntent } from "./types";
import type { RuntimeCatalog } from "../catalog/types";
import { buildContext } from "./context";
import { defaultIntent } from "./intent";

export interface ProjectInput {
  item: ScoredItem;
  explanation: ScoreExplanation | null;
  session: SessionState;
  intent?: Partial<HandoffIntent>;
  catalog: RuntimeCatalog;
  timestamp?: string;
}

export interface TargetProjectionInput {
  item: ScoredItem;
  explanation: ScoreExplanation | null;
  catalog: RuntimeCatalog;
}

export function projectTarget(
  input: TargetProjectionInput,
): HandoffTargetV1 {
  const { item, explanation, catalog } = input;
  const kindDecl = catalog.readyKind(item.kind);
  const kindProjection = kindDecl?.projectTarget?.(item);

  return {
    id: item.id,
    kind: item.kind,
    provider: item.provider,
    title: kindProjection?.title ?? item.title,
    location: kindProjection?.location ?? item.location,
    url: item.url,
    createdAt: kindProjection?.createdAt ?? item.createdAt,
    providerReference: kindProjection?.providerReference ?? {},
    priority: {
      signal: item.signal,
      score: item.score,
      tier: item.tier,
      explanation: kindProjection?.priority.explanation
        ?? (explanation
          ? Object.entries(explanation.signals).map(([name, s]) => ({
              label: name,
              value: s.value,
              reason: `${s.from}: ${s.raw}`,
            }))
          : undefined),
    },
    details: kindProjection?.details ?? {},
  };
}

export function project(input: ProjectInput): AgentHandoffV1 {
  const { item, explanation, session, catalog, timestamp } = input;
  const target = projectTarget({ item, explanation, catalog });

  const baseIntent = defaultIntent(item.kind);
  const mergedIntent: HandoffIntent = {
    outcome: input.intent?.outcome ?? baseIntent.outcome,
    constraints: input.intent?.constraints ?? baseIntent.constraints,
    verification: input.intent?.verification ?? baseIntent.verification,
  };

  return {
    schema: "triagekit.agent-handoff",
    version: 1,
    createdAt: timestamp ?? new Date().toISOString(),
    intent: mergedIntent,
    targets: [target],
    context: buildContext(session),
  };
}
