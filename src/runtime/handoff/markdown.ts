import type { HandoffTargetV1 } from "./types";
import type {
  HandoffBundleV1,
  HandoffPackageV1,
} from "./types";

function escMd(text: string): string {
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
      (constraint) => `- ${escMd(constraint)}`,
    ),
  ];
}

function renderTarget(target: HandoffTargetV1): string {
  const lines = [
    `### ${escMd(target.title)}`,
    "",
    `- **ID:** ${escMd(target.id)}`,
    `- **Kind:** ${escMd(target.kind)}`,
    `- **Provider:** ${escMd(target.provider)}`,
    `- **Repository:** ${escMd(target.location)}`,
    `- **Priority:** ${target.priority.tier} (score: ${target.priority.score}, signal: ${target.priority.signal})`,
    `- **Created:** ${escMd(target.createdAt)}`,
  ];
  if (target.url) lines.push(`- **URL:** ${target.url}`);
  if (target.note) {
    lines.push("", "#### Item note", "", escMd(target.note));
  }
  if (target.priority.explanation?.length) {
    lines.push("", "#### Evidence", "");
    for (const evidence of target.priority.explanation) {
      lines.push(
        `- **${escMd(evidence.label)}:** ${escMd(String(evidence.value))}`
        + (evidence.reason ? ` — ${escMd(evidence.reason)}` : ""),
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
      `- **Freshness:** ${freshness.stale === true ? "stale" : "current"}; validated ${escMd(freshness.validatedAt)}`,
    );
  }
  const truncation = record(target.details.truncation);
  if (
    typeof truncation.field === "string"
    && typeof truncation.originalLength === "number"
  ) {
    lines.push(
      `- **Truncation:** ${escMd(truncation.field)} was bounded; original length: ${truncation.originalLength}`,
    );
  }
  return lines.join("\n");
}

function renderPackageSection(pkg: HandoffPackageV1): string {
  const intent = pkg.generatedIntent;
  const lines = [
    `## Package ${pkg.order}: ${escMd(pkg.repository)} · ${escMd(pkg.kind)}`,
    "",
    `- **Package ID:** ${escMd(pkg.id)}`,
    `- **Selection reason:** ${escMd(pkg.selectionReason)}`,
    "",
    "### Generated instruction",
    "",
    escMd(intent.outcome),
  ];
  if (intent.constraints.length) {
    lines.push("", "#### Constraints", "");
    for (const constraint of intent.constraints) {
      lines.push(`- ${escMd(constraint)}`);
    }
  }
  if (intent.verification.length) {
    lines.push("", "#### Verification", "");
    for (const verification of intent.verification) {
      lines.push(`- ${escMd(verification)}`);
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
    `- **Provider:** ${escMd(bundle.focus.provider)}`,
    `- **Repository order:** ${bundle.focus.repositoryOrder.map(escMd).join(" → ") || "none"}`,
    `- **Show if labelled:** ${bundle.focus.includeLabels.map(escMd).join(", ") || "all"}`,
    `- **Hide if labelled:** ${bundle.focus.excludeLabels.map(escMd).join(", ") || "none"}`,
  ];
}

function renderMissionNote(bundle: HandoffBundleV1): string[] {
  return bundle.instructions.missionNote
    ? ["## Mission note", "", escMd(bundle.instructions.missionNote), ""]
    : [];
}

export function renderHandoffBundleMarkdown(
  bundle: HandoffBundleV1,
): string {
  const lines = [
    "# Handoff bundle",
    "",
    `*Created: ${escMd(bundle.createdAt)}*`,
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
    `*Created: ${escMd(bundle.createdAt)}*`,
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
