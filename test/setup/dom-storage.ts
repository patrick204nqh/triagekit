class MockStorage {
  private data = new Map<string, string>();
  getItem(k: string): string | null { return this.data.get(k) ?? null; }
  setItem(k: string, v: string): void { this.data.set(k, v); }
  removeItem(k: string): void { this.data.delete(k); }
  clear(): void { this.data.clear(); }
}

Object.defineProperties(globalThis, {
  localStorage: { value: new MockStorage(), writable: true, configurable: true },
  sessionStorage: { value: new MockStorage(), writable: true, configurable: true },
});

installNativeOverlayDoubles();
import { installNativeOverlayDoubles } from "../helpers/native-overlays";
