import { describe, expect, it, vi } from "vitest";
import {
  createActionCatalog,
} from "../../src/runtime/actions/catalog";
import type {
  ActionDefinition,
  TriageAction,
} from "../../src/runtime/actions/types";
import type { TriageItem } from "../../src/runtime/dataset/item";

const changeRequest = (): TriageItem => ({
  id: "github:acme-corp/web:42",
  provider: "github",
  providerRef: { repository: "acme-corp/web", number: 42 },
  kind: "change-request",
  title: "Ship semantic actions",
  location: "acme-corp/web",
  signal: 80,
  createdAt: "2026-07-29T00:00:00Z",
  url: "https://example.invalid/42",
  details: { state: "open" },
});

const definition = (
  intent: TriageAction["intent"],
  overrides: Partial<ActionDefinition> = {},
): ActionDefinition => ({
  intent,
  kinds: ["change-request"],
  variants: intent === "merge" ? ["merge", "squash", "rebase"] : undefined,
  available: () => true,
  validate: () => [],
  execute: vi.fn(async () => ({ status: "confirmed" })),
  revalidate: (_action, item) => ({
    targets: [item.location],
    kinds: [item.kind],
  }),
  ...overrides,
});

describe("semantic action catalog", () => {
  it("derives availability and variants from action definitions", () => {
    const catalog = createActionCatalog([definition("merge")]);

    expect(catalog.forItem(changeRequest())).toEqual([{
      intent: "merge",
      variants: ["merge", "squash", "rebase"],
    }]);
  });

  it("hides definitions that do not support or allow the item", () => {
    const catalog = createActionCatalog([
      definition("comment", { kinds: ["issue"] }),
      definition("close", { available: () => false }),
    ]);

    expect(catalog.forItem(changeRequest())).toEqual([]);
  });

  it("rejects duplicate provider intent definitions", () => {
    expect(() => createActionCatalog([
      definition("comment"),
      definition("comment"),
    ])).toThrow(/duplicate.*comment/i);
  });

  it("rejects definitions without a supported Kind", () => {
    expect(() => createActionCatalog([
      definition("comment", { kinds: [] }),
    ])).toThrow(/comment.*kind/i);
  });
});
