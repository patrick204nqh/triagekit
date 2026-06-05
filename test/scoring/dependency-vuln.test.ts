import { describe, it, expect } from "vitest";
import { dependencyVulnScore } from "../../src/runtime/scoring/dependency-vuln";
import { tierOf } from "../../src/runtime/scoring/tier";
import type { TriageItem } from "../../src/runtime/dataset/item";
import type { DependencyVulnDetails } from "../../src/runtime/dataset/kinds/dependency-vuln";

const item = (d: Partial<DependencyVulnDetails>): TriageItem<DependencyVulnDetails> => ({
  id: "github:web-app:1", source: "github", kind: "dependency-vuln",
  title: "lodash", location: "web-app", signal: 0, createdAt: new Date().toISOString(), url: "",
  details: { package: "lodash", severity: "critical", cvss: 9.8, scope: "runtime", fixAvailable: true, fixVersion: "1.0.0", ...d },
});
describe("dependencyVulnScore", () => {
  it("scores critical+fix+runtime P0", () => {
    const s = dependencyVulnScore(item({})); expect(s).toBeGreaterThanOrEqual(130); expect(tierOf(s)).toBe("P0");
  });
  it("penalizes dev scope", () => {
    expect(dependencyVulnScore(item({ scope: "development" }))).toBeLessThan(dependencyVulnScore(item({})));
  });
});
