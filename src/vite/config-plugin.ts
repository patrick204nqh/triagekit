import type { Plugin } from "vite";
import type { TriageConfigT } from "../config/schema.js";

const VIRTUAL_ID = "virtual:triagekit-config";

export function configPlugin(config: TriageConfigT): Plugin {
  return {
    name: "triagekit-config",
    resolveId(id) { return id === VIRTUAL_ID ? "\0" + VIRTUAL_ID : null; },
    load(id) {
      if (id !== "\0" + VIRTUAL_ID) return null;
      return `export const config = ${JSON.stringify(config)};`;
    },
  };
}
