// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderSignalEditor } from "../../src/runtime/shell/signal-editor";
import type { SignalSpec } from "../../src/runtime/scoring/score-model";
import type { FieldDef } from "../../src/runtime/scoring/field-catalog";

const fields: FieldDef[] = [
  { name: "severity", type: "enum", values: ["critical", "high", "low"] },
  { name: "cvss", type: "number", range: [0, 10] },
  { name: "fixAvailable", type: "bool" },
];
const sig: SignalSpec = { from: "cvss", transform: { type: "linear", in: [0, 10] } };

function mount(signal = sig, handlers: Partial<Parameters<typeof renderSignalEditor>[1]> = {}) {
  const host = document.createElement("div");
  renderSignalEditor(host, {
    name: "cvss", signal, fields,
    onChange: handlers.onChange ?? (() => {}),
    onRename: handlers.onRename ?? (() => {}),
    onRemove: handlers.onRemove ?? (() => {}),
  });
  return host;
}

describe("renderSignalEditor", () => {
  it("shows field + transform selects with linear params", () => {
    const host = mount();
    expect(host.querySelector<HTMLSelectElement>("[data-field]")!.value).toBe("cvss");
    expect(host.querySelector<HTMLSelectElement>("[data-type]")!.value).toBe("linear");
    expect(host.querySelector('[data-p="lo"]')).not.toBeNull();
    expect(host.querySelector('[data-p="hi"]')).not.toBeNull();
  });
  it("emits an updated linear range on param change", () => {
    const onChange = vi.fn();
    const host = mount(sig, { onChange });
    const hi = host.querySelector<HTMLInputElement>('[data-p="hi"]')!;
    hi.value = "20"; hi.dispatchEvent(new Event("change"));
    expect(onChange).toHaveBeenCalledWith("cvss", { from: "cvss", transform: { type: "linear", in: [0, 20] } });
  });
  it("switches transform type with sensible defaults", () => {
    const onChange = vi.fn();
    const host = mount(sig, { onChange });
    const ty = host.querySelector<HTMLSelectElement>("[data-type]")!;
    ty.value = "bool"; ty.dispatchEvent(new Event("change"));
    expect(onChange).toHaveBeenCalledWith("cvss", { from: "cvss", transform: { type: "bool" } });
  });
  it("renders an enum value map from the field's allowed values", () => {
    const enumSig: SignalSpec = { from: "severity", transform: { type: "enum", map: { critical: 1, high: 0.7 } } };
    const onChange = vi.fn();
    const host = mount(enumSig, { onChange });
    expect(host.querySelector('[data-enum="critical"]')).not.toBeNull();
    expect(host.querySelector('[data-enum="low"]')).not.toBeNull();   // from field.values, default 0
    const c = host.querySelector<HTMLInputElement>('[data-enum="critical"]')!;
    c.value = "0.9"; c.dispatchEvent(new Event("change"));
    expect(onChange).toHaveBeenCalledWith("cvss",
      { from: "severity", transform: { type: "enum", map: { critical: 0.9, high: 0.7, low: 0 } } });
  });
  it("keys onChange by the signal name, not the field", () => {
    const onChange = vi.fn();
    const host = document.createElement("div");
    renderSignalEditor(host, {
      name: "fix", signal: { from: "fixAvailable", transform: { type: "bool" } }, fields,
      onChange, onRename: () => {}, onRemove: () => {},
    });
    host.querySelector<HTMLSelectElement>("[data-type]")!.value = "linear";
    host.querySelector<HTMLSelectElement>("[data-type]")!.dispatchEvent(new Event("change"));
    expect(onChange.mock.calls[0][0]).toBe("fix");   // keyed by name, not "fixAvailable"
  });
  it("fires onRename and onRemove", () => {
    const onRename = vi.fn(); const onRemove = vi.fn();
    const host = mount(sig, { onRename, onRemove });
    const nm = host.querySelector<HTMLInputElement>("[data-name]")!;
    nm.value = "score"; nm.dispatchEvent(new Event("change"));
    expect(onRename).toHaveBeenCalledWith("cvss", "score");
    host.querySelector<HTMLButtonElement>("[data-remove]")!.click();
    expect(onRemove).toHaveBeenCalledWith("cvss");
  });
});
