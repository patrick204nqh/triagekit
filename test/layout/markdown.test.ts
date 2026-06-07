// @vitest-environment jsdom
// test/layout/markdown.test.ts
import { describe, it, expect } from "vitest";
import { renderMarkdown } from "../../src/runtime/layout/markdown";

describe("renderMarkdown", () => {
  it("renders GFM: headings, lists, code, tables", () => {
    const html = renderMarkdown("# Hi\n\n- a\n- b\n\n`code`\n\n| x | y |\n|---|---|\n| 1 | 2 |");
    expect(html).toContain("<h1");
    expect(html).toContain("<li");
    expect(html).toContain("<code");
    expect(html).toContain("<table");
  });
  it("keeps images (full GFM allows them)", () => {
    expect(renderMarkdown("![alt](https://x.githubusercontent.com/a.png)")).toContain("<img");
  });
  it("strips script and inline event handlers", () => {
    const html = renderMarkdown("<script>alert(1)</script><img src=x onerror=alert(2)>");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("onerror");
  });
  it("strips javascript: links", () => {
    expect(renderMarkdown("[x](javascript:alert(1))")).not.toContain("javascript:");
  });
});
