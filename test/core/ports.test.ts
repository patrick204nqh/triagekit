// test/core/ports.test.ts
import { describe, it, expect } from "vitest";
import type { ProviderPort, ViewPort, StoragePort, TimerPort } from "../../src/runtime/core/ports";
import type { ViewModel } from "../../src/runtime/core/view-model";

describe("core ports", () => {
  it("a fake provider satisfies ProviderPort", async () => {
    const fake: ProviderPort = {
      id: "fake",
      kinds: ["issue"],
      fetch: async () => ({ items: [], errors: [] }),
    };
    const r = await fake.fetch({}, "tok");
    expect(r.items).toEqual([]);
  });

  it("fakes satisfy view/storage/timer ports", () => {
    let rendered: ViewModel | null = null;
    const view: ViewPort = { render: (vm) => { rendered = vm; } };
    const mem = new Map<string, string>();
    const storage: StoragePort = { get: (k) => mem.get(k) ?? null, set: (k, v) => { mem.set(k, v); } };
    const timer: TimerPort = { every: () => () => {} };

    view.render({ scored: [], shown: [], errors: [], stats: { byProvider: {}, byKind: {} } });
    storage.set("k", "v");
    const cancel = timer.every(1000, () => {});
    cancel();

    expect(rendered).not.toBeNull();
    expect(storage.get("k")).toBe("v");
  });
});
