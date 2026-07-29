import type { HandoffTargetV1 } from "../handoff/types";
import type {
  DelegationBundleV1,
  WorkPackageV1,
} from "./types";

function esc(text: string): string {
  return text.replace(/([\\`*_{}[\]()#+\-.!])/g, "\\$1");
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
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

function renderPackageSection(pkg: WorkPackageV1): string {
  const lines = [
    `## Package ${pkg.order}: ${esc(pkg.repository)} · ${esc(pkg.kind)}`,
    "",
    `- **Package ID:** ${esc(pkg.id)}`,
    `- **Selection reason:** ${esc(pkg.selectionReason)}`,
    "",
    "### Outcome",
    "",
    esc(pkg.intent.outcome),
  ];
  if (pkg.intent.constraints.length) {
    lines.push("", "### Constraints", "");
    for (const constraint of pkg.intent.constraints) {
      lines.push(`- ${esc(constraint)}`);
    }
  }
  if (pkg.intent.verification.length) {
    lines.push("", "### Verification", "");
    for (const verification of pkg.intent.verification) {
      lines.push(`- ${esc(verification)}`);
    }
  }
  lines.push("", "### Targets", "");
  for (const target of pkg.targets) {
    lines.push(renderTarget(target), "");
  }
  return lines.join("\n").trimEnd();
}

function renderFocus(bundle: DelegationBundleV1): string[] {
  return [
    "## Focus summary",
    "",
    `- **Provider:** ${esc(bundle.focus.provider)}`,
    `- **Repository order:** ${bundle.focus.repositoryOrder.map(esc).join(" → ") || "none"}`,
    `- **Show if labelled:** ${bundle.focus.includeLabels.map(esc).join(", ") || "all"}`,
    `- **Hide if labelled:** ${bundle.focus.excludeLabels.map(esc).join(", ") || "none"}`,
  ];
}

export function renderBundleMarkdown(
  bundle: DelegationBundleV1,
): string {
  const lines = [
    "# Delegation bundle",
    "",
    `*Created: ${esc(bundle.createdAt)}*`,
    "",
    "Process packages in the listed repository order. Complete each package's verification before moving to the next.",
    "",
    ...renderFocus(bundle),
    "",
    "## Human instructions",
    "",
    "- This bundle came from an explicit session queue.",
    "- Do not infer work outside the selected targets.",
    "",
  ];
  for (const pkg of [...bundle.packages].sort((left, right) =>
    left.order - right.order)) {
    lines.push(renderPackageSection(pkg), "");
  }
  return lines.join("\n").trimEnd() + "\n";
}

export function renderPackageMarkdown(
  bundle: DelegationBundleV1,
  pkg: WorkPackageV1,
): string {
  return [
    "# Delegation package",
    "",
    `*Created: ${esc(bundle.createdAt)}*`,
    "",
    ...renderFocus(bundle),
    "",
    renderPackageSection(pkg),
    "",
  ].join("\n");
}
