import type { StoragePort } from "../core/ports";

export interface LabelRules {
  readonly include: readonly string[];
  readonly exclude: readonly string[];
  readonly enabled: boolean;
}

export interface FocusPolicySnapshot {
  readonly provider: string;
  readonly repositoryOrder: readonly string[];
  readonly labels: LabelRules;
}

export interface FocusPolicyStore {
  get(provider: string): FocusPolicySnapshot;
  set(policy: FocusPolicySnapshot): void;
}

export type FocusPolicyStorage = StoragePort;
