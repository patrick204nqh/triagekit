import type { Kind } from "../dataset/item";

export interface ViewModule {
  id: string;
  label: string;
  kind: Kind;
}
