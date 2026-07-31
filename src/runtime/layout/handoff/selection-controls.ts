import type { HandoffIdentity } from "../../handoff/types";
import { queueKey } from "../../handoff/queue";
import type { ScoredItem } from "../table/kind-renderer";

export interface SelectionControlsProps {
  readonly visible: readonly ScoredItem[];
  readonly queuedKeys: ReadonlySet<string>;
  readonly readyCount: number;
  readonly onSetVisible: (
    rows: readonly ScoredItem[],
    selected: boolean,
  ) => void;
  readonly onOpenQueue: () => void;
}

export interface HandoffSelection {
  readonly queuedKeys: ReadonlySet<string>;
  readonly onToggle: (item: ScoredItem) => void;
}

export function handoffIdentityForItem(item: ScoredItem): HandoffIdentity {
  return {
    provider: item.provider,
    itemId: item.id,
    kind: item.kind,
    repository: item.location,
  };
}

export function renderSelectionControls(
  host: HTMLElement,
  props: SelectionControlsProps,
): void {
  const count = props.visible.length;
  const selectedVisible = props.visible.filter((item) =>
    props.queuedKeys.has(queueKey(handoffIdentityForItem(item)))).length;
  const allVisibleSelected = count > 0 && selectedVisible === count;
  const someVisibleSelected = selectedVisible > 0 && !allVisibleSelected;
  const queueLabel = props.readyCount > 0
    ? `Handoff · ${props.readyCount} ready`
    : "Handoff";
  const accessibleLabel = props.readyCount > 0
    ? `Open Handoff queue: ${props.readyCount} ready`
    : "Open Handoff queue";
  host.innerHTML = `<label class="tb-btn visible-selection"><input type="checkbox" data-toggle-visible${count === 0 ? " disabled" : ""}><span>Select visible · ${count}</span></label>
    <button type="button" class="queue-badge" data-queue-badge aria-label="${accessibleLabel}">${queueLabel}</button>`;
  const input = host.querySelector<HTMLInputElement>("[data-toggle-visible]")!;
  input.checked = allVisibleSelected;
  input.indeterminate = someVisibleSelected;
  input.setAttribute(
    "aria-checked",
    someVisibleSelected ? "mixed" : String(allVisibleSelected),
  );
  input.addEventListener("change", () =>
    props.onSetVisible(props.visible, input.checked));
  host.querySelector<HTMLElement>("[data-queue-badge]")
    ?.addEventListener("click", props.onOpenQueue);
}
