// src/runtime/adapters/timer.ts
import type { TimerPort } from "../core/ports";
export function createTimer(): TimerPort {
  return {
    every(ms, fn) {
      const id = setInterval(fn, ms);
      return () => clearInterval(id);
    },
  };
}
