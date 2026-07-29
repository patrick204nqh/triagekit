// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { getRefreshInterval, setRefreshInterval, relativeSince, REFRESH_OPTIONS } from "../../src/runtime/shell/refresh";

describe("refresh preference", () => {
  beforeEach(() => localStorage.clear());

  it("defaults to off and only accepts known intervals", () => {
    expect(getRefreshInterval()).toBe("off");
    setRefreshInterval(300); expect(getRefreshInterval()).toBe(300);
    setRefreshInterval("off"); expect(getRefreshInterval()).toBe("off");
    localStorage.setItem("triagekit.refresh", "999");   // not an offered option
    expect(getRefreshInterval()).toBe("off");
  });

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
