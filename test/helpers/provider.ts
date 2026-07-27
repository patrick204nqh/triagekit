import type {
  ProviderDeclaration,
  ScopeField,
} from "../../src/runtime/catalog/types";

export function provider(
  overrides: Partial<ProviderDeclaration> & {
    scopeFields?: readonly ScopeField[];
  } = {},
): ProviderDeclaration {
  const { scopeFields = [], ...rest } = overrides;
  return {
    id: "github",
    label: "GitHub",
    status: "ready",
    kinds: ["dependency-vuln"],
    connection: {
      setupHint: "Fine-grained token",
      scopeFields,
    },
    capabilities: {
      discoverScope: false,
      enrich: [],
      actions: {},
    },
    ...rest,
  };
}
