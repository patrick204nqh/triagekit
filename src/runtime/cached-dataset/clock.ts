export const DATASET_RETENTION_MS = 7 * 24 * 60 * 60 * 1_000;
export const DATASET_SOFT_BYTES = 50 * 1024 * 1024;

export interface DatasetClock {
  now(): number;
  setInterval(callback: () => void, milliseconds: number): unknown;
  clearInterval(handle: unknown): void;
}

export const createBrowserDatasetClock = (): DatasetClock => ({
  now: Date.now,
  setInterval: (callback, milliseconds) =>
    globalThis.setInterval(callback, milliseconds),
  clearInterval: (handle) =>
    globalThis.clearInterval(handle as ReturnType<typeof setInterval>),
});

export const expiresAt = (validatedAt: number): number =>
  validatedAt + DATASET_RETENTION_MS;
