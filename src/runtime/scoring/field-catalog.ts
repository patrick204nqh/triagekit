import type { Kind } from "../dataset/item";

// The fields a scoring formula (Phase 4e) may reference for a kind. Adapters publish
// the detail-level fields; every item also carries the base fields below.
export type FieldType = "number" | "bool" | "enum" | "date";
export interface FieldDef {
  name: string;              // item-level key, or a key within item.details
  type: FieldType;
  values?: string[];         // allowed values, for enum
  range?: [number, number];  // hint for numeric normalization
}

// Present on every TriageItem regardless of kind.
const BASE: FieldDef[] = [
  { name: "signal", type: "number", range: [0, 100] },
  { name: "createdAt", type: "date" },
];

const catalogs = new Map<Kind, FieldDef[]>();
export function registerFieldCatalog(kind: Kind, fields: FieldDef[]): void {
  catalogs.set(kind, fields);
}
export function fieldsFor(kind: Kind): FieldDef[] {
  return [...BASE, ...(catalogs.get(kind) ?? [])];
}
export function listFieldCatalogs(): Array<[Kind, FieldDef[]]> {
  return [...catalogs.entries()];
}
