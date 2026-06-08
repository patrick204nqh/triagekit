import type { SignalSpec } from "../scoring/score-model";
import type { Transform } from "../scoring/signal-transform";
import type { FieldDef } from "../scoring/field-catalog";
import { esc } from "../layout/util";

export interface SignalEditorOpts {
  name: string;
  signal: SignalSpec;
  fields: FieldDef[];
  onChange(name: string, signal: SignalSpec): void;
  onRename(oldName: string, newName: string): void;
  onRemove(name: string): void;
}

const TYPES: Transform["type"][] = ["linear", "bool", "enum", "ageDays"];

function defaultTransform(type: Transform["type"]): Transform {
  switch (type) {
    case "linear": return { type: "linear", in: [0, 10] };
    case "bool": return { type: "bool" };
    case "enum": return { type: "enum", map: {} };
    case "ageDays": return { type: "ageDays", halfLife: 30 };
  }
}

function paramsHtml(signal: SignalSpec, fields: FieldDef[]): string {
  const t = signal.transform;
  if (t.type === "linear")
    return `<label>min <input type="number" step="any" data-p="lo" value="${t.in[0]}"></label>`
         + `<label>max <input type="number" step="any" data-p="hi" value="${t.in[1]}"></label>`;
  if (t.type === "ageDays")
    return `<label>half-life days <input type="number" step="any" data-p="halfLife" value="${t.halfLife}"></label>`;
  if (t.type === "enum") {
    const field = fields.find(f => f.name === signal.from);
    const keys = field?.values ?? Object.keys(t.map);
    return keys.map(k => `<label class="enum-kv">${esc(k)} <input type="number" step="0.05" data-enum="${esc(k)}" value="${t.map[k] ?? 0}"></label>`).join("");
  }
  return `<span class="muted">no parameters</span>`;
}

export function renderSignalEditor(host: HTMLElement, opts: SignalEditorOpts): void {
  const { name, signal, fields } = opts;
  const fieldOpts = fields.map(f => `<option value="${esc(f.name)}" ${f.name === signal.from ? "selected" : ""}>${esc(f.name)}</option>`).join("");
  const typeOpts = TYPES.map(ty => `<option value="${ty}" ${signal.transform.type === ty ? "selected" : ""}>${ty}</option>`).join("");

  host.innerHTML = `<div class="sig-row">
    <input class="sig-name" data-name value="${esc(name)}" aria-label="Signal name">
    <select data-field aria-label="Field for ${esc(name)}">${fieldOpts}</select>
    <select data-type aria-label="Transform for ${esc(name)}">${typeOpts}</select>
    <span class="sig-params" data-params>${paramsHtml(signal, fields)}</span>
    <button class="btn-ghost mini" data-remove aria-label="Remove ${esc(name)}">×</button>
  </div>`;

  const emit = (transform: Transform, from: string = signal.from) => opts.onChange(name, { from, transform });

  host.querySelector<HTMLInputElement>("[data-name]")!.addEventListener("change", (e) => {
    const v = (e.target as HTMLInputElement).value.trim();
    if (v && v !== name) opts.onRename(name, v);
  });
  host.querySelector<HTMLSelectElement>("[data-field]")!.addEventListener("change", (e) => {
    emit(signal.transform, (e.target as HTMLSelectElement).value);
  });
  host.querySelector<HTMLSelectElement>("[data-type]")!.addEventListener("change", (e) => {
    emit(defaultTransform((e.target as HTMLSelectElement).value as Transform["type"]));
  });
  host.querySelector<HTMLButtonElement>("[data-remove]")!.addEventListener("click", () => opts.onRemove(name));

  const readParams = (): Transform => {
    const t = signal.transform;
    if (t.type === "linear") {
      const lo = Number(host.querySelector<HTMLInputElement>('[data-p="lo"]')!.value);
      const hi = Number(host.querySelector<HTMLInputElement>('[data-p="hi"]')!.value);
      return { type: "linear", in: [lo, hi] };
    }
    if (t.type === "ageDays") {
      return { type: "ageDays", halfLife: Number(host.querySelector<HTMLInputElement>('[data-p="halfLife"]')!.value) };
    }
    if (t.type === "enum") {
      const map: Record<string, number> = {};
      host.querySelectorAll<HTMLInputElement>("[data-enum]").forEach(inp => { map[inp.dataset.enum!] = Number(inp.value) || 0; });
      return { type: "enum", map };
    }
    return { type: "bool" };
  };
  host.querySelectorAll<HTMLInputElement>("[data-p], [data-enum]").forEach(inp =>
    inp.addEventListener("change", () => emit(readParams())));
}
