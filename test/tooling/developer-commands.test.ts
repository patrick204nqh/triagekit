import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const pkg = JSON.parse(
  readFileSync(resolve(root, "package.json"), "utf8"),
) as {
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
};
const ci = readFileSync(resolve(root, ".github/workflows/ci.yml"), "utf8");
const release = readFileSync(
  resolve(root, ".github/workflows/release.yml"),
  "utf8",
);

describe("developer verification commands", () => {
  it("uses Node argument parsing for the single build command", () => {
    const cli = readFileSync(resolve(root, "src/cli/index.ts"), "utf8");
    expect(cli).toContain('from "node:util"');
    expect(cli).toContain("parseArgs(");
    expect(cli).not.toContain("new Command(");
    expect(pkg.dependencies.commander).toBeUndefined();
  });

  it("runs the complete ordinary check in parallel", () => {
    expect(pkg.scripts.check).toBe(
      "node scripts/run-parallel.mjs typecheck test lint:anon check:dist",
    );
  });

  it("adds package validation only to the release check", () => {
    expect(pkg.scripts["check:release"]).toBe(
      "node scripts/run-parallel.mjs typecheck test lint:anon check:dist && npm run pack:smoke",
    );
  });

  it("delegates CI policy to the ordinary check", () => {
    expect(ci).toContain("run: npm run check");
    expect(ci).not.toContain("node dist-cli/cli/index.js build");
    expect(ci).not.toContain("git diff --quiet");
  });

  it("delegates release validation to the release check", () => {
    expect(release).toContain("run: npm run check:release");
    expect(release).not.toContain("run: npm test");
    expect(release).not.toContain("run: npm run lint:anon");
    expect(release).not.toContain("run: npm run pack:smoke");
  });
});
