// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { relativeSince, REFRESH_OPTIONS } from "../../src/runtime/shell/refresh";

describe("refresh preference", () => {
  it("offers Off / 5m / 10m / 15m", () => {
    expect(REFRESH_OPTIONS.map(o => o.value)).toEqual(["off", 300, 600, 900]);
  });

  it("formats a relative stamp", () => {
    const now = 1_000_000_000_000;
    expect(relativeSince(now, now)).toBe("just now");
    expect(relativeSince(now - 45_000, now)).toBe("45s ago");
    expect(relativeSince(now - 3 * 60_000, now)).toBe("3m ago");
    expect(relativeSince(now - 2 * 3_600_000, now)).toBe("2h ago");
  });
});
