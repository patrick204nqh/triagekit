import type { QueueIdentity } from "../../delegation/types";
import type { ScoredItem } from "../table/kind-renderer";

export interface SelectionControlsProps {
  readonly visible: readonly ScoredItem[];
  readonly queuedKeys: ReadonlySet<string>;
  readonly selectedCount: number;
  readonly totalCount: number;
  readonly onAddVisible: (rows: readonly ScoredItem[]) => void;
  readonly onOpenQueue: () => void;
}

export interface RowDelegationSelection {
  readonly queuedKeys: ReadonlySet<string>;
  readonly onToggle: (item: ScoredItem) => void;
}

export function queueIdentityForItem(item: ScoredItem): QueueIdentity {
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
  host.innerHTML = `<button type="button" class="tb-btn add-visible" data-add-visible aria-label="Add ${count} visible items to delegation queue"${count === 0 ? " disabled" : ""}>Add visible · ${count}</button>
    <button type="button" class="queue-badge" data-queue-badge aria-label="Open delegation queue: ${props.selectedCount} selected, ${props.totalCount} retained">${props.selectedCount} selected · ${props.totalCount} retained</button>`;
  host.querySelector<HTMLElement>("[data-add-visible]")
    ?.addEventListener("click", () => props.onAddVisible(props.visible));
  host.querySelector<HTMLElement>("[data-queue-badge]")
    ?.addEventListener("click", props.onOpenQueue);
}
