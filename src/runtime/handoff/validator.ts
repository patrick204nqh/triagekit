import { z } from "zod";
import type {
  HandoffBundleV1,
  HandoffValueV1,
  HandoffValidationError,
  HandoffValidationResult,
} from "./types";

const kindSchema = z.enum([
  "dependency-vuln",
  "code-scanning",
  "secret-scanning",
  "cloud-misconfig",
  "edge-misconfig",
  "waf-finding",
  "runtime-threat",
  "change-request",
  "issue",
  "email",
  "task",
]);
const scalarSchema = z.union([z.string(), z.number(), z.boolean()]);
const valueSchema: z.ZodType<HandoffValueV1> = z.lazy(() => z.union([
  ...scalarSchema.options,
  z.null(),
  z.array(valueSchema),
  z.record(z.string(), valueSchema),
]));
const intentSchema = z.strictObject({
  outcome: z.string(),
  constraints: z.array(z.string()),
  verification: z.array(z.string()),
});
const targetSchema = z.strictObject({
  id: z.string(),
  kind: kindSchema,
  provider: z.string(),
  providerReference: z.record(z.string(), scalarSchema),
  title: z.string(),
  location: z.string(),
  url: z.string(),
  createdAt: z.string(),
  priority: z.strictObject({
    signal: z.number(),
    score: z.number(),
    tier: z.enum(["P0", "P1", "P2", "P3"]),
    explanation: z.array(z.strictObject({
      label: z.string(),
      value: scalarSchema,
      reason: z.string().optional(),
    })).optional(),
  }),
  note: z.string().optional(),
  details: z.record(z.string(), valueSchema),
});
const packageSchema = z.strictObject({
  id: z.string(),
  order: z.number(),
  repository: z.string(),
  kind: kindSchema,
  generatedIntent: intentSchema,
  targets: z.array(targetSchema),
  selectionReason: z.string(),
});
const bundleSchema = z.strictObject({
  schema: z.literal("triagekit.handoff-bundle"),
  version: z.literal(1),
  createdAt: z.string(),
  focus: z.strictObject({
    provider: z.string(),
    repositoryOrder: z.array(z.string()),
    includeLabels: z.array(z.string()),
    excludeLabels: z.array(z.string()),
  }),
  instructions: z.strictObject({
    mode: z.enum(["investigate", "implement"]),
    missionNote: z.string().optional(),
    generatedBoundary: z.array(z.string()),
    processPackagesInOrder: z.literal(true),
    generatedFrom: z.literal("explicit-session-queue"),
  }),
  packages: z.array(packageSchema).min(1).max(5),
});

const SECRET_PATTERN =
  /token|secret|password|credential|authorization|auth(?!or)|apiKey|privateKey|accessKey|(^|[_-])key($|[_-])/i;
export const MAX_SAFE_STRING_LENGTH = 10_000;
export const MAX_SAFE_JSON_BYTES = 500_000;

export function jsonByteSize(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

export function checkSafeValue(
  value: unknown,
  path: string,
  errors: { field: string; message: string }[],
): void {
  if (typeof value === "string" && value.length > MAX_SAFE_STRING_LENGTH) {
    errors.push({
      field: path,
      message: `String exceeds ${MAX_SAFE_STRING_LENGTH} characters`,
    });
  } else if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      checkSafeValue(entry, `${path}[${index}]`, errors),
    );
  } else if (value !== null && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      if (SECRET_PATTERN.test(key)) {
        errors.push({
          field: `${path}.${key}`,
          message: "Sensitive field names are not allowed",
        });
      }
      checkSafeValue(entry, `${path}.${key}`, errors);
    }
  }
}

const INVESTIGATE_BOUNDARY = [
  "Do not modify files.",
  "Do not create commits or pushes.",
  "Do not perform provider mutations or other external actions.",
] as const;

export function validateHandoffBundle(
  candidate: unknown,
): HandoffValidationResult {
  const parsed = bundleSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      valid: false,
      errors: parsed.error.issues.map((issue) => ({
        field: issue.path.length ? issue.path.join(".") : "(root)",
        message: issue.message,
      })),
    };
  }
  const bundle: HandoffBundleV1 = parsed.data;
  const errors: HandoffValidationError[] = [];
  if (
    bundle.instructions.mode === "investigate"
    && !INVESTIGATE_BOUNDARY.every((constraint) =>
      bundle.instructions.generatedBoundary?.includes(constraint))
  ) {
    errors.push({
      field: "instructions.generatedBoundary",
      message: "Investigate mode requires the complete no-change boundary",
    });
  }
  const packageIds = new Set<string>();
  const orders = new Set<number>();
  let totalTargets = 0;
  bundle.packages.forEach((pkg, packageIndex) => {
    const packageId = pkg.id || undefined;
    if (!pkg.id || packageIds.has(pkg.id)) {
      errors.push({
        ...(packageId ? { packageId } : {}),
        field: "id",
        message: pkg.id ? "Package id must be unique" : "Package id is required",
      });
    }
    packageIds.add(pkg.id);
    if (
      orders.has(pkg.order)
      || pkg.order !== packageIndex + 1
    ) {
      errors.push({
        ...(packageId ? { packageId } : {}),
        field: "order",
        message: "Package order must be unique and deterministic",
      });
    }
    orders.add(pkg.order);
    if (pkg.targets.length < 1 || pkg.targets.length > 10) {
      errors.push({
        ...(packageId ? { packageId } : {}),
        field: "targets",
        message: "Package must contain between one and ten targets",
      });
    }
    totalTargets += pkg.targets.length;
    if (!pkg.generatedIntent.outcome.trim()) {
      errors.push({
        ...(packageId ? { packageId } : {}),
        field: "generatedIntent.outcome",
        message: "Outcome must be non-empty",
      });
    }
    pkg.targets.forEach((target, targetIndex) => {
      if (target.location !== pkg.repository) {
        errors.push({
          ...(packageId ? { packageId } : {}),
          field: `targets[${targetIndex}].location`,
          message: "Target repository must match its package",
        });
      }
      if (target.kind !== pkg.kind) {
        errors.push({
          ...(packageId ? { packageId } : {}),
          field: `targets[${targetIndex}].kind`,
          message: "Target Kind must match its package",
        });
      }
      if (!target.id || !target.url || !target.title || !target.provider) {
        errors.push({
          ...(packageId ? { packageId } : {}),
          field: `targets[${targetIndex}]`,
          message: "Target identity, title, provider, and URL are required",
        });
      }
    });
    const unsafe: { field: string; message: string }[] = [];
    checkSafeValue(pkg, "package", unsafe);
    errors.push(...unsafe.map((error) => ({
      ...(packageId ? { packageId } : {}),
      ...error,
    })));
  });
  if (totalTargets > 50) {
    errors.push({
      field: "packages.targets",
      message: "Bundle must contain no more than fifty targets",
    });
  }
  const size = jsonByteSize(bundle);
  if (size > MAX_SAFE_JSON_BYTES) {
    errors.push({
      field: "(root)",
      message: `Bundle exceeds ${MAX_SAFE_JSON_BYTES} bytes (${size})`,
    });
  }
  return errors.length ? { valid: false, errors } : { valid: true };
}
