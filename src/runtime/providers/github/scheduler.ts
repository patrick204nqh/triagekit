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

export interface GithubSchedulerStatus {
  readonly paused: boolean;
  readonly retryAt?: number;
  readonly reason?: string;
}

export interface GithubRequestSchedulerOptions {
  readonly fetch: typeof fetch;
  readonly concurrency?: number;
  readonly now?: () => number;
  readonly random?: () => number;
  readonly setTimeout?: (callback: () => void, delay: number) => unknown;
  readonly clearTimeout?: (handle: unknown) => void;
  readonly onStatusChange?: (status: GithubSchedulerStatus) => void;
}

export class GithubOutcomeUnknownError extends Error {
  readonly kind = "outcome-unknown";

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "GithubOutcomeUnknownError";
  }
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
  const random = options.random ?? Math.random;
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

  const currentStatus = (): GithubSchedulerStatus => {
    if (!paused()) return { paused: false };
    return {
      paused: true,
      retryAt,
      reason: pauseReason,
    };
  };

  const publishStatus = (): void => {
    options.onStatusChange?.(currentStatus());
  };

  const sleep = (
    delay: number,
    signal: AbortSignal,
  ): Promise<void> => new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason ?? abortError("Request aborted"));
      return;
    }
    let handle: unknown;
    const aborted = (): void => {
      if (handle !== undefined) cancelTimeout(handle);
      reject(signal.reason ?? abortError("Request aborted"));
    };
    signal.addEventListener("abort", aborted, { once: true });
    handle = scheduleTimeout(() => {
      signal.removeEventListener("abort", aborted);
      resolve();
    }, delay);
  });

  const retryDelay = (response: Response | undefined, attempt: number): number => {
    const retryAfter = response?.headers.get("retry-after");
    if (retryAfter) {
      const seconds = Number(retryAfter);
      if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
      const epochMs = Date.parse(retryAfter);
      if (Number.isFinite(epochMs)) return Math.max(0, epochMs - now());
    }

    if (response?.headers.get("x-ratelimit-remaining") === "0") {
      const resetSeconds = Number(response.headers.get("x-ratelimit-reset"));
      if (Number.isFinite(resetSeconds)) {
        return Math.max(0, resetSeconds * 1_000 - now());
      }
    }

    return Math.min(2_000, 250 * 2 ** attempt)
      + Math.floor(Math.max(0, Math.min(1, random())) * 101);
  };

  const isRetryableStatus = (status: number): boolean =>
    status === 429 || status === 502 || status === 503 || status === 504;

  const isProviderPause = (response: Response): boolean =>
    response.status === 429
    || (response.status === 403
      && (response.headers.has("retry-after")
        || response.headers.get("x-ratelimit-remaining") === "0"));

  const execute = async (
    request: ScheduledRequest,
    signal: AbortSignal,
  ): Promise<Response> => {
    for (let attempt = 0; ; attempt += 1) {
      signal.throwIfAborted();
      let response: Response;
      try {
        response = await options.fetch(request.pathOrUrl, {
          ...request.init,
          signal,
        });
      } catch (error) {
        if (signal.aborted) {
          throw signal.reason ?? abortError("Request aborted");
        }
        if (request.retry === "never") {
          throw new GithubOutcomeUnknownError(
            error instanceof Error ? error.message : String(error),
            { cause: error },
          );
        }
        if (attempt >= 2) throw error;
        await sleep(retryDelay(undefined, attempt), signal);
        continue;
      }

      const delay = retryDelay(response, attempt);
      if (isProviderPause(response)) {
        scheduler.pauseUntil(now() + delay, "GitHub rate limit");
      }
      if (request.retry !== "safe-read"
        || !isRetryableStatus(response.status)
        || attempt >= 2) {
        return response;
      }
      await sleep(delay, signal);
    }
  };

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

      void execute(entry.request, controller.signal)
        .then(entry.resolve, entry.reject).finally(() => {
        entry.request.signal?.removeEventListener("abort", abortActive);
        activeControllers.delete(controller);
        active -= 1;
        pump();
      });
    }
  };

  const scheduler: GithubRequestScheduler = {
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
        publishStatus();
        pump();
      }, Math.max(0, epochMs - now()));
      publishStatus();
    },
    status: currentStatus,
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
  return scheduler;
};
