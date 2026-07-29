export type RequestPriority =
  | "triage-action"
  | "enrichment"
  | "manual-refresh"
  | "startup-refresh"
  | "cadence-refresh";

export interface ScheduledRequest {
  readonly pathOrUrl: string;
  readonly init?: RequestInit;
  readonly priority: RequestPriority;
  readonly retry: "safe-read" | "never";
  readonly signal?: AbortSignal;
}

export interface GithubRequestScheduler {
  run(request: ScheduledRequest): Promise<Response>;
  pauseUntil(epochMs: number, reason: string): void;
  status(): { paused: boolean; retryAt?: number; reason?: string };
  close(): void;
}

export interface GithubRequestSchedulerOptions {
  readonly fetch: typeof fetch;
  readonly concurrency?: number;
  readonly now?: () => number;
  readonly setTimeout?: (callback: () => void, delay: number) => unknown;
  readonly clearTimeout?: (handle: unknown) => void;
}

interface QueueEntry {
  readonly request: ScheduledRequest;
  readonly resolve: (response: Response) => void;
  readonly reject: (error: unknown) => void;
  removeAbortListener?: () => void;
}

const PRIORITIES: readonly RequestPriority[] = [
  "triage-action",
  "enrichment",
  "manual-refresh",
  "startup-refresh",
  "cadence-refresh",
];

const abortError = (message: string): DOMException =>
  new DOMException(message, "AbortError");

export const createGithubRequestScheduler = (
  options: GithubRequestSchedulerOptions,
): GithubRequestScheduler => {
  const concurrency = options.concurrency ?? 4;
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new RangeError("GitHub request concurrency must be a positive integer");
  }

  const now = options.now ?? Date.now;
  const scheduleTimeout = options.setTimeout
    ?? ((callback, delay) => globalThis.setTimeout(callback, delay));
  const cancelTimeout = options.clearTimeout
    ?? ((handle) => globalThis.clearTimeout(handle as number));
  const queues = new Map<RequestPriority, QueueEntry[]>(
    PRIORITIES.map((priority) => [priority, []]),
  );
  const activeControllers = new Set<AbortController>();
  let active = 0;
  let closed = false;
  let retryAt: number | undefined;
  let pauseReason: string | undefined;
  let pauseTimer: unknown;

  const paused = (): boolean =>
    retryAt !== undefined && retryAt > now();

  const nextEntry = (): QueueEntry | undefined => {
    for (const priority of PRIORITIES) {
      const entry = queues.get(priority)?.shift();
      if (entry) return entry;
    }
    return undefined;
  };

  const pump = (): void => {
    if (closed || paused()) return;
    while (active < concurrency) {
      const entry = nextEntry();
      if (!entry) return;
      entry.removeAbortListener?.();

      const controller = new AbortController();
      const abortActive = (): void =>
        controller.abort(entry.request.signal?.reason ?? abortError("Request aborted"));
      entry.request.signal?.addEventListener("abort", abortActive, { once: true });
      activeControllers.add(controller);
      active += 1;

      void options.fetch(entry.request.pathOrUrl, {
        ...entry.request.init,
        signal: controller.signal,
      }).then(entry.resolve, entry.reject).finally(() => {
        entry.request.signal?.removeEventListener("abort", abortActive);
        activeControllers.delete(controller);
        active -= 1;
        pump();
      });
    }
  };

  return {
    run(request) {
      if (closed) return Promise.reject(abortError("Scheduler closed"));
      if (request.signal?.aborted) {
        return Promise.reject(request.signal.reason ?? abortError("Request aborted"));
      }

      return new Promise<Response>((resolve, reject) => {
        const entry: QueueEntry = { request, resolve, reject };
        if (request.signal) {
          const abortQueued = (): void => {
            const queue = queues.get(request.priority);
            const index = queue?.indexOf(entry) ?? -1;
            if (index < 0 || !queue) return;
            queue.splice(index, 1);
            reject(request.signal?.reason ?? abortError("Request aborted"));
          };
          request.signal.addEventListener("abort", abortQueued, { once: true });
          entry.removeAbortListener = () =>
            request.signal?.removeEventListener("abort", abortQueued);
        }
        queues.get(request.priority)?.push(entry);
        pump();
      });
    },
    pauseUntil(epochMs, reason) {
      if (closed || epochMs <= now()) return;
      if (retryAt !== undefined && retryAt >= epochMs) return;
      retryAt = epochMs;
      pauseReason = reason;
      if (pauseTimer !== undefined) cancelTimeout(pauseTimer);
      pauseTimer = scheduleTimeout(() => {
        pauseTimer = undefined;
        retryAt = undefined;
        pauseReason = undefined;
        pump();
      }, Math.max(0, epochMs - now()));
    },
    status() {
      if (!paused()) return { paused: false };
      return {
        paused: true,
        retryAt,
        reason: pauseReason,
      };
    },
    close() {
      if (closed) return;
      closed = true;
      if (pauseTimer !== undefined) cancelTimeout(pauseTimer);
      for (const controller of activeControllers) {
        controller.abort(abortError("Scheduler closed"));
      }
      for (const queue of queues.values()) {
        for (const entry of queue.splice(0)) {
          entry.removeAbortListener?.();
          entry.reject(abortError("Scheduler closed"));
        }
      }
    },
  };
};
