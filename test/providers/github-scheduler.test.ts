import { describe, expect, it } from "vitest";
import {
  createGithubRequestScheduler,
  type RequestPriority,
  type ScheduledRequest,
} from "../../src/runtime/providers/github/scheduler";

interface DeferredResponse {
  readonly path: string;
  resolve(response: Response): void;
}

const flush = async (): Promise<void> => {
  await new Promise((resolve) => globalThis.setTimeout(resolve, 0));
};

const schedulerFixture = (concurrency: number) => {
  const started: DeferredResponse[] = [];
  let active = 0;
  let maximumActive = 0;

  const fetchImpl: typeof fetch = async (input) => {
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    return new Promise<Response>((resolve) => {
      started.push({
        path: String(input),
        resolve(response) {
          active -= 1;
          resolve(response);
        },
      });
    });
  };

  const scheduler = createGithubRequestScheduler({
    fetch: fetchImpl,
    concurrency,
  });

  return {
    scheduler,
    active: () => active,
    maximumActive: () => maximumActive,
    startedPaths: () => started.map(({ path }) => path),
    resolve(index: number) {
      started[index].resolve(new Response("{}", { status: 200 }));
    },
  };
};

const readRequest = (
  pathOrUrl: string,
  priority: RequestPriority = "manual-refresh",
): ScheduledRequest => ({
  pathOrUrl,
  priority,
  retry: "safe-read",
});

const actionRequest = (pathOrUrl: string): ScheduledRequest => ({
  pathOrUrl,
  priority: "triage-action",
  retry: "never",
  init: { method: "POST" },
});

describe("GitHub request scheduler", () => {
  it("runs at most four requests", async () => {
    const fixture = schedulerFixture(4);
    const requests = Array.from({ length: 8 }, (_, index) =>
      fixture.scheduler.run(readRequest(`/resource/${index}`)));

    expect(fixture.active()).toBe(4);
    expect(fixture.maximumActive()).toBe(4);

    for (let index = 0; index < requests.length; index += 1) {
      fixture.resolve(index);
      await flush();
    }

    await expect(Promise.all(requests)).resolves.toHaveLength(8);
    expect(fixture.maximumActive()).toBe(4);
  });

  it("starts an action before queued background refresh", async () => {
    const fixture = schedulerFixture(1);
    const active = fixture.scheduler.run(readRequest("/active"));
    const cadence = fixture.scheduler.run(
      readRequest("/cadence", "cadence-refresh"),
    );
    const action = fixture.scheduler.run(actionRequest("/action"));

    fixture.resolve(0);
    await flush();
    expect(fixture.startedPaths()).toEqual(["/active", "/action"]);

    fixture.resolve(1);
    await flush();
    fixture.resolve(2);
    await expect(Promise.all([active, cadence, action])).resolves.toHaveLength(3);
  });

  it("removes an aborted request while it is queued", async () => {
    const fixture = schedulerFixture(1);
    const active = fixture.scheduler.run(readRequest("/active"));
    const abort = new AbortController();
    const queued = fixture.scheduler.run({
      ...readRequest("/queued"),
      signal: abort.signal,
    });
    const queuedRejection = expect(queued).rejects.toMatchObject({
      name: "AbortError",
    });

    abort.abort(new DOMException("Cancelled", "AbortError"));
    fixture.resolve(0);
    await flush();

    expect(fixture.startedPaths()).toEqual(["/active"]);
    await queuedRejection;
    await active;
  });
});
