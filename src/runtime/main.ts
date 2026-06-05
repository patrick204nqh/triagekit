import { config } from "virtual:triagekit-config";
import { score } from "virtual:triagekit-hooks";
import { mountShell } from "./shell/app-shell";
import { applyTheme, watchSystemTheme } from "./shell/theme";

applyTheme();          // resolve persisted/system choice (bootstrap already set it pre-paint)
watchSystemTheme();    // keep "auto" live across OS light/dark flips
mountShell(config, score);
