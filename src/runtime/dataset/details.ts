// src/runtime/dataset/details.ts
import type { TriageItem } from "./item";
import type { Actor, Label } from "./shared";

// Generic null-safe detail accessor; caller supplies the shape.
export function detailsAs<T>(item: TriageItem): T | null {
  const d = item.details;
  return d && typeof d === "object" ? (d as T) : null;
}

// Cross-cutting field readers shared by axes + tabs.
export function authorKindOf(item: TriageItem): Actor["kind"] | undefined {
  return detailsAs<{ author?: Actor }>(item)?.author?.kind;
}
export function labelNamesOf(item: TriageItem): string[] {
  return detailsAs<{ labels?: { name: string }[] }>(item)?.labels?.map(l => l.name) ?? [];
}
export function labelsOf(item: TriageItem): Label[] {
  return detailsAs<{ labels?: Label[] }>(item)?.labels ?? [];
}
export function deadlineOf(item: TriageItem): string | undefined {
  return detailsAs<{ dueAt?: string }>(item)?.dueAt;
}
