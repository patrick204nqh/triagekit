import type { Kind, TriageItem } from "../dataset/item";
import { type ScoreModel, validateModel } from "../scoring/score-model";
import { fieldsFor } from "../scoring/field-catalog";
import { listDefaultModels, defaultModelFor } from "../scoring/default-model";
import { weightsToFormula, formulaToWeights } from "../scoring/weights";
import { renderSignalEditor } from "./signal-editor";
import { previewRerank } from "../scoring/preview";

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}

export interface ScoringEditorOpts {
  getDraft(kind: string): ScoreModel | null;
  setDraft(kind: string, model: ScoreModel): void;
  clearDraft(kind: string): void;
  onChange?(): void;
  previewRows?(kind: string): TriageItem[];
}

export function mountScoringEditor(host: HTMLElement, opts: ScoringEditorOpts) {
  const kinds = listDefaultModels().map(([k]) => k);
  let activeKind: Kind | null = kinds[0] ?? null;
  let mode: "simple" | "advanced" = "simple";

  // Active model = staged draft, else the published default.
  const modelOf = (kind: Kind): ScoreModel => opts.getDraft(kind) ?? defaultModelFor(kind)!;
  // Stage an edit WITHOUT re-rendering (caller decides whether to re-render).
  const stage = (m: ScoreModel) => { opts.setDraft(activeKind!, m); opts.onChange?.(); };
  // Stage + full re-render (for structural changes).
  const commit = (m: ScoreModel) => { stage(m); render(); };

  function render(): void {
    if (!activeKind) {
      host.innerHTML = `<p class="muted">No configurable scoring models are available.</p>`;
      return;
    }
    const model = modelOf(activeKind);
    const names = Object.keys(model.signals);
    const weights = formulaToWeights(model.formula, names);
    const simpleAvailable = weights !== null;
    if (mode === "simple" && !simpleAvailable) mode = "advanced";

    const kindOpts = kinds.map(k => `<option value="${esc(k)}" ${k === activeKind ? "selected" : ""}>${esc(k)}</option>`).join("");
    host.innerHTML = `<div class="scoring-editor">
      <div class="se-head">
        <select data-kind aria-label="Kind">${kindOpts}</select>
        <div class="seg se-mode">
          <button data-mode="simple" class="${mode === "simple" ? "on" : ""}" ${simpleAvailable ? "" : "disabled"}>Simple</button>
          <button data-mode="advanced" class="${mode === "advanced" ? "on" : ""}">Advanced</button>
        </div>
        <button class="btn-ghost mini" data-reset>Reset to default</button>
      </div>
      <div class="se-body" data-body></div>
      <div class="se-tiers" data-tiers></div>
      <div class="se-errors" data-errors></div>
      <div class="se-preview" data-preview></div>
    </div>`;

    const body = host.querySelector<HTMLElement>("[data-body]")!;
    if (mode === "simple") renderSimple(body, model, weights!);
    else renderAdvanced(body, model);
    renderTierBands(model);
    renderErrors(model, simpleAvailable);
    renderPreview(model);
    wireHead();
  }

  function renderSimple(body: HTMLElement, model: ScoreModel, weights: Record<string, number>): void {
    body.innerHTML = Object.entries(model.signals).map(([name, spec]) =>
      `<div class="se-weight">
        <span class="se-wname">${esc(name)}</span>
        <span class="muted se-wfrom">${esc(spec.from)} · ${esc(spec.transform.type)}</span>
        <input type="range" min="0" max="1" step="0.05" data-weight="${esc(name)}" value="${weights[name]}">
        <span class="se-wval" data-wval="${esc(name)}">${weights[name].toFixed(2)}</span>
      </div>`).join("");
    body.querySelectorAll<HTMLInputElement>("[data-weight]").forEach(slider =>
      slider.addEventListener("input", () => {
        const next = { ...weights, [slider.dataset.weight!]: Number(slider.value) };
        weights[slider.dataset.weight!] = Number(slider.value);
        const label = body.querySelector<HTMLElement>(`[data-wval="${slider.dataset.weight}"]`);
        if (label) label.textContent = Number(slider.value).toFixed(2);
        const staged = { ...model, formula: weightsToFormula(next) };
        stage(staged);                 // no full re-render: keep the slider alive mid-drag
        renderPreview(staged);         // live re-rank; rewrites only the preview panel
      }));
  }

  function renderAdvanced(body: HTMLElement, model: ScoreModel): void {
    body.innerHTML = `<label class="set-label">Formula</label>
      <textarea class="se-formula" data-formula rows="2">${esc(model.formula)}</textarea>
      <label class="set-label">Scale <input type="number" step="any" class="se-scale" data-scale value="${model.scale}"></label>
      <label class="set-label">Signals</label>
      <div class="se-signals" data-signals></div>
      <button class="btn-ghost mini" data-add-signal>+ Add signal</button>`;

    body.querySelector<HTMLTextAreaElement>("[data-formula]")!.addEventListener("change", (e) =>
      commit({ ...model, formula: (e.target as HTMLTextAreaElement).value }));
    body.querySelector<HTMLInputElement>("[data-scale]")!.addEventListener("change", (e) =>
      commit({ ...model, scale: Number((e.target as HTMLInputElement).value) || 0 }));
    body.querySelector<HTMLButtonElement>("[data-add-signal]")!.addEventListener("click", () => {
      const base = fieldsFor(activeKind!)[0]?.name ?? "signal";
      let n = "signal"; let i = 1;
      while (Object.prototype.hasOwnProperty.call(model.signals, n)) n = `signal${++i}`;
      commit({ ...model, signals: { ...model.signals, [n]: { from: base, transform: { type: "bool" } } } });
    });

    const signalsHost = body.querySelector<HTMLElement>("[data-signals]")!;
    const fields = fieldsFor(activeKind!);
    for (const [name, signal] of Object.entries(model.signals)) {
      const row = document.createElement("div");
      signalsHost.appendChild(row);
      renderSignalEditor(row, {
        name, signal, fields,
        onChange: (n, s) => commit({ ...model, signals: { ...model.signals, [n]: s } }),
        onRename: (oldN, newN) => {
          if (Object.prototype.hasOwnProperty.call(model.signals, newN)) return;
          const signals: Record<string, typeof signal> = {};
          for (const [k, v] of Object.entries(model.signals)) signals[k === oldN ? newN : k] = v;
          commit({ ...model, signals });
        },
        onRemove: (n) => {
          const rest: Record<string, typeof signal> = {};
          for (const [k, v] of Object.entries(model.signals)) if (k !== n) rest[k] = v;
          commit({ ...model, signals: rest });
        },
      });
    }
  }

  function renderTierBands(model: ScoreModel): void {
    const tiersHost = host.querySelector<HTMLElement>("[data-tiers]")!;
    const minOf = (name: string) => model.tiers.find(t => t.name === name)?.min ?? 0;
    tiersHost.innerHTML = `<label class="set-label">Tier bands</label>
      <div class="tier-thresholds">
        <label>P0 ≥ <input type="number" step="any" data-tier-min="P0" value="${minOf("P0")}"></label>
        <label>P1 ≥ <input type="number" step="any" data-tier-min="P1" value="${minOf("P1")}"></label>
        <label>P2 ≥ <input type="number" step="any" data-tier-min="P2" value="${minOf("P2")}"></label>
      </div>
      <span class="set-helper">P3 ≥ 0 (floor). Cutoffs must strictly decrease.</span>`;
    const read = (name: string) => Number(tiersHost.querySelector<HTMLInputElement>(`[data-tier-min="${name}"]`)!.value);
    tiersHost.querySelectorAll<HTMLInputElement>("[data-tier-min]").forEach(inp =>
      inp.addEventListener("change", () => commit({
        ...model,
        tiers: [
          { name: "P0", min: read("P0") },
          { name: "P1", min: read("P1") },
          { name: "P2", min: read("P2") },
          { name: "P3", min: 0 },
        ],
      })));
  }

  function renderPreview(model: ScoreModel): void {
    const box = host.querySelector<HTMLElement>("[data-preview]")!;
    if (!opts.previewRows || !activeKind) { box.innerHTML = ""; return; }
    const rows = opts.previewRows(activeKind);
    if (!rows.length) {
      box.innerHTML = `<label class="set-label">Preview</label><p class="muted">No loaded ${esc(activeKind)} items to preview.</p>`;
      return;
    }
    if (validateModel(model, fieldsFor(activeKind)).length) {
      box.innerHTML = `<label class="set-label">Preview</label><p class="muted">Fix the errors above to preview.</p>`;
      return;
    }
    const top = previewRerank(model, rows, 8);
    box.innerHTML = `<label class="set-label">Preview · top ${top.length} of ${esc(activeKind)}</label>
      <ol class="se-preview-list">${top.map(r =>
        `<li><span class="pv-title">${esc(r.item.title)}</span><span class="pv-score num">${r.score}</span><span class="tier tier-${r.tier}">${esc(r.tier)}</span></li>`).join("")}</ol>`;
  }

  function renderErrors(model: ScoreModel, simpleAvailable: boolean): void {
    const errs = validateModel(model, fieldsFor(activeKind!));
    const box = host.querySelector<HTMLElement>("[data-errors]")!;
    box.innerHTML = errs.map(e => `<p class="se-error">${esc(e)}</p>`).join("");
    if (!simpleAvailable) {
      box.insertAdjacentHTML("afterbegin", `<p class="muted" data-simple-disabled>Custom formula — edit in Advanced.</p>`);
    }
  }

  function wireHead(): void {
    host.querySelector<HTMLSelectElement>("[data-kind]")?.addEventListener("change", (e) => {
      activeKind = (e.target as HTMLSelectElement).value as Kind; mode = "simple"; render();
    });
    host.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach(b =>
      b.addEventListener("click", () => { if (b.hasAttribute("disabled")) return; mode = b.dataset.mode as "simple" | "advanced"; render(); }));
    host.querySelector<HTMLButtonElement>("[data-reset]")?.addEventListener("click", () => {
      opts.clearDraft(activeKind!); opts.onChange?.(); render();
    });
  }

  return { render };
}
