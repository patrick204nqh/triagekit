import { changeRequestKind } from "../kinds/change-request";
import { codeScanningKind } from "../kinds/code-scanning";
import { dependencyVulnKind } from "../kinds/dependency-vuln";
import { issueKind } from "../kinds/issue";
import { upcomingKinds } from "../kinds/upcoming";
import type { ProviderDeclaration } from "./types";
import { runtimeDefaults } from "./defaults";
import { createRuntimeCatalog } from "./runtime-catalog";

const builtInKinds = [
  dependencyVulnKind,
  codeScanningKind,
  changeRequestKind,
  issueKind,
  ...upcomingKinds,
] as const;

export const createBuiltInCatalog = (
  providers: readonly ProviderDeclaration[] = [],
) => createRuntimeCatalog({
  kinds: builtInKinds,
  providers,
  defaults: runtimeDefaults,
});

export const runtimeCatalog = createBuiltInCatalog();
