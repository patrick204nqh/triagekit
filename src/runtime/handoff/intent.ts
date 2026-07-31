import type { Kind } from "../dataset/item";
import type {
  HandoffIntent,
  HandoffMode,
} from "./types";

const INVESTIGATE_OUTCOMES: Partial<Record<Kind, string>> = {
  "dependency-vuln": "Investigate the selected dependency vulnerabilities",
  "code-scanning": "Investigate the selected code scanning findings",
  "change-request": "Investigate the selected change requests",
  "issue": "Investigate the selected issues",
};

const IMPLEMENT_OUTCOMES: Partial<Record<Kind, string>> = {
  "dependency-vuln":
    "Implement remediation for the selected dependency vulnerabilities",
  "code-scanning":
    "Implement remediation for the selected code scanning findings",
  "change-request":
    "Implement the requested changes for the selected change requests",
  "issue": "Implement the requested changes for the selected issues",
};

export const INVESTIGATE_BOUNDARY = Object.freeze([
  "Do not modify files.",
  "Do not create commits or pushes.",
  "Do not perform provider mutations or other external actions.",
]);

export const IMPLEMENT_BOUNDARY = Object.freeze([
  "Limit changes to the selected targets.",
  "Preserve unrelated behavior.",
  "Do not commit, push, merge, deploy, or mutate provider state unless the human instructions explicitly request it.",
]);

export function generatedIntentFor(
  kind: Kind,
  mode: HandoffMode,
): HandoffIntent {
  if (mode === "investigate") {
    return {
      outcome: INVESTIGATE_OUTCOMES[kind] ?? "Investigate the selected items",
      constraints: INVESTIGATE_BOUNDARY,
      verification: [
        "Report evidence, risks, and unanswered questions.",
        "Outline a concrete action plan.",
      ],
    };
  }
  return {
    outcome: IMPLEMENT_OUTCOMES[kind]
      ?? "Implement the requested changes for the selected items",
    constraints: IMPLEMENT_BOUNDARY,
    verification: [
      "Run proportionate verification and report the result.",
      "Report remaining risks and blockers.",
    ],
  };
}

// Transitional single-target helpers are removed in the final Handoff cutover.
export function defaultIntent(kind: Kind): HandoffIntent {
  return generatedIntentFor(kind, "investigate");
}

export function intentForKind(kind: Kind): HandoffIntent {
  return generatedIntentFor(kind, "investigate");
}
