import { describe, it, expect } from "vitest";
import { listDomains, getDomain, domainOf, classOf } from "../../src/runtime/dataset/taxonomy";

describe("taxonomy", () => {
  it("declares a class on every domain", () => {
    for (const d of listDomains()) expect(d.class === "finding" || d.class === "work").toBe(true);
  });
  it("derives class from kind", () => {
    expect(classOf("dependency-vuln")).toBe("finding");
    expect(classOf("waf-finding")).toBe("finding");
    expect(classOf("change-request")).toBe("work");
  });
  it("keeps cloud-posture and edge-security as separate domains", () => {
    expect(domainOf("cloud-misconfig").id).toBe("cloud-posture");
    expect(domainOf("waf-finding").id).toBe("edge-security");
  });
  it("getDomain throws on unknown id", () => {
    // @ts-expect-error unknown id
    expect(() => getDomain("nope")).toThrow();
  });
});
