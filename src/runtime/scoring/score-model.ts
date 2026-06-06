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

export interface ScoreExplanation {
  signals: Record<string, { from: string; raw: unknown; value: number }>;  // value normalized 0..1
  score: number;
}

function readField(item: TriageItem, from: string): unknown {
  if (Object.prototype.hasOwnProperty.call(item, from)) {
    return (item as unknown as Record<string, unknown>)[from];
  }
  const d = item.details as Record<string, unknown> | null | undefined;
  return d ? d[from] : undefined;
}

export function explainScoreModel(model: ScoreModel, item: TriageItem, now: number = Date.now()): ScoreExplanation {
  const signals: Record<string, { from: string; raw: unknown; value: number }> = {};
  const scope: Record<string, number> = {};
  for (const [name, spec] of Object.entries(model.signals)) {
    const raw = readField(item, spec.from);
    const value = applyTransform(raw, spec.transform, now);
    signals[name] = { from: spec.from, raw, value };
    scope[name] = value;
  }
  const expr = parseFormula(model.formula);
  const out = evalFormula(expr, scope) * model.scale;
  return { signals, score: Number.isFinite(out) ? Math.round(out) : 0 };
}

export function evalScoreModel(model: ScoreModel, item: TriageItem, now: number = Date.now()): number {
  return explainScoreModel(model, item, now).score;
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
  for (const t of model.tiers) {
    if (!/^P[0-3]$/.test(t.name)) errs.push(`tier name "${t.name}" must be one of P0-P3`);
  }
  const mins = model.tiers.map(t => t.min);
  for (let i = 1; i < mins.length; i++) {
    if (mins[i] >= mins[i - 1]) { errs.push("tier cutoffs must strictly decrease"); break; }
  }
  return errs;
}
