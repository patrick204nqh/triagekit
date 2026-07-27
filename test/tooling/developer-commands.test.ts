import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const pkg = JSON.parse(
  readFileSync(resolve(root, "package.json"), "utf8"),
) as { scripts: Record<string, string> };
const ci = readFileSync(resolve(root, ".github/workflows/ci.yml"), "utf8");

describe("developer verification commands", () => {
  it("runs the complete ordinary check sequentially", () => {
    expect(pkg.scripts.check).toBe(
      "npm run typecheck && npm test && npm run lint:anon && npm run check:build && npm run check:pages",
    );
  });

  it("adds package validation only to the release check", () => {
    expect(pkg.scripts["check:release"]).toBe(
      "npm run check && npm run pack:smoke",
    );
  });

  it("delegates CI policy to the ordinary check", () => {
    expect(ci).toContain("run: npm run check");
    expect(ci).not.toContain("node dist-cli/cli/index.js build");
    expect(ci).not.toContain("git diff --quiet");
  });
});
