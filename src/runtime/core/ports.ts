import type { ViewModel } from "./view-model";

// Driven (secondary) ports: core calls these; adapters implement them.
export interface ViewPort {
  render(vm: ViewModel): void;
}

export interface StoragePort {
  get(key: string): string | null;
  set(key: string, value: string): void;
}
