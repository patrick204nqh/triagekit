// Shared utility for both memory and indexed-db persistence layers.
export const frozenCopy = <T>(value: T): T => {
  const copy = structuredClone(value);
  const seen = new WeakSet<object>();
  const freeze = (candidate: unknown): void => {
    if (candidate === null || typeof candidate !== "object" || seen.has(candidate)) return;
    seen.add(candidate);
    for (const nested of Object.values(candidate)) freeze(nested);
    Object.freeze(candidate);
  };
  freeze(copy);
  return copy;
};
