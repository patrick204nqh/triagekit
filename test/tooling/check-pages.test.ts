import { describe, expect, it } from "vitest";
import { assertPagesInSync } from "../../scripts/check-pages.mjs";

describe("Pages artifact assertion", () => {
  it("accepts an unchanged artifact", () => {
    expect(() => assertPagesInSync(false)).not.toThrow();
  });

  it("rejects a stale artifact with corrective guidance", () => {
    expect(() => assertPagesInSync(true)).toThrow(
      "site/app/index.html is stale",
    );
  });
});
