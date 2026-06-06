import type { Kind, TriageItem } from "../dataset/item";
import type { Transform } from "./signal-transform";
import { applyTransform } from "./signal-transform";
import { parseFormula, evalFormula, formulaVars, FormulaError, type Expr } from "./formula";
import type { FieldDef } from "./field-catalog";

export interface SignalSpec { from: string; transform: Transform; }
export interface TierBand { name: string; min: number; }
export interface ScoreModel {
  kind: Kind;
  signals: Record<string, SignalSpec>;
  formula: string;
  scale: number;            // multiply the formula result before rounding (use 1 if the formula already scales)
  tiers: TierBand[];        // listed high -> low; mins strictly decrease
}

function readField(item: TriageItem, from: string): unknown {
  if (Object.prototype.hasOwnProperty.call(item, from)) {
    return (item as unknown as Record<string, unknown>)[from];
  }
  const d = item.details as Record<string, unknown> | null | undefined;
  return d ? d[from] : undefined;
}

export function evalScoreModel(model: ScoreModel, item: TriageItem, now: number = Date.now()): number {
  const scope: Record<string, number> = {};
  for (const [name, spec] of Object.entries(model.signals)) {
    scope[name] = applyTransform(readField(item, spec.from), spec.transform, now);
  }
  const expr = parseFormula(model.formula);
  const raw = evalFormula(expr, scope) * model.scale;
  return Number.isFinite(raw) ? Math.round(raw) : 0;
}

export function tierFromBands(score: number, tiers: TierBand[]): string {
  const sorted = [...tiers].sort((a, b) => b.min - a.min);
  for (const band of sorted) if (score >= band.min) return band.name;
  return sorted.length ? sorted[sorted.length - 1].name : "P3";
}

// Returns a list of human-readable problems; empty = valid.
export function validateModel(model: ScoreModel, fields: FieldDef[]): string[] {
  const errs: string[] = [];
  const known = new Set(fields.map(f => f.name));
  for (const [name, spec] of Object.entries(model.signals)) {
    if (!known.has(spec.from)) errs.push(`signal "${name}" references unknown field "${spec.from}"`);
  }
  try {
    const expr = parseFormula(model.formula);
    for (const v of formulaVars(expr)) {
      if (!Object.prototype.hasOwnProperty.call(model.signals, v))
        errs.push(`formula uses unknown signal "${v}"`);
    }
    const checkCalls = (n: Expr): void => {
      if (n.t === "call") {
        if (n.fn === "clamp" && n.args.length !== 3)
          errs.push("clamp requires exactly 3 arguments: clamp(x, lo, hi)");
        n.args.forEach(checkCalls);
      } else if (n.t === "neg") checkCalls(n.e);
      else if (n.t === "bin") { checkCalls(n.a); checkCalls(n.b); }
    };
    checkCalls(expr);
  } catch (e) {
    errs.push(e instanceof FormulaError ? `formula: ${e.message}` : String(e));
  }
  const mins = model.tiers.map(t => t.min);
  for (let i = 1; i < mins.length; i++) {
    if (mins[i] >= mins[i - 1]) { errs.push("tier cutoffs must strictly decrease"); break; }
  }
  return errs;
}
