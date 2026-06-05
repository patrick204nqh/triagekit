import { describe, it, expect } from "vitest";
import { domainOf, listDomains } from "../../src/runtime/dataset/domain";

describe("domains", () => {
  it("maps a kind to its domain", () => {
    expect(domainOf("dependency-vuln").id).toBe("code-security");
    expect(domainOf("infra-misconfig").id).toBe("cloud-posture");
    expect(domainOf("waf-finding").id).toBe("edge-security");
    expect(domainOf("work-item").id).toBe("work-items");
  });
  it("registers all four domains", () => {
    expect(listDomains().map(d => d.id).sort())
      .toEqual(["cloud-posture", "code-security", "edge-security", "work-items"]);
  });
});
