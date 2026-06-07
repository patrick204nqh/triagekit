import "./views/code-security/view";        // register dependency-vuln view + source + charts + sort-key
import "./views/code-review/view";          // register review surface + github-review source
import "./views/code-security/code-scanning"; // register code-scanning view + source + charts
import "./ingest/upcoming";              // register roadmap sources
import "./layout/due-soon";              // register the Due soon tab
import type { TriageConfigT } from "../config/schema";
import type { Scorer } from "./scoring/registry";
import type { Core } from "./core/core";
import { registerKinds } from "./core/register-kinds";
import { createStore } from "./core/store";
import { createCore } from "./core/core";
import { createDomView } from "./adapters/dom-view";
import { createTimer } from "./adapters/timer";
import { dependencyVulnKind } from "./kinds/dependency-vuln";
import { codeScanningKind } from "./kinds/code-scanning";
import { changeRequestKind } from "./kinds/change-request";
import { issueKind } from "./kinds/issue";
import { mountShell } from "./shell/app-shell";
import { installAvatarFallback } from "./layout/avatar-fallback";

// The one wiring point: register kinds from manifests, build adapters + store, mount the shell as a driving adapter.
export function bootstrap(config: TriageConfigT, scoreOverride?: Scorer): Core {
  installAvatarFallback();
  registerKinds([dependencyVulnKind, codeScanningKind, changeRequestKind, issueKind]);
  const store = createStore();
  const timer = createTimer();
  return mountShell(config, { store, timer, createCore, createDomView, scoreOverride });
}
