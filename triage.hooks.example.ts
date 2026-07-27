// Optional hooks module for triagekit.
// Copy to triage.hooks.ts (gitignored) and uncomment logicHooks in triage.config.yml.
// Exported functions override built-in scoring and correlation behavior.
//
// The score function receives a TriageItem and returns a number (higher = more urgent).
// Return undefined to fall through to the built-in scorer for that kind.
import type { TriageItem } from "./src/runtime/dataset/item";

export function score(item: TriageItem): number | undefined {
  // Example: bump score for items containing "security" in the title
  // if (/security/i.test(item.title)) return item.score + 10;
  return undefined;
}
