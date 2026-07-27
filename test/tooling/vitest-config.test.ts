import { configDefaults } from "vitest/config";
import { describe, expect, it } from "vitest";
import { testExclude } from "../../vitest.config";

describe("Vitest discovery", () => {
  it("preserves default excludes", () => {
    for (const pattern of configDefaults.exclude) {
      expect(testExclude).toContain(pattern);
    }
  });

  it("excludes repository-local linked worktrees", () => {
    expect(testExclude).toContain("**/.worktrees/**");
  });
});
