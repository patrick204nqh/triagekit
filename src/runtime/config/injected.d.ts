declare module "virtual:triagekit-config" {
  import type { TriageConfigT } from "../../config/schema";
  export const config: TriageConfigT;
}

declare module "virtual:triagekit-hooks" {
  import type { Scorer } from "../catalog/types";
  export const score: Scorer | undefined;
}
