import type { TriageConfigT } from "../config/schema";
import type { Scorer } from "./scoring/registry";
import { registerKinds } from "./core/register-kinds";
import { createStore } from "./core/store";
import { createCore } from "./core/core";
import { createDomView } from "./adapters/dom-view";
import { createTimer } from "./adapters/timer";
import { dependencyVulnKind } from "./kinds/dependency-vuln";
import { pullRequestKind } from "./kinds/pull-request";
import { issueKind } from "./kinds/issue";
import { mountShell } from "./shell/app-shell";

// The one wiring point: register kinds from manifests, build adapters + store, mount the shell as a driving adapter.
export function bootstrap(config: TriageConfigT, scoreOverride?: Scorer) {
  registerKinds([dependencyVulnKind, pullRequestKind, issueKind]);
  const store = createStore();
  const timer = createTimer();
  return mountShell(config, { store, timer, createCore, createDomView, scoreOverride });
}
