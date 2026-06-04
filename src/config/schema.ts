import { z } from "zod";

export const TriageConfig = z.object({
  org: z.string().min(1),
  provider: z.enum(["github"]),
  repos: z.array(z.string().min(1)).min(1),
  views: z.array(z.enum(["security-alerts"])).min(1),
  branding: z.object({ title: z.string() }).default({ title: "Triage" }),
  logicHooks: z.string().optional(),
});

export type TriageConfigT = z.infer<typeof TriageConfig>;
