import { describe, expect, it } from "vitest";
import type { StoragePort } from "../../src/runtime/core/ports";
import { createFocusPolicyStore } from "../../src/runtime/focus/browser-store";

class MapStorage implements StoragePort {
  private readonly values = new Map<string, string>();

  get(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  set(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("focus policy browser store", () => {
  it("isolates policies by provider and recovers from corrupt storage", () => {
    const storage = new MapStorage();
    const store = createFocusPolicyStore(storage);
    store.set({
      provider: "github",
      repositoryOrder: ["acme-corp/core"],
      labels: { include: [], exclude: ["done"], enabled: true },
    });
    expect(store.get("gitlab").repositoryOrder).toEqual([]);
    storage.set("triagekit.focus.github", "{bad");
    expect(store.get("github").labels).toEqual({
      include: [],
      exclude: [],
      enabled: true,
    });
  });

  it("normalizes persisted repository and label values", () => {
    const storage = new MapStorage();
    const store = createFocusPolicyStore(storage);
    store.set({
      provider: "github",
      repositoryOrder: [" acme-corp/core ", "acme-corp/core", ""],
      labels: {
        include: [" security ", "security", ""],
        exclude: [" done ", "done"],
        enabled: false,
      },
    });
    expect(store.get("github")).toEqual({
      provider: "github",
      repositoryOrder: ["acme-corp/core"],
      labels: {
        include: ["security"],
        exclude: ["done"],
        enabled: false,
      },
    });
  });

  it("rejects unknown persisted fields", () => {
    const storage = new MapStorage();
    storage.set("triagekit.focus.github", JSON.stringify({
      repositoryOrder: ["acme-corp/core"],
      labels: { include: [], exclude: [], enabled: true },
      credential: "must-not-be-accepted",
    }));

    expect(createFocusPolicyStore(storage).get("github").repositoryOrder)
      .toEqual([]);
  });
});
