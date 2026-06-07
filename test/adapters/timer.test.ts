// test/adapters/timer.test.ts
import { describe, it, expect, vi } from "vitest";
import { createTimer } from "../../src/runtime/adapters/timer";

describe("timer adapter", () => {
  it("fires on interval and cancel stops it", () => {
    vi.useFakeTimers();
    const t = createTimer();
    let n = 0;
    const cancel = t.every(1000, () => { n++; });
    vi.advanceTimersByTime(3000);
    expect(n).toBe(3);
    cancel();
    vi.advanceTimersByTime(3000);
    expect(n).toBe(3);
    vi.useRealTimers();
  });
});
