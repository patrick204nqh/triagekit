import { describe, it, expect } from "vitest";
import { loadConfig } from "../../src/config/load";
import { writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("loadConfig", () => {
  it("parses and validates a yaml config file", () => {
    const dir = mkdtempSync(join(tmpdir(), "tk-"));
    const p = join(dir, "triage.config.yml");
    writeFileSync(p, "org: acme-corp\nsource: github\nrepos: [web-app]\nviews: [security-alerts]\n");
    const cfg = loadConfig(p);
    expect(cfg.repos).toEqual(["web-app"]);
  });

  it("throws a clear error when the file is missing", () => {
    expect(() => loadConfig("/no/such/file.yml")).toThrow(/config file not found/i);
  });
});
