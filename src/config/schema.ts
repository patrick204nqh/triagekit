import { z } from "zod";

export const TriageConfig = z.object({
  source: z.enum(["github"]),
  views: z.array(z.enum(["security-alerts"])).min(1),
  scope: z.record(z.string(), z.unknown()).optional(),
  branding: z.object({ title: z.string() }).default({ title: "Triage" }),
  logicHooks: z.string().optional(),
});

export type TriageConfigT = z.infer<typeof TriageConfig>;
