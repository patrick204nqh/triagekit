import { describe, expect, it } from "vitest";
import { codeScanningKind } from "../../src/runtime/kinds/code-scanning";

describe("code-scanning Kind declaration", () => {
  it("owns its scorer and filtering behavior", () => {
    expect(typeof codeScanningKind.builtInScorer).toBe("function");
    expect(codeScanningKind.filters.map((axis) => axis.id)).toEqual(
      expect.arrayContaining(["cs-severity", "cs-tool", "cs-state"]),
    );
  });
});
