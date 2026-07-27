import { genericCharts } from "../layout/charts/generic";
import { dueSoonTab } from "../layout/due-soon";
import {
  genericFilterAxes,
  genericSortKeys,
} from "../layout/toolbar/axis-registry";
import { assigneeAxis } from "../views/code-review/view";
import type { RuntimeDefaults } from "./types";

export const runtimeDefaults: RuntimeDefaults = Object.freeze({
  filters: Object.freeze([...genericFilterAxes, assigneeAxis]),
  sorts: Object.freeze([...genericSortKeys]),
  charts: Object.freeze([...genericCharts]),
  tabs: Object.freeze([dueSoonTab]),
});
