// src/runtime/providers/github.ts
import type { ProviderManifest } from "../core/manifest";
import { githubSource } from "../ingest/github/dependency-vuln-source";

// Declarative provider metadata. NOTE: GitHub exposes MULTIPLE Sources today
// (githubSource for dependency-vuln, githubReviewSource for change-request/issue),
// selected per-artifact via listSources(). The single makeAdapter() returns the
// primary alerts source as a representative; the running shell drives data from
// listSources(), not from this manifest. This manifest is forward-facing metadata.
export const github: ProviderManifest = {
  id: "github",
  domain: "code-security",
  kinds: ["dependency-vuln", "change-request", "issue"],
  labels: { "change-request": "Pull request", issue: "Issue" },
  makeAdapter: (_deps) => githubSource,
};
