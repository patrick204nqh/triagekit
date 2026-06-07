// test/ingest/github/code-scanning-source.test.ts
import { describe, it, expect } from "vitest";
import { toCodeScanningItem } from "../../../src/runtime/ingest/github/code-scanning-source";

const raw = {
  number: 7, state: "open",
  rule: { id: "js/sql-injection", name: "SQL injection", security_severity_level: "high" },
  tool: { name: "CodeQL" },
  most_recent_instance: { location: { path: "src/db.ts", start_line: 42 } },
  html_url: "https://github.com/acme/api/security/code-scanning/7",
};

describe("toCodeScanningItem", () => {
  it("maps a GitHub alert to the dataset shape", () => {
    const item = toCodeScanningItem("acme/api", raw);
    expect(item.id).toBe("github:acme/api:cs:7");
    expect(item.signal).toBe(70);
    expect(item.kind).toBe("code-scanning");
    expect(item.location).toBe("acme/api");
    const d = item.details;
    expect(d.ruleId).toBe("js/sql-injection");
    expect(d.securitySeverity).toBe("high");
    expect(d.tool).toBe("CodeQL");
    expect(d.location).toEqual({ path: "src/db.ts", line: 42 });
    expect(d.state).toBe("open");
    expect(d.permalink).toContain("/code-scanning/7");
  });
  it("falls back to low severity when GitHub omits it", () => {
    const d = toCodeScanningItem("acme/api", { ...raw, rule: { id: "x", name: "X" } }).details;
    expect(d.securitySeverity).toBe("low");
  });
});
