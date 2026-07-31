import type { Kind } from "../dataset/item";
import type { Tier } from "../scoring/tier";

export type HandoffMode = "investigate" | "implement";

export type HandoffValueV1 =
  | string
  | number
  | boolean
  | null
  | readonly HandoffValueV1[]
  | { readonly [key: string]: HandoffValueV1 };

export interface HandoffEvidenceV1 {
  readonly label: string;
  readonly value: string | number | boolean;
  readonly reason?: string;
}

export interface HandoffRelatedItemV1 {
  readonly id: string;
  readonly kind: Kind;
  readonly provider: string;
  readonly title: string;
  readonly location: string;
  readonly url: string;
  readonly relationship: string;
}

export interface HandoffTargetV1 {
  readonly id: string;
  readonly kind: Kind;
  readonly provider: string;
  readonly providerReference: Readonly<Record<string, string | number | boolean>>;
  readonly title: string;
  readonly location: string;
  readonly url: string;
  readonly createdAt: string;
  readonly priority: {
    readonly signal: number;
    readonly score: number;
    readonly tier: Tier;
    readonly explanation?: readonly HandoffEvidenceV1[];
  };
  readonly note?: string;
  readonly details: Readonly<Record<string, HandoffValueV1>>;
}

export interface HandoffContextV1 {
  readonly session: {
    readonly kind: Kind;
    readonly provider: string;
    readonly repository?: string;
  };
  readonly relatedItems: readonly HandoffRelatedItemV1[];
}

export interface HandoffIntent {
  readonly outcome: string;
  readonly constraints: readonly string[];
  readonly verification: readonly string[];
}

export interface AgentHandoffV1 {
  readonly schema: "triagekit.agent-handoff";
  readonly version: 1;
  readonly createdAt: string;
  readonly intent: HandoffIntent;
  readonly targets: readonly HandoffTargetV1[];
  readonly context: HandoffContextV1;
}

export type TransportResult =
  | { ok: true }
  | { ok: false; error: string };

export type ValidationResult =
  | { valid: true }
  | { valid: false; errors: readonly { field: string; message: string }[] };
