import { parseFormula, type Expr } from "./formula";

// Canonical simple-mode formula: a sum of `signal * weight` terms, in key order.
export function weightsToFormula(weights: Record<string, number>): string {
  const terms = Object.entries(weights).map(([name, w]) => `${name} * ${w}`);
  return terms.length ? terms.join(" + ") : "0";
}

// Inverse of weightsToFormula. Returns weights iff the formula is EXACTLY a sum of
// `signal * number` (or `number * signal`) terms — one per name in signalNames, no
// extras, no duplicates, no other ops/parens/functions. Otherwise null (→ Simple
// mode is disabled, "custom formula"). AST-based, no regex.
export function formulaToWeights(formula: string, signalNames: string[]): Record<string, number> | null {
  let expr: Expr;
  try { expr = parseFormula(formula); } catch { return null; }

  const terms: Expr[] = [];
  const flatten = (n: Expr): void => {
    if (n.t === "bin" && n.op === "+") { flatten(n.a); flatten(n.b); }
    else terms.push(n);
  };
  flatten(expr);

  const weights: Record<string, number> = {};
  for (const term of terms) {
    if (term.t !== "bin" || term.op !== "*") return null;
    let name: string | null = null;
    let w: number | null = null;
    for (const side of [term.a, term.b]) {
      if (side.t === "var") name = side.name;
      else if (side.t === "num") w = side.v;
      else return null;   // anything other than var*num is "custom"
    }
    if (name === null || w === null) return null;
    if (Object.prototype.hasOwnProperty.call(weights, name)) return null;   // duplicate term
    weights[name] = w;
  }

  const got = Object.keys(weights).sort();
  const want = [...signalNames].sort();
  if (got.length !== want.length || got.some((g, i) => g !== want[i])) return null;
  return weights;
}
