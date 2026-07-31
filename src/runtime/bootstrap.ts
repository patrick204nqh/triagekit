import type { TriageConfigT } from "../config/schema";
import { createDomView } from "./adapters/dom-view";
import { createBrowserSessionUrl } from "./adapters/browser-session-url";
import { createBuiltInCatalog } from "./catalog/built-in";
import type { Scorer } from "./catalog/types";
import { createCore } from "./core/core";
import { createBrowserConnectionState } from "./cached-dataset/browser-connection-state";
import { createCachedDatasets } from "./cached-dataset/cached-datasets";
import {
  createFallbackDatasetPersistence,
  type FallbackDatasetPersistence,
} from "./cached-dataset/fallback-persistence";
import { installAvatarFallback } from "./layout/atoms/avatar-fallback";
import { createGithubProvider } from "./providers/github/provider";
import { upcomingProviders } from "./providers/upcoming";
import { mountShell, type ShellCore } from "./shell/app-shell";
import { createTriageSession } from "./session/triage-session";

// The one wiring point: compose the catalog, build adapters + store, and mount the shell.
const createLazyBrowserPersistence = (): FallbackDatasetPersistence => {
  let resolved: FallbackDatasetPersistence | undefined;
  const pending = createFallbackDatasetPersistence().then((persistence) => {
    resolved = persistence;
    return persistence;
  });
  return {
    activateGeneration: (...args) =>
      pending.then((persistence) => persistence.activateGeneration(...args)),
    hydrate: (...args) =>
      pending.then((persistence) => persistence.hydrate(...args)),
    commit: (...args) =>
      pending.then((persistence) => persistence.commit(...args)),
    touch: (...args) =>
      pending.then((persistence) => persistence.touch(...args)),
    removeConnection: (...args) =>
      pending.then((persistence) => persistence.removeConnection(...args)),
    prune: (...args) =>
      pending.then((persistence) => persistence.prune(...args)),
    mode: () => resolved?.mode() ?? "indexeddb",
    warning: () => resolved?.warning(),
  };
};

export function bootstrap(
  config: TriageConfigT,
  scoreOverride?: Scorer,
): ShellCore {
  installAvatarFallback();
  const github = createGithubProvider(fetch);
  const catalog = createBuiltInCatalog([github, ...upcomingProviders]);
  const persistence = createLazyBrowserPersistence();
  const datasets = createCachedDatasets({
    providers: [github],
    persistence,
    connectionState: createBrowserConnectionState(),
  });
  const session = createTriageSession({ catalog });
  const sessionUrl = createBrowserSessionUrl(window);

  return mountShell(config, {
    datasets,
    createCore,
    createDomView,
    scoreOverride,
    catalog,
    session,
    sessionUrl,
  });
}
