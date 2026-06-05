import type { TriageConfigT } from "../../config/schema";
// Compiled = a non-empty scope bag baked at build time; generic = empty (set at runtime).
export function isCompiledConfig(config: Pick<TriageConfigT, "scope">): boolean {
  return !!config.scope && Object.keys(config.scope).length > 0;
}
