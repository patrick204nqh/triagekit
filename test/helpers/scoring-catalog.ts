import { runtimeDefaults } from "../../src/runtime/catalog/defaults";
import { createRuntimeCatalog } from "../../src/runtime/catalog/runtime-catalog";
import type { RuntimeCatalog } from "../../src/runtime/catalog/types";
import { dependencyVulnKind } from "../../src/runtime/kinds/dependency-vuln";
import type { FieldDef } from "../../src/runtime/scoring/field-catalog";
import type { ScoreModel } from "../../src/runtime/scoring/score-model";

const defaultFields: readonly FieldDef[] = [
  {
    name: "severity",
    type: "enum",
    values: ["critical", "high", "medium", "low"],
  },
  { name: "cvss", type: "number", range: [0, 10] },
  { name: "fixAvailable", type: "bool" },
];

export function scoringCatalog(
  model: ScoreModel | undefined,
  fields: readonly FieldDef[] = defaultFields,
): RuntimeCatalog {
  return createRuntimeCatalog({
    kinds: [{
      ...dependencyVulnKind,
      fields,
      defaultModel: model,
    }],
    providers: [],
    defaults: runtimeDefaults,
  });
}
