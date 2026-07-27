import type { TriageConfigT } from "../config/schema";
import { createDomView } from "./adapters/dom-view";
import { createBrowserSessionUrl } from "./adapters/browser-session-url";
import { createTimer } from "./adapters/timer";
import { runtimeDefaults } from "./catalog/defaults";
import { createRuntimeCatalog } from "./catalog/runtime-catalog";
import type { RuntimeCatalog, Scorer } from "./catalog/types";
import type { Core } from "./core/core";
import { createCore } from "./core/core";
import { createStore } from "./core/store";
import { codeScanningKind } from "./kinds/code-scanning";
import { changeRequestKind } from "./kinds/change-request";
import { dependencyVulnKind } from "./kinds/dependency-vuln";
import { issueKind } from "./kinds/issue";
import { upcomingKinds } from "./kinds/upcoming";
import { installAvatarFallback } from "./layout/atoms/avatar-fallback";
import { createGithubProvider } from "./providers/github/provider";
import { upcomingProviders } from "./providers/upcoming";
import { mountShell } from "./shell/app-shell";
import { createTriageSession } from "./session/triage-session";

export function createProductionCatalog(
  fetchImpl: typeof fetch,
): RuntimeCatalog {
  return createRuntimeCatalog({
    kinds: [
      dependencyVulnKind,
      codeScanningKind,
      changeRequestKind,
      issueKind,
      ...upcomingKinds,
    ],
    providers: [createGithubProvider(fetchImpl), ...upcomingProviders],
    defaults: runtimeDefaults,
  });
}

// The one wiring point: compose the catalog, build adapters + store, and mount the shell.
export function bootstrap(config: TriageConfigT, scoreOverride?: Scorer): Core {
  installAvatarFallback();
  const store = createStore();
  const timer = createTimer();
  const catalog = createProductionCatalog(fetch);
  const session = createTriageSession({ catalog });
  const sessionUrl = createBrowserSessionUrl(window);

  return mountShell(config, {
    store,
    timer,
    createCore,
    createDomView,
    scoreOverride,
    catalog,
    session,
    sessionUrl,
  });
}
