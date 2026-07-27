import type { AgentHandoffV1, HandoffTargetV1, HandoffEvidenceV1 } from "./types";

function esc(text: string): string {
  return text.replace(/([\\`*_{}[\]()#+\-.!])/g, "\\$1");
}

function renderTarget(target: HandoffTargetV1): string {
  const lines: string[] = [`### ${esc(target.title)}`, ""];
  lines.push(`- **Kind:** ${target.kind}`);
  lines.push(`- **Provider:** ${target.provider}`);
  lines.push(`- **Location:** ${esc(target.location)}`);
  lines.push(`- **Tier:** ${target.priority.tier} (score: ${target.priority.score}, signal: ${target.priority.signal})`);
  if (target.url) lines.push(`- **URL:** ${target.url}`);
  lines.push(`- **Created:** ${target.createdAt}`);
  return lines.join("\n");
}

function renderEvidence(evidence: readonly HandoffEvidenceV1[]): string {
  return evidence.map(e =>
    `- **${esc(e.label)}:** ${esc(String(e.value))}${e.reason ? ` — ${esc(e.reason)}` : ""}`
  ).join("\n");
}

export function renderMarkdown(handoff: AgentHandoffV1): string {
  const parts: string[] = [];

  parts.push("# Agent handoff");
  parts.push("");
  parts.push(`*Created: ${handoff.createdAt}*`);
  parts.push("");

  parts.push("## Outcome");
  parts.push("");
  parts.push(handoff.intent.outcome);
  parts.push("");

  for (const target of handoff.targets) {
    parts.push("## Target");
    parts.push("");
    parts.push(renderTarget(target));
    parts.push("");

    if (target.priority.explanation && target.priority.explanation.length > 0) {
      parts.push("## Evidence");
      parts.push("");
      parts.push(renderEvidence(target.priority.explanation));
      parts.push("");
    }
  }

  if (handoff.intent.constraints.length > 0) {
    parts.push("## Constraints");
    parts.push("");
    for (const c of handoff.intent.constraints) {
      parts.push(`- ${esc(c)}`);
    }
    parts.push("");
  }

  if (handoff.intent.verification.length > 0) {
    parts.push("## Verification");
    parts.push("");
    for (const v of handoff.intent.verification) {
      parts.push(`- ${esc(v)}`);
    }
    parts.push("");
  }

  const s = handoff.context.session;
  parts.push("## Context");
  parts.push("");
  parts.push(`- **Kind:** ${s.kind}`);
  parts.push(`- **Provider:** ${s.provider}`);
  if (s.repository) parts.push(`- **Repository:** ${s.repository}`);
  parts.push("");

  return parts.join("\n");
}
