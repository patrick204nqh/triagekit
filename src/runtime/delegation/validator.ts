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

export function validateDelegationBundle(
  bundle: DelegationBundleV1,
): DelegationValidationResult {
  const errors: DelegationValidationError[] = [];
  if (bundle.schema !== "triagekit.delegation-bundle") {
    errors.push({ field: "schema", message: "Unknown delegation schema" });
  }
  if (bundle.version !== 1) {
    errors.push({ field: "version", message: "Unsupported version" });
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
    if (!pkg.intent.outcome.trim()) {
      errors.push({
        ...(packageId ? { packageId } : {}),
        field: "intent.outcome",
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
