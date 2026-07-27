import type { AgentHandoffV1, ValidationResult } from "./types";

const SECRET_PATTERN = /token|secret|key|password|auth/i;
const MAX_STRING_LENGTH = 10_000;
const MAX_JSON_BYTES = 500_000;

function jsonByteSize(obj: unknown): number {
  return new TextEncoder().encode(JSON.stringify(obj)).length;
}

function checkValue(val: unknown, path: string, errors: { field: string; message: string }[]): void {
  if (typeof val === "string" && val.length > MAX_STRING_LENGTH) {
    errors.push({ field: path, message: `String exceeds ${MAX_STRING_LENGTH} characters` });
  } else if (Array.isArray(val)) {
    val.forEach((v, i) => checkValue(v, `${path}[${i}]`, errors));
  } else if (val !== null && typeof val === "object") {
    for (const [k, v] of Object.entries(val)) {
      if (SECRET_PATTERN.test(k)) {
        errors.push({ field: `${path}.${k}`, message: "Field name suggests a secret" });
      }
      checkValue(v, `${path}.${k}`, errors);
    }
  }
}

export function validate(handoff: AgentHandoffV1): ValidationResult {
  const errors: { field: string; message: string }[] = [];

  if (handoff.schema !== "triagekit.agent-handoff") {
    errors.push({ field: "schema", message: `Unknown schema "${handoff.schema}"` });
  }
  if (handoff.version !== 1) {
    errors.push({ field: "version", message: "Unsupported version" });
  }
  if (!handoff.targets || handoff.targets.length !== 1) {
    errors.push({ field: "targets", message: "Must have exactly one target" });
  }
  if (!handoff.intent.outcome || handoff.intent.outcome.trim().length === 0) {
    errors.push({ field: "intent.outcome", message: "Outcome must be non-empty" });
  }

  for (const [i, target] of (handoff.targets ?? []).entries()) {
    const prefix = `targets[${i}]`;
    if (!target.id) errors.push({ field: `${prefix}.id`, message: "Target id is required" });
    if (!target.url) errors.push({ field: `${prefix}.url`, message: "Target url is required" });
    if (!target.provider) errors.push({ field: `${prefix}.provider`, message: "Target provider is required" });
    if (!target.title) errors.push({ field: `${prefix}.title`, message: "Target title is required" });
    checkValue(target, prefix, errors);
  }

  const size = jsonByteSize(handoff);
  if (size > MAX_JSON_BYTES) {
    errors.push({ field: "(root)", message: `Handoff exceeds ${MAX_JSON_BYTES} bytes (${size})` });
  }

  return errors.length === 0
    ? { valid: true }
    : { valid: false, errors };
}
