import { describe, it, expect } from "vitest";
import { domainOf, listDomains } from "../../src/runtime/dataset/domain";

describe("domains", () => {
  it("maps a kind to its domain", () => {
    expect(domainOf("dependency-vuln").id).toBe("code-security");
    expect(domainOf("cloud-misconfig").id).toBe("cloud-posture");
    expect(domainOf("waf-finding").id).toBe("edge-security");
    expect(domainOf("issue").id).toBe("tracking");
    expect(domainOf("runtime-threat").id).toBe("threat-detection");
  });
  it("registers all eight domains", () => {
    expect(listDomains().map(d => d.id).sort())
      .toEqual(["cloud-posture", "code-review", "code-security", "edge-security", "inbox", "tasks", "threat-detection", "tracking"]);
  });
});
