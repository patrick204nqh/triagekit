import { describe, expect, it, vi } from "vitest";
import {
  createGithubRequestScheduler,
  GithubOutcomeUnknownError,
  type ScheduledRequest,
} from "../../src/runtime/providers/github/scheduler";

const readRequest = (pathOrUrl: string): ScheduledRequest => ({
  pathOrUrl,
  priority: "manual-refresh",
  retry: "safe-read",
});

const actionRequest = (pathOrUrl: string): ScheduledRequest => ({
  pathOrUrl,
  priority: "triage-action",
  retry: "never",
  init: { method: "POST" },
});

const immediateTimer = (delays: number[]) =>
  (callback: () => void, delay: number): number => {
    delays.push(delay);
    callback();
    return delays.length;
  };

describe("GitHub request scheduler retries", () => {
  it.each([429, 502, 503, 504])(
    "retries safe reads for %s at most twice",
    async (status) => {
      const responses = [
        new Response(null, { status }),
        new Response(null, { status }),
        new Response(null, { status: 200 }),
      ];
      const fetchImpl = vi.fn(async () => responses.shift()!);
      const scheduler = createGithubRequestScheduler({
        fetch: fetchImpl,
        setTimeout: immediateTimer([]),
        clearTimeout: () => undefined,
        random: () => 0,
      });

      await expect(scheduler.run(readRequest("/issues")))
        .resolves.toMatchObject({ status: 200 });
      expect(fetchImpl).toHaveBeenCalledTimes(3);
    },
  );

  it("stops after the second safe-read retry", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 503 }));
    const scheduler = createGithubRequestScheduler({
      fetch: fetchImpl,
      setTimeout: immediateTimer([]),
      random: () => 0,
    });

    await expect(scheduler.run(readRequest("/issues")))
      .resolves.toMatchObject({ status: 503 });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("does not retry an action after an ambiguous network failure", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("network");
    });
    const scheduler = createGithubRequestScheduler({ fetch: fetchImpl });

    await expect(scheduler.run(actionRequest("/comments")))
      .rejects.toEqual(expect.objectContaining({
        kind: "outcome-unknown",
        cause: expect.any(TypeError),
      }));
    await expect(scheduler.run(actionRequest("/comments")))
      .rejects.toBeInstanceOf(GithubOutcomeUnknownError);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("uses deterministic exponential backoff with jitter", async () => {
    const responses = [
      new Response(null, { status: 503 }),
      new Response(null, { status: 200 }),
    ];
    const delays: number[] = [];
    const scheduler = createGithubRequestScheduler({
      fetch: vi.fn(async () => responses.shift()!),
      setTimeout: immediateTimer(delays),
      random: () => 0.5,
    });

    await scheduler.run(readRequest("/issues"));

    expect(delays).toEqual([300]);
  });

  it("queues every priority during a provider-directed pause", async () => {
    let currentTime = 100;
    let resume = (): void => undefined;
    const fetchImpl = vi.fn(async () => new Response(null, { status: 200 }));
    const statusChanges: unknown[] = [];
    const scheduler = createGithubRequestScheduler({
      fetch: fetchImpl,
      now: () => currentTime,
      setTimeout(callback) {
        resume = callback;
        return 1;
      },
      onStatusChange(status) {
        statusChanges.push(status);
      },
    });

    scheduler.pauseUntil(500, "rate limit");
    const manual = scheduler.run(readRequest("/manual"));
    const action = scheduler.run(actionRequest("/action"));

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(scheduler.status()).toEqual({
      paused: true,
      retryAt: 500,
      reason: "rate limit",
    });

    currentTime = 500;
    resume();
    await expect(Promise.all([manual, action])).resolves.toHaveLength(2);
    expect(fetchImpl.mock.calls.map(([path]) => path))
      .toEqual(["/action", "/manual"]);
    expect(statusChanges).toEqual([
      { paused: true, retryAt: 500, reason: "rate limit" },
      { paused: false },
    ]);
  });
});
