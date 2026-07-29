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

  it("keeps credentials out of provider-neutral job and view shapes", () => {
    const publicShapeFiles = [
      "core/core.ts",
      "core/ports.ts",
      "adapters/dom-view.ts",
    ];
    const publicShapes = publicShapeFiles
      .map((relative) => readFileSync(join(runtime, relative), "utf8"))
      .join("\n");

    expect(publicShapes).not.toContain("credential:");
  });

  it("does not retain the shallow connection and refresh owners", () => {
    const retired = [
      "core/orchestrator.ts",
      "insights/refresh.ts",
      "shell/cred-store.ts",
      "shell/scope-store.ts",
    ];

    for (const relative of retired) {
      expect(existsSync(join(runtime, relative)), relative).toBe(false);
    }
  });

  it("keeps GitHub transport details out of UI modules", () => {
    const forbiddenUiKnowledge = [
      "merge_method",
      "{ body:",
      "{ labels:",
      "{ assignees:",
      "ProviderCommand",
      "Authorization",
      "If-None-Match",
    ];
    const uiDirectories = [
      join(runtime, "layout"),
      join(runtime, "views"),
      join(runtime, "shell"),
      join(runtime, "adapters"),
    ];
    const source = uiDirectories
      .flatMap(filesUnder)
      .filter((path) => path.endsWith(".ts"))
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");

    for (const marker of forbiddenUiKnowledge) {
      expect(source, marker).not.toContain(marker);
    }
  });

  it("keeps delegation browser-local and provider-neutral", () => {
    const delegation = filesUnder(join(runtime, "delegation"))
      .filter((path) => path.endsWith(".ts"))
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");

    expect(delegation).not.toMatch(/\b(fetch|WebSocket|EventSource)\s*\(/);
    expect(delegation).not.toContain("credential:");
    expect(delegation).not.toContain("rawResponse:");
    expect(delegation).not.toContain("mcp");
  });
});
