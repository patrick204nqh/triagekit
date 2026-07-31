import { runtimeDefaults } from "../../src/runtime/catalog/defaults";
import { createRuntimeCatalog } from "../../src/runtime/catalog/runtime-catalog";
import type {
  KindDeclaration,
  ProviderDeclaration,
} from "../../src/runtime/catalog/types";
import type { Kind } from "../../src/runtime/dataset/item";
import type { DomainId } from "../../src/runtime/dataset/taxonomy";

const kind = (
  id: Kind,
  domain: DomainId,
  label: string,
): KindDeclaration => ({
  kind: id,
  domain,
  label,
  status: "ready",
  fields: [],
  builtInScorer: (item) => item.signal,
  renderer: { kind: id },
  filters: [],
  sorts: [],
  charts: [],
  views: [],
});

const provider = (
  id: string,
  kinds: readonly Kind[],
): ProviderDeclaration => ({
  id,
  label: id,
  status: "ready",
  kinds,
  connection: {
    setupHint: "Test credential",
    scopeFields: [],
  },
  capabilities: {
    discoverScope: false,
    enrich: [],
    actions: {},
  },
});

export const testCatalog = () => createRuntimeCatalog({
  kinds: [
    kind("issue", "tracking", "Issues"),
    kind("code-scanning", "code-security", "Code scanning"),
    {
      kind: "cloud-misconfig",
      domain: "cloud-posture",
      label: "Cloud misconfig",
      status: "upcoming",
    },
  ],
  providers: [
    provider("github", ["issue", "code-scanning"]),
    provider("gitlab", ["issue"]),
    provider("provider-without-current-kind", ["code-scanning"]),
    {
      id: "aws",
      label: "AWS",
      status: "upcoming",
      kinds: ["cloud-misconfig"],
      connection: {
        setupHint: "AWS support is on roadmap.",
        scopeFields: [],
      },
      capabilities: {
        discoverScope: false,
        enrich: [],
        actions: {},
      },
    },
  ],
  defaults: runtimeDefaults,
});
