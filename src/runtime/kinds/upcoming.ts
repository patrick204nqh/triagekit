import type { UpcomingKindDeclaration } from "../catalog/types";

export const upcomingKinds: readonly UpcomingKindDeclaration[] = Object.freeze([
  {
    kind: "secret-scanning",
    domain: "code-security",
    label: "Secrets",
    status: "upcoming",
  },
  {
    kind: "cloud-misconfig",
    domain: "cloud-posture",
    label: "Cloud misconfig",
    status: "upcoming",
  },
  {
    kind: "edge-misconfig",
    domain: "edge-security",
    label: "Edge misconfig",
    status: "upcoming",
  },
  {
    kind: "waf-finding",
    domain: "edge-security",
    label: "WAF",
    status: "upcoming",
  },
  {
    kind: "runtime-threat",
    domain: "threat-detection",
    label: "Threats",
    status: "upcoming",
  },
  {
    kind: "email",
    domain: "inbox",
    label: "Inbox",
    status: "upcoming",
  },
  {
    kind: "task",
    domain: "tasks",
    label: "Tasks",
    status: "upcoming",
  },
]);
