import { describe, expect, it, vi } from "vitest";
import type { TriageAction } from "../../src/runtime/actions/types";
import type { TriageItem } from "../../src/runtime/dataset/item";
import {
  createGithubActionDefinitions,
} from "../../src/runtime/providers/github/actions";
import { createGithubHttp } from "../../src/runtime/providers/github/http";
import {
  createGithubRequestScheduler,
  type ScheduledRequest,
} from "../../src/runtime/providers/github/scheduler";

const changeRequest = (): TriageItem => ({
  id: "github:acme-corp/web:42",
  provider: "github",
  providerRef: { repository: "acme-corp/web", number: 42 },
  kind: "change-request",
  title: "Ship it",
  location: "acme-corp/web",
  signal: 80,
  createdAt: "2026-07-29T00:00:00Z",
  url: "https://example.invalid/42",
  details: { state: "open" },
});

describe("GitHub semantic Triage Actions", () => {
  it("translates semantic squash merge inside the GitHub adapter", async () => {
    const scheduled: ScheduledRequest[] = [];
    const underlying = createGithubRequestScheduler({
      fetch: vi.fn(async () => new Response("{}", { status: 200 })),
    });
    const scheduler = {
      ...underlying,
      run(request: ScheduledRequest) {
        scheduled.push(request);
        return underlying.run(request);
      },
    };
    const definitions = createGithubActionDefinitions(
      createGithubHttp("token", scheduler),
    );
    const merge = definitions.find(({ intent }) => intent === "merge")!;
    const action: TriageAction = {
      intent: "merge",
      itemId: changeRequest().id,
      variant: "squash",
    };

    await expect(merge.execute(
      action,
      changeRequest(),
      new AbortController().signal,
    )).resolves.toMatchObject({ status: "confirmed" });

    expect(scheduled).toHaveLength(1);
    expect(scheduled[0]).toMatchObject({
      pathOrUrl: "https://api.github.com/repos/acme-corp/web/pulls/42/merge",
      priority: "triage-action",
      retry: "never",
      init: { method: "PUT" },
    });
    expect(JSON.parse(String(scheduled[0].init?.body)))
      .toEqual({ merge_method: "squash" });
  });

  it("returns outcome-unknown without retrying an ambiguous action", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("connection dropped");
    });
    const definitions = createGithubActionDefinitions(createGithubHttp(
      "token",
      createGithubRequestScheduler({ fetch: fetchImpl }),
    ));
    const comment = definitions.find(({ intent }) => intent === "comment")!;
    const action: TriageAction = {
      intent: "comment",
      itemId: changeRequest().id,
      markdown: "ship it",
    };

    await expect(comment.execute(
      action,
      changeRequest(),
      new AbortController().signal,
    )).resolves.toEqual({
      status: "outcome-unknown",
      message: "connection dropped",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
