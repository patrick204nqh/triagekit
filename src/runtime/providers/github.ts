// src/runtime/providers/github.ts
import type { ProviderManifest } from "../core/manifest";
import { githubSource } from "../ingest/github/dependency-vuln-source";

// Declarative provider metadata. NOTE: GitHub exposes MULTIPLE Sources today
// (githubSource for dependency-vuln, githubReviewSource for change-request/issue),
// selected per-artifact via listSources(). The single makeAdapter() returns the
// primary dependency-vuln source as a representative; the running shell drives data from
// listSources(), not from this manifest. This manifest is forward-facing metadata.
export const github: ProviderManifest = {
  id: "github",
  domain: "code-security",
  kinds: ["dependency-vuln", "change-request", "issue"],
  // Per-provider display nouns, declared for the future; NOT currently surfaced —
  // the sidebar shows neutral kind nouns (KIND_LABEL), e.g. "Change requests".
  labels: { "change-request": "Pull requests", issue: "Issues" },
  makeAdapter: (_deps) => githubSource,
};
