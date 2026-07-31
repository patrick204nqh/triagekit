import {
  checkSafeValue,
  jsonByteSize,
  MAX_SAFE_JSON_BYTES,
} from "../handoff/validator";
import type {
  DelegationBundleV1,
  DelegationValidationError,
  DelegationValidationResult,
} from "./types";

const INVESTIGATE_BOUNDARY = [
  "Do not modify files.",
  "Do not create commits or pushes.",
  "Do not perform provider mutations or other external actions.",
] as const;

export function validateHandoffBundle(
  bundle: DelegationBundleV1,
): DelegationValidationResult {
  const errors: DelegationValidationError[] = [];
  if (bundle.schema !== "triagekit.handoff-bundle") {
    errors.push({ field: "schema", message: "Unknown Handoff schema" });
  }
  if (bundle.version !== 1) {
    errors.push({ field: "version", message: "Unsupported version" });
  }
  if (
    bundle.instructions.mode !== "investigate"
    && bundle.instructions.mode !== "implement"
  ) {
    errors.push({
      field: "instructions.mode",
      message: "Handoff mode must be investigate or implement",
    });
  }
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
  if (bundle.packages.length < 1 || bundle.packages.length > 5) {
    errors.push({
      field: "packages",
      message: "Bundle must contain between one and five packages",
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

/** Transitional name removed in the final Handoff cutover. */
export const validateDelegationBundle = validateHandoffBundle;
