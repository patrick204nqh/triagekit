import { describe, expect, it } from "vitest";
import type {
  StoragePort,
  TimerPort,
  ViewPort,
} from "../../src/runtime/core/ports";
import type { ViewModel } from "../../src/runtime/core/view-model";

describe("core ports", () => {
  it("fakes satisfy view, storage, and timer ports", () => {
    let rendered: ViewModel | null = null;
    const view: ViewPort = {
      render: (vm) => { rendered = vm; },
    };
    const values = new Map<string, string>();
    const storage: StoragePort = {
      get: (key) => values.get(key) ?? null,
      set: (key, value) => { values.set(key, value); },
    };
    const timer: TimerPort = {
      every: () => () => {},
    };

    view.render({
      scored: [],
      shown: [],
      errors: [],
      stats: { byProvider: {}, byKind: {} },
    });
    storage.set("k", "v");
    timer.every(1_000, () => {})();

    expect(rendered).not.toBeNull();
    expect(storage.get("k")).toBe("v");
  });
});
