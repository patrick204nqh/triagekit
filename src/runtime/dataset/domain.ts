import type { Kind } from "./item";

export type DomainId = "code-security" | "cloud-posture" | "edge-security" | "work-items";

export interface Domain {
  id: DomainId;
  label: string;
  purpose: string;     // the "high-value first" definition (shown in UI/empty states)
  kinds: Kind[];
}

const DOMAINS: Domain[] = [
  { id: "code-security", label: "Code & Dependency Security",
    purpose: "exploitable vulnerabilities — runtime scope and a fix available rank highest",
    kinds: ["dependency-vuln", "code-scanning", "secret-scanning"] },
  { id: "cloud-posture", label: "Cloud & Infra Posture",
    purpose: "misconfigurations — exposure × blast radius ranks highest",
    kinds: ["infra-misconfig"] },
  { id: "edge-security", label: "Edge & Network Security",
    purpose: "edge exposure — actively-hit WAF/DNS/TLS issues rank highest",
    kinds: ["edge-misconfig", "waf-finding"] },
  { id: "work-items", label: "Work Items",
    purpose: "tickets — priority × age × blocker status ranks highest",
    kinds: ["work-item"] },
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
