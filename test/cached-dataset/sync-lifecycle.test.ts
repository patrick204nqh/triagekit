import { describe, expect, it } from "vitest";
import {
  createMemoryConnectionState,
} from "../../src/runtime/cached-dataset/browser-connection-state";
import {
  createCachedDatasets,
} from "../../src/runtime/cached-dataset/cached-datasets";
import type {
  DatasetClock,
} from "../../src/runtime/cached-dataset/clock";
import {
  createConnectionKey,
} from "../../src/runtime/cached-dataset/identity";
import {
  createMemoryDatasetPersistence,
} from "../../src/runtime/cached-dataset/memory-persistence";
import type {
  BoundProvider,
  ProviderDefinition,
  SliceOutcome,
} from "../../src/runtime/cached-dataset/provider";
import type {
  DatasetPersistence,
  PersistedSlice,
} from "../../src/runtime/cached-dataset/persistence";
import type {
  RefreshCadence,
} from "../../src/runtime/cached-dataset/types";
import type { TriageFailure } from "../../src/runtime/catalog/types";
import type { TriageItem } from "../../src/runtime/dataset/item";

const item = (
  id: string,
  target = "acme-corp/web",
): TriageItem => ({
  id,
  provider: "github",
  providerRef: { repository: target, number: 1 },
  kind: "issue",
  title: id,
  location: target,
  signal: 10,
  createdAt: "2026-01-01T00:00:00Z",
  url: `https://example.invalid/${id}`,
  details: {},
});

const changed = (
  target: string,
  id: string,
): SliceOutcome => ({
  type: "changed",
  target,
  kind: "issue",
  items: [item(id, target)],
});

const failed = (
  target: string,
  category: TriageFailure["category"] = "rate-limit",
): SliceOutcome => ({
  type: "failed",
  target,
  kind: "issue",
  failure: {
    provider: "github",
    kind: "issue",
    target,
    category,
    message: category === "scope"
      ? "Code Security must be enabled"
      : "rate limited",
  },
});

class FakeClock implements DatasetClock {
  value = 1_000_000;
  nextHandle = 1;
  intervals = new Map<number, { callback: () => void; milliseconds: number }>();
  cleared: number[] = [];

  now = () => this.value;
  setInterval(callback: () => void, milliseconds: number): number {
    const handle = this.nextHandle++;
    this.intervals.set(handle, { callback, milliseconds });
    return handle;
  }
  clearInterval(handle: unknown): void {
    const id = handle as number;
    this.cleared.push(id);
    this.intervals.delete(id);
  }
}

const persisted = (
  connectionKey: string,
  target: string,
  id: string,
  validatedAt = 1_000_000,
): PersistedSlice => ({
  key: { connectionKey, target, kind: "issue" },
  schema: 1,
  items: [item(id, target)],
  validatedAt,
  lastAccessedAt: validatedAt,
  bytes: 100,
});

const flush = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await Promise.resolve();
};

const seed = async (
  persistence: DatasetPersistence,
  credential: string,
  targets: readonly string[],
): Promise<void> => {
  const scope = { repos: targets };
  const connectionKey = await createConnectionKey("github", credential, scope);
  await persistence.activateGeneration(connectionKey, 0);
  for (const target of targets) {
    await persistence.commit(
      persisted(connectionKey, target, `${target}-old`),
      0,
    );
  }
};

const sessionFixture = async (input: {
  outcomes: (
    requestIndex: number,
  ) => AsyncIterable<SliceOutcome>;
  targets?: readonly string[];
  cadence?: RefreshCadence;
}) => {
  const persistence = createMemoryDatasetPersistence();
  const targets = input.targets ?? ["acme-corp/web"];
  await seed(persistence, "token", targets);
  let requestCount = 0;
  const definition: ProviderDefinition = {
    id: "github",
    kinds: ["issue"],
    async bind(): Promise<BoundProvider> {
      return {
        discoverScope: async () => [],
        canonicalizeScope: (scope) => scope,
        targets: (scope) => scope.repos as readonly string[],
        fetchSlices: () => input.outcomes(requestCount++),
        close() {},
      };
    },
  };
  const clock = new FakeClock();
  const datasets = createCachedDatasets({
    providers: [definition],
    persistence,
    connectionState: createMemoryConnectionState(),
    clock,
  });
  const connected = await datasets.connect("github", "token");
  const session = connected.open({
    scope: { repos: targets },
    kinds: ["issue"],
    cadence: input.cadence ?? "off",
  });
  await flush();
  return { session, clock, requestCount: () => requestCount };
};

describe("Cached Dataset sync lifecycle", () => {
  it("allows only the newest generation to commit", async () => {
    const pending: ((outcome: SliceOutcome) => void)[] = [];
    const fixture = await sessionFixture({
      outcomes: () => (async function* () {
        const outcome = await new Promise<SliceOutcome>((resolve) => {
          pending.push(resolve);
        });
        yield outcome;
      })(),
    });

    const first = fixture.session.refresh();
    await flush();
    const second = fixture.session.refresh();
    await flush();
    pending[1](changed("acme-corp/web", "new"));
    expect((await second).status).toBe("complete");
    pending[0](changed("acme-corp/web", "old"));
    expect((await first).status).toBe("superseded");
    expect(fixture.session.snapshot().items.map((entry) => entry.id))
      .toEqual(["new"]);
  });

  it("commits successful targets and retains a failed target stale", async () => {
    const fixture = await sessionFixture({
      targets: ["web", "api"],
      outcomes: () => (async function* () {
        yield changed("web", "web-new");
        yield failed("api");
      })(),
    });

    const report = await fixture.session.refresh();

    expect(report.status).toBe("partial");
    expect(fixture.session.snapshot().items.map((entry) => entry.id).sort())
      .toEqual(["api-old", "web-new"]);
    expect(report.retainedStale).toEqual([{ target: "api", kind: "issue" }]);
  });

  it("schedules exact cadence intervals and cancels the prior timer", async () => {
    const off = await sessionFixture({
      outcomes: () => (async function* () {})(),
      cadence: "off",
    });
    expect(off.clock.intervals.size).toBe(0);

    const timed = await sessionFixture({
      outcomes: () => (async function* () {})(),
      cadence: 300,
    });
    expect([...timed.clock.intervals.values()].map((entry) => entry.milliseconds))
      .toEqual([300_000]);

    timed.session.setCadence(600);
    expect(timed.clock.cleared).toEqual([1]);
    expect([...timed.clock.intervals.values()].map((entry) => entry.milliseconds))
      .toEqual([600_000]);
    timed.session.setCadence(900);
    expect([...timed.clock.intervals.values()].map((entry) => entry.milliseconds))
      .toEqual([900_000]);
  });

  it("skips scope failures on cadence but retries them manually", async () => {
    const fixture = await sessionFixture({
      cadence: 300,
      outcomes: (requestIndex) => (async function* () {
        yield requestIndex === 0
          ? failed("acme-corp/web", "scope")
          : changed("acme-corp/web", "manual-retry");
      })(),
    });

    expect((await fixture.session.refresh()).status).toBe("partial");
    expect(fixture.requestCount()).toBe(1);

    const cadence = [...fixture.clock.intervals.values()][0];
    cadence.callback();
    await flush();
    expect(fixture.requestCount()).toBe(1);
    expect(fixture.session.snapshot().phase).toBe("partial");

    expect((await fixture.session.refresh()).status).toBe("complete");
    expect(fixture.requestCount()).toBe(2);
    expect(fixture.session.snapshot().items.map(({ id }) => id))
      .toContain("manual-retry");
  });

  it("manual refresh starts work without changing validation during snapshots", async () => {
    const fixture = await sessionFixture({
      outcomes: () => (async function* () {
        yield changed("acme-corp/web", "manual");
      })(),
    });
    const before = fixture.session.snapshot().slices[0].validatedAt;
    fixture.session.snapshot();
    fixture.session.snapshot();
    expect(fixture.session.snapshot().slices[0].validatedAt).toBe(before);

    expect((await fixture.session.refresh()).status).toBe("complete");
    expect(fixture.requestCount()).toBe(1);
  });
});
