import { describe, it, expect } from "vitest";
import {
  registerFieldCatalog, fieldsFor, type FieldDef,
} from "../../src/runtime/scoring/field-catalog";

describe("field-catalog registry", () => {
  it("returns base item fields for any kind, even unregistered", () => {
    const names = fieldsFor("runtime-threat").map(f => f.name);
    expect(names).toContain("signal");
    expect(names).toContain("createdAt");
  });

  it("merges base fields with registered kind fields", () => {
    const fields: FieldDef[] = [{ name: "cvss", type: "number", range: [0, 10] }];
    registerFieldCatalog("code-scanning", fields);
    const got = fieldsFor("code-scanning");
    expect(got.map(f => f.name)).toEqual(expect.arrayContaining(["signal", "createdAt", "cvss"]));
    expect(got.find(f => f.name === "cvss")!.type).toBe("number");
  });

  it("base fields have the expected types", () => {
    const base = fieldsFor("runtime-threat");
    expect(base.find(f => f.name === "signal")!.type).toBe("number");
    expect(base.find(f => f.name === "createdAt")!.type).toBe("date");
  });
});
