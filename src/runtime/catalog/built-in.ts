import { changeRequestKind } from "../kinds/change-request";
import { codeScanningKind } from "../kinds/code-scanning";
import { dependencyVulnKind } from "../kinds/dependency-vuln";
import { issueKind } from "../kinds/issue";
import { upcomingKinds } from "../kinds/upcoming";
import { runtimeDefaults } from "./defaults";
import { createRuntimeCatalog } from "./runtime-catalog";

export const runtimeCatalog = createRuntimeCatalog({
  kinds: [
    dependencyVulnKind,
    codeScanningKind,
    changeRequestKind,
    issueKind,
    ...upcomingKinds,
  ],
  providers: [],
  defaults: runtimeDefaults,
});
