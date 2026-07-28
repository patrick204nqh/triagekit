import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const runtime = join(root, "src/runtime");

const filesUnder = (directory: string): string[] =>
  readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });

describe("runtime architecture guardrails", () => {
  it("contains no mutable registration path", () => {
    const forbidden = [
      "registerSource(",
      "registerProvider(",
      "registerKindRenderer(",
      "registerFilterAxis(",
      "registerSortKey(",
      "registerChart(",
      "registerTab(",
      "registerView(",
      "registerFieldCatalog(",
    ];
    const source = filesUnder(runtime)
      .filter((path) => path.endsWith(".ts"))
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");

    for (const marker of forbidden) {
      expect(source, marker).not.toContain(marker);
    }
  });

  it("does not retain the retired Source and registry modules", () => {
    const retired = [
      "core/provider-registry.ts",
      "core/register-kinds.ts",
      "core/manifest.ts",
      "ingest/source.ts",
      "ingest/upcoming.ts",
      "providers/github.ts",
      "scoring/registry.ts",
      "scoring/default-model.ts",
      "layout/charts/generic.ts",
    ];

    for (const relative of retired) {
      expect(existsSync(join(runtime, relative)), relative).toBe(false);
    }
  });
});
