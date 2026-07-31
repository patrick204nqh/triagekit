import type { HandoffTargetV1 } from "./types";
import type {
  HandoffBundleV1,
  HandoffPackageV1,
} from "./types";

function esc(text: string): string {
  return text.replace(/([\\`*_{}[\]()#+!])/g, "\\$1");
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function modeLabel(bundle: HandoffBundleV1): string {
  return bundle.instructions.mode === "implement"
    ? "Implement"
    : "Investigate";
}

function renderAuthorization(bundle: HandoffBundleV1): string[] {
  return [
    `## Mode: ${modeLabel(bundle)}`,
    "",
    "### Authorization boundary",
    "",
    ...(bundle.instructions.generatedBoundary ?? []).map(
      (constraint) => `- ${esc(constraint)}`,
    ),
  ];
}

function renderTarget(target: HandoffTargetV1): string {
  const lines = [
    `### ${esc(target.title)}`,
    "",
    `- **ID:** ${esc(target.id)}`,
    `- **Kind:** ${esc(target.kind)}`,
    `- **Provider:** ${esc(target.provider)}`,
    `- **Repository:** ${esc(target.location)}`,
    `- **Priority:** ${target.priority.tier} (score: ${target.priority.score}, signal: ${target.priority.signal})`,
    `- **Created:** ${esc(target.createdAt)}`,
  ];
  if (target.url) lines.push(`- **URL:** ${target.url}`);
  if (target.note) {
    lines.push("", "#### Item note", "", esc(target.note));
  }
  if (target.priority.explanation?.length) {
    lines.push("", "#### Evidence", "");
    for (const evidence of target.priority.explanation) {
      lines.push(
        `- **${esc(evidence.label)}:** ${esc(String(evidence.value))}`
        + (evidence.reason ? ` — ${esc(evidence.reason)}` : ""),
      );
    }
  }
  if (Object.keys(target.details).length) {
    lines.push("", "#### Curated context", "");
    for (const line of JSON.stringify(target.details, null, 2).split("\n")) {
      lines.push(`    ${line}`);
    }
  }
  const freshness = record(target.details.freshness);
  if (typeof freshness.validatedAt === "string") {
    lines.push(
      "",
      `- **Freshness:** ${freshness.stale === true ? "stale" : "current"}; validated ${esc(freshness.validatedAt)}`,
    );
  }
  const truncation = record(target.details.truncation);
  if (
    typeof truncation.field === "string"
    && typeof truncation.originalLength === "number"
  ) {
    lines.push(
      `- **Truncation:** ${esc(truncation.field)} was bounded; original length: ${truncation.originalLength}`,
    );
  }
  return lines.join("\n");
}

function renderPackageSection(pkg: HandoffPackageV1): string {
  const intent = pkg.generatedIntent;
  const lines = [
    `## Package ${pkg.order}: ${esc(pkg.repository)} · ${esc(pkg.kind)}`,
    "",
    `- **Package ID:** ${esc(pkg.id)}`,
    `- **Selection reason:** ${esc(pkg.selectionReason)}`,
    "",
    "### Generated instruction",
    "",
    esc(intent.outcome),
  ];
  if (intent.constraints.length) {
    lines.push("", "#### Constraints", "");
    for (const constraint of intent.constraints) {
      lines.push(`- ${esc(constraint)}`);
    }
  }
  if (intent.verification.length) {
    lines.push("", "#### Verification", "");
    for (const verification of intent.verification) {
      lines.push(`- ${esc(verification)}`);
    }
  }
  lines.push("", "### Targets", "");
  for (const target of pkg.targets) {
    lines.push(renderTarget(target), "");
  }
  return lines.join("\n").trimEnd();
}

function renderFocus(bundle: HandoffBundleV1): string[] {
  return [
    "## Focus summary",
    "",
    `- **Provider:** ${esc(bundle.focus.provider)}`,
    `- **Repository order:** ${bundle.focus.repositoryOrder.map(esc).join(" → ") || "none"}`,
    `- **Show if labelled:** ${bundle.focus.includeLabels.map(esc).join(", ") || "all"}`,
    `- **Hide if labelled:** ${bundle.focus.excludeLabels.map(esc).join(", ") || "none"}`,
  ];
}

function renderMissionNote(bundle: HandoffBundleV1): string[] {
  return bundle.instructions.missionNote
    ? ["## Mission note", "", esc(bundle.instructions.missionNote), ""]
    : [];
}

export function renderHandoffBundleMarkdown(
  bundle: HandoffBundleV1,
): string {
  const lines = [
    "# Handoff bundle",
    "",
    `*Created: ${esc(bundle.createdAt)}*`,
    "",
    ...renderAuthorization(bundle),
    "",
    ...renderMissionNote(bundle),
    ...renderFocus(bundle),
    "",
    "Process packages in the listed repository order. Do not infer work outside the selected targets.",
    "",
  ];
  for (const pkg of [...bundle.packages].sort((left, right) =>
    left.order - right.order)) {
    lines.push(renderPackageSection(pkg), "");
  }
  return lines.join("\n").trimEnd() + "\n";
}

export function renderHandoffPackageMarkdown(
  bundle: HandoffBundleV1,
  pkg: HandoffPackageV1,
): string {
  return [
    "# Handoff package",
    "",
    `*Created: ${esc(bundle.createdAt)}*`,
    "",
    ...renderAuthorization(bundle),
    "",
    ...renderMissionNote(bundle),
    ...renderFocus(bundle),
    "",
    renderPackageSection(pkg),
    "",
  ].join("\n");
}
