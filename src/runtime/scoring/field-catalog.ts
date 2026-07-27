
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
export const baseFields: readonly FieldDef[] = [
  { name: "signal", type: "number", range: [0, 100] },
  { name: "createdAt", type: "date" },
];
