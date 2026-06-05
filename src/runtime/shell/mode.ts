import type { TriageConfigT } from "../../config/schema";

// A "compiled" build bakes in org + repos at build time. A "generic" build leaves
// them empty so the user enters them at runtime (the publicly-shareable tool).
export function isCompiledConfig(config: Pick<TriageConfigT, "org" | "repos">): boolean {
  return !!config.org && config.repos.length > 0;
}
