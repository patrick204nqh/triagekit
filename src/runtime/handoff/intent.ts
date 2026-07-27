import type { HandoffIntent } from "./types";
import type { Kind } from "../dataset/item";

const DEFAULTS: Record<string, string> = {
  "dependency-vuln": "Review and remediate the vulnerable dependency",
  "code-scanning": "Review and address the code scanning alert",
  "change-request": "Review and merge the pull request",
  "issue": "Triage and respond to the issue",
};

export function defaultIntent(kind: Kind): HandoffIntent {
  return {
    outcome: DEFAULTS[kind] ?? "Review this item",
    constraints: [],
    verification: [],
  };
}
