// src/runtime/adapters/local-storage.ts
import type { StoragePort } from "../core/ports";
export function createLocalStorage(): StoragePort {
  return {
    get: (k) => localStorage.getItem(k),
    set: (k, v) => localStorage.setItem(k, v),
  };
}
