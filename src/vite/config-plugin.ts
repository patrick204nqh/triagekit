import type { Plugin } from "vite";
import type { TriageConfigT } from "../config/schema.js";

const CONFIG_ID = "virtual:triagekit-config";
const HOOKS_ID = "virtual:triagekit-hooks";

export function configPlugin(config: TriageConfigT, hookPath?: string): Plugin {
  return {
    name: "triagekit-config",
    resolveId(id) {
      if (id === CONFIG_ID) return "\0" + CONFIG_ID;
      if (id === HOOKS_ID) return "\0" + HOOKS_ID;
      return null;
    },
    load(id) {
      if (id === "\0" + CONFIG_ID) {
        return `export const config = ${JSON.stringify(config)};`;
      }
      if (id === "\0" + HOOKS_ID) {
        // Re-export the user's hook module when configured, else a no-op.
        return hookPath
          ? `export * from ${JSON.stringify(hookPath)};`
          : `export const score = undefined;`;
      }
      return null;
    },
  };
}
