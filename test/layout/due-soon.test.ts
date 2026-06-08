// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { dueSoonRows, renderDueSoon } from "../../src/runtime/layout/due-soon";
import { deadlineOf } from "../../src/runtime/dataset/details";
import { getTab } from "../../src/runtime/layout/tab-registry";
import "../../src/runtime/layout/due-soon";   // side-effect: registers the tab
import type { ScoredItem } from "../../src/runtime/layout/triage-table";

function row(over: Partial<ScoredItem> & { details?: unknown }): ScoredItem {
  return {
    id: "x", source: "github", kind: "change-request", title: "t", location: "acme/web",
    signal: 0, createdAt: "2026-01-01T00:00:00Z", url: "", details: {}, score: 50, tier: "P2", ...over,
  } as ScoredItem;
}

describe("due-soon lens", () => {
  const rows: ScoredItem[] = [
    row({ id: "late", details: { dueAt: "2026-09-01T00:00:00Z" } }),
    row({ id: "soon", details: { dueAt: "2026-07-01T00:00:00Z" } }),
    row({ id: "none", details: {} }),
  ];

  it("deadlineOf reads details.dueAt or undefined", () => {
    expect(deadlineOf(rows[0])).toBe("2026-09-01T00:00:00Z");
    expect(deadlineOf(rows[2])).toBeUndefined();
  });

  it("dueSoonRows keeps only dated rows, ascending by deadline", () => {
    expect(dueSoonRows(rows).map(r => r.id)).toEqual(["soon", "late"]);
  });

  it("renders an empty state when nothing has a deadline", () => {
    const host = document.createElement("div");
    renderDueSoon(host, [row({ details: {} })]);
    expect(host.textContent).toContain("deadline");
  });

  it("registers a due-soon tab applicable only when a row has a deadline", () => {
    const t = getTab("due-soon")!;
    expect(t).toBeDefined();
    expect(t.label).toBe("Due soon");
    const art = { id: "review", label: "Review", group: "work", kinds: [] } as never;
    expect(t.appliesTo(art, rows)).toBe(true);
    expect(t.appliesTo(art, [row({ details: {} })])).toBe(false);
  });
});
