import { describe, expect, it } from "vitest";
import { createGithubHttp } from "../../src/runtime/providers/github/http";
import {
  createGithubRequestScheduler,
  type ScheduledRequest,
} from "../../src/runtime/providers/github/scheduler";

describe("scheduled GitHub HTTP", () => {
  it("walks every Link next page sequentially through the scheduler", async () => {
    let inFlight = 0;
    let maximumInFlight = 0;
    const scheduled: ScheduledRequest[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      inFlight += 1;
      maximumInFlight = Math.max(maximumInFlight, inFlight);
      const page = Number(new URL(String(input)).searchParams.get("page") ?? "1");
      await Promise.resolve();
      inFlight -= 1;
      return new Response(JSON.stringify([{ page }]), {
        status: 200,
        headers: page < 3
          ? { link: `<https://api.github.com/issues?page=${page + 1}>; rel="next"` }
          : {},
      });
    };
    const underlying = createGithubRequestScheduler({
      fetch: fetchImpl,
      concurrency: 4,
    });
    const scheduler = {
      ...underlying,
      run(request: ScheduledRequest) {
        scheduled.push(request);
        return underlying.run(request);
      },
    };
    const http = createGithubHttp("secret-token", scheduler);

    const result = await http.paginate<{ page: number }>("/issues?page=1", {
      priority: "manual-refresh",
      retry: "safe-read",
    });

    expect(result).toEqual({
      rows: [{ page: 1 }, { page: 2 }, { page: 3 }],
      unchanged: false,
    });
    expect(maximumInFlight).toBe(1);
    expect(scheduled).toHaveLength(3);
    expect(scheduled.every(({ priority }) => priority === "manual-refresh"))
      .toBe(true);
    expect(new Headers(scheduled[0].init?.headers).get("authorization"))
      .toBe("Bearer secret-token");
  });
});
