import type { AgentHandoffV1, ValidationResult } from "./types";

const SECRET_PATTERN =
  /token|secret|password|credential|authorization|auth(?!or)|apiKey|privateKey|accessKey|(^|[_-])key($|[_-])/i;
export const MAX_SAFE_STRING_LENGTH = 10_000;
export const MAX_SAFE_JSON_BYTES = 500_000;

export function jsonByteSize(obj: unknown): number {
  return new TextEncoder().encode(JSON.stringify(obj)).length;
}

export function checkSafeValue(
  val: unknown,
  path: string,
  errors: { field: string; message: string }[],
): void {
  if (typeof val === "string" && val.length > MAX_SAFE_STRING_LENGTH) {
    errors.push({ field: path, message: `String exceeds ${MAX_SAFE_STRING_LENGTH} characters` });
  } else if (Array.isArray(val)) {
    val.forEach((v, i) => checkSafeValue(v, `${path}[${i}]`, errors));
  } else if (val !== null && typeof val === "object") {
    for (const [k, v] of Object.entries(val)) {
      if (SECRET_PATTERN.test(k)) {
        errors.push({ field: `${path}.${k}`, message: "Field name suggests a secret" });
      }
      checkSafeValue(v, `${path}.${k}`, errors);
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
    checkSafeValue(target, prefix, errors);
  }

  const size = jsonByteSize(handoff);
  if (size > MAX_SAFE_JSON_BYTES) {
    errors.push({ field: "(root)", message: `Handoff exceeds ${MAX_SAFE_JSON_BYTES} bytes (${size})` });
  }

  return errors.length === 0
    ? { valid: true }
    : { valid: false, errors };
}
