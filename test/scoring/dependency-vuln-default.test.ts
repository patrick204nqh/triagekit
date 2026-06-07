import { describe, it, expect } from "vitest";
import { registerKinds } from "../../src/runtime/core/register-kinds";
import { dependencyVulnKind } from "../../src/runtime/kinds/dependency-vuln";
registerKinds([dependencyVulnKind]);   // registers scorer + catalog + default model
import { defaultModelFor } from "../../src/runtime/scoring/default-model";
import { validateModel } from "../../src/runtime/scoring/score-model";
import { fieldsFor } from "../../src/runtime/scoring/field-catalog";
import { DEPENDENCY_VULN } from "../../src/runtime/dataset/kinds/dependency-vuln";

describe("dependency-vuln default model", () => {
  it("is registered", () => {
    expect(defaultModelFor(DEPENDENCY_VULN)).not.toBeNull();
  });
  it("validates cleanly against its own field catalog", () => {
    const m = defaultModelFor(DEPENDENCY_VULN)!;
    expect(validateModel(m, fieldsFor(DEPENDENCY_VULN))).toEqual([]);
  });
});
