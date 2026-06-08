// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  registerTab, getTab, applicableTabs, _resetTabs, type TabModule,
} from "../../src/runtime/layout/navigation/tab-registry";
import type { Artifact } from "../../src/runtime/dataset/artifact";
import type { ScoredItem } from "../../src/runtime/layout/table/kind-renderer";

const art: Artifact = { id: "review", label: "Review", group: "work", kinds: ["change-request", "issue"] };
const tab = (id: string, applies: boolean, order = 0): TabModule => ({
  id, label: id, order, appliesTo: () => applies, render: (root) => { root.textContent = id; },
});

describe("tab-registry", () => {
  beforeEach(() => _resetTabs());

  it("registers and looks up a tab by id", () => {
    const t = tab("due-soon", true);
    registerTab(t);
    expect(getTab("due-soon")).toBe(t);
    expect(getTab("nope")).toBeUndefined();
  });

  it("applicableTabs returns only applicable tabs, sorted by order", () => {
    registerTab(tab("b", true, 2));
    registerTab(tab("a", true, 1));
    registerTab(tab("hidden", false, 0));
    expect(applicableTabs(art, [] as ScoredItem[]).map(t => t.id)).toEqual(["a", "b"]);
  });
});
