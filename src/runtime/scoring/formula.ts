// A tiny, sandboxed arithmetic language over named signals. NO eval, NO globals:
// the only callables are min/max/clamp and the only identifiers are whatever the
// caller puts in scope. Anything else is a FormulaError. This is what keeps the
// no-third-party / CSP promise while allowing "full formula" scoring.

export type Expr =
  | { t: "num"; v: number }
  | { t: "var"; name: string }
  | { t: "neg"; e: Expr }
  | { t: "bin"; op: "+" | "-" | "*" | "/"; a: Expr; b: Expr }
  | { t: "call"; fn: "min" | "max" | "clamp"; args: Expr[] };

export class FormulaError extends Error {}

const FUNCS = new Set(["min", "max", "clamp"]);

function tokenize(src: string): string[] {
  const re = /\s*([A-Za-z_]\w*|\d+\.?\d*|\.\d+|[()+\-*/,])\s*/y;
  const toks: string[] = [];
  let i = 0;
  while (i < src.length) {
    re.lastIndex = i;
    const m = re.exec(src);
    if (!m) throw new FormulaError(`unexpected character: "${src.slice(i)}"`);
    toks.push(m[1]);
    i = re.lastIndex;
  }
  return toks;
}

export function parseFormula(src: string): Expr {
  const toks = tokenize(src);
  let p = 0;
  const peek = (): string | undefined => toks[p];
  const eat = (x?: string): string => {
    const t = toks[p++];
    if (x && t !== x) throw new FormulaError(`expected "${x}", got "${t ?? "end of input"}"`);
    if (t === undefined) throw new FormulaError("unexpected end of formula");
    return t;
  };

  const parseExpr = (): Expr => {
    let a = parseTerm();
    while (peek() === "+" || peek() === "-") a = { t: "bin", op: eat() as "+" | "-", a, b: parseTerm() };
    return a;
  };
  const parseTerm = (): Expr => {
    let a = parseFactor();
    while (peek() === "*" || peek() === "/") a = { t: "bin", op: eat() as "*" | "/", a, b: parseFactor() };
    return a;
  };
  const parseFactor = (): Expr => {
    if (peek() === "-") { eat(); return { t: "neg", e: parseFactor() }; }
    return parsePrimary();
  };
  const parsePrimary = (): Expr => {
    const t = peek();
    if (t === undefined) throw new FormulaError("unexpected end of formula");
    if (t === "(") { eat("("); const e = parseExpr(); eat(")"); return e; }
    if (/^(\d|\.)/.test(t)) {
      eat();
      const v = Number(t);
      if (!Number.isFinite(v)) throw new FormulaError(`bad number: "${t}"`);
      return { t: "num", v };
    }
    if (/^[A-Za-z_]/.test(t)) {
      eat();
      if (peek() === "(") {
        if (!FUNCS.has(t)) throw new FormulaError(`unknown function: ${t}`);
        eat("(");
        const args: Expr[] = [];
        if (peek() !== ")") { args.push(parseExpr()); while (peek() === ",") { eat(","); args.push(parseExpr()); } }
        eat(")");
        return { t: "call", fn: t as "min" | "max" | "clamp", args };
      }
      return { t: "var", name: t };
    }
    throw new FormulaError(`unexpected token: "${t}"`);
  };

  const e = parseExpr();
  if (p !== toks.length) throw new FormulaError(`trailing tokens: "${toks.slice(p).join(" ")}"`);
  return e;
}

export function evalFormula(e: Expr, scope: Record<string, number>): number {
  switch (e.t) {
    case "num": return e.v;
    case "var":
      if (!(e.name in scope)) throw new FormulaError(`unknown identifier: ${e.name}`);
      return scope[e.name];
    case "neg": return -evalFormula(e.e, scope);
    case "bin": {
      const a = evalFormula(e.a, scope), b = evalFormula(e.b, scope);
      switch (e.op) { case "+": return a + b; case "-": return a - b; case "*": return a * b; case "/": return a / b; }
    }
    // eslint-disable-next-line no-fallthrough
    case "call": {
      const xs = e.args.map(a => evalFormula(a, scope));
      if (e.fn === "min") return Math.min(...xs);
      if (e.fn === "max") return Math.max(...xs);
      if (xs.length !== 3) throw new FormulaError("clamp expects clamp(x, lo, hi)");
      return Math.min(Math.max(xs[0], xs[1]), xs[2]);
    }
  }
}

export function formulaVars(e: Expr): string[] {
  const out = new Set<string>();
  const walk = (n: Expr): void => {
    if (n.t === "var") out.add(n.name);
    else if (n.t === "neg") walk(n.e);
    else if (n.t === "bin") { walk(n.a); walk(n.b); }
    else if (n.t === "call") n.args.forEach(walk);
  };
  walk(e);
  return [...out];
}
