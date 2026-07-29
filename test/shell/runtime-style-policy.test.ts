import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const files = [
  "src/runtime/shell/repository-settings.ts",
  "src/runtime/shell/connection-status.ts",
];

describe("new shell components respect strict CSP", () => {
  it.each(files)(
    "%s uses classes and attributes instead of runtime styles",
    (file) => {
      const source = readFileSync(resolve(process.cwd(), file), "utf8");
      expect(source).not.toMatch(/\bstyle\s*=/);
      expect(source).not.toMatch(/\.style(?:\.|\[)/);
      expect(source).not.toMatch(/\bon[a-z]+\s*=/i);
    },
  );
});
