import type { Kind } from "./item";

export type Class = "finding" | "work";
export type DomainId =
  | "code-security" | "cloud-posture" | "edge-security" | "threat-detection"
  | "code-review" | "tracking" | "inbox" | "tasks";

export interface Domain {
  id: DomainId;
  class: Class;
  label: string;
  purpose: string;     // high-value-first definition (UI/empty states)
  kinds: Kind[];
}

const DOMAINS: Domain[] = [
  { id: "code-security", class: "finding", label: "Code & Dependency Security",
    purpose: "exploitable vulnerabilities - runtime scope and a fix available rank highest",
    kinds: ["dependency-vuln", "code-scanning", "secret-scanning"] },
  { id: "cloud-posture", class: "finding", label: "Cloud & Infra Posture",
    purpose: "misconfigurations - exposure x blast radius ranks highest",
    kinds: ["cloud-misconfig"] },
  { id: "edge-security", class: "finding", label: "Edge & Network Security",
    purpose: "edge exposure - actively-hit WAF/DNS/TLS issues rank highest",
    kinds: ["edge-misconfig", "waf-finding"] },
  { id: "threat-detection", class: "finding", label: "Threat Detection",
    purpose: "active adversary behavior - live/recent, high-confidence detections rank highest",
    kinds: ["runtime-threat"] },
  { id: "code-review", class: "work", label: "Code review",
    purpose: "change requests - priority x age x blocker status ranks highest",
    kinds: ["change-request"] },
  { id: "tracking", class: "work", label: "Tracking",
    purpose: "issues - priority x age x blocker status ranks highest",
    kinds: ["issue"] },
  { id: "inbox", class: "work", label: "Inbox",
    purpose: "threads to review - unread x participants x age ranks highest",
    kinds: ["email"] },
  { id: "tasks", class: "work", label: "Tasks",
    purpose: "actionables - priority x due date ranks highest",
    kinds: ["task"] },
];

const byId = new Map(DOMAINS.map(d => [d.id, d]));
const byKind = new Map<Kind, Domain>(DOMAINS.flatMap(d => d.kinds.map(k => [k, d] as const)));

export function listDomains(): Domain[] { return DOMAINS; }
export function getDomain(id: DomainId): Domain {
  const d = byId.get(id); if (!d) throw new Error(`unknown domain: ${id}`); return d;
}
export function domainOf(kind: Kind): Domain {
  const d = byKind.get(kind); if (!d) throw new Error(`kind has no domain: ${kind}`); return d;
}
export function classOf(kind: Kind): Class { return domainOf(kind).class; }
