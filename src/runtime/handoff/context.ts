import type { HandoffContextV1 } from "./types";
import type { SessionState } from "../session/types";

export function buildContext(session: SessionState): HandoffContextV1 {
  return {
    session: {
      kind: session.kind,
      provider: session.provider,
      repository: session.effectiveRepository || undefined,
    },
    relatedItems: [],
  };
}
