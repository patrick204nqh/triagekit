import { z } from "zod";

export const GithubActor = z.object({
  login: z.string().optional(),
  avatar_url: z.string().optional(),
  type: z.string().optional(),
});

export const GithubLabel = z.object({
  name: z.string().optional(),
  color: z.string().optional(),
});

export const GithubSecurityAdvisory = z.object({
  severity: z.string().optional(),
  cvss: z.object({ score: z.number().optional() }).optional(),
});

export const GithubSecurityVulnerability = z.object({
  first_patched_version: z.object({ identifier: z.string() }).nullable().optional(),
});

export const GithubDependency = z.object({
  package: z.object({ name: z.string().optional() }).optional(),
  scope: z.string().optional(),
});

export const GithubDependabotAlert = z.object({
  number: z.coerce.number().optional(),
  created_at: z.string().optional(),
  html_url: z.string().optional(),
  auto_dismissed_at: z.string().nullable().optional(),
  security_advisory: GithubSecurityAdvisory.optional(),
  security_vulnerability: GithubSecurityVulnerability.optional(),
  dependency: GithubDependency.optional(),
});

export const GithubCodeScanningLocation = z.object({
  path: z.string().optional(),
  start_line: z.number().optional(),
});

export const GithubCodeScanningInstance = z.object({
  location: GithubCodeScanningLocation.optional(),
});

export const GithubCodeScanningRule = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  security_severity_level: z.string().optional(),
});

export const GithubCodeScanningTool = z.object({
  name: z.string().optional(),
});

export const GithubCodeScanningAlert = z.object({
  number: z.coerce.number(),
  created_at: z.string().optional(),
  html_url: z.string().optional(),
  state: z.string().optional(),
  rule: GithubCodeScanningRule.optional(),
  tool: GithubCodeScanningTool.optional(),
  most_recent_instance: GithubCodeScanningInstance.optional(),
});

export const GithubIssue = z.object({
  number: z.coerce.number(),
  title: z.string().optional(),
  created_at: z.string().optional(),
  html_url: z.string().optional(),
  body: z.string().optional(),
  state: z.string().optional(),
  draft: z.boolean().optional(),
  pull_request: z.unknown().optional(),
  user: GithubActor.optional(),
  assignees: z.array(GithubActor).optional(),
  labels: z.array(GithubLabel).optional(),
  comments: z.number().optional(),
});

export const GithubRepository = z.object({
  full_name: z.string(),
  name: z.string(),
  owner: z.object({ login: z.string().optional() }).optional(),
});

export const GithubPullRequest = z.object({
  head: z.object({ sha: z.string().optional() }).optional(),
  mergeable: z.boolean().optional(),
  mergeable_state: z.string().optional(),
  requested_reviewers: z.array(GithubActor).optional(),
});

export const GithubCheckRun = z.object({
  conclusion: z.string().nullable().optional(),
  status: z.string().optional(),
});

export const GithubCheckRunsResponse = z.object({
  check_runs: z.array(GithubCheckRun).optional(),
});
