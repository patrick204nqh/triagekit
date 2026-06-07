import { config } from "virtual:triagekit-config";
import { score } from "virtual:triagekit-hooks";
import { bootstrap } from "./bootstrap";
import { applyTheme, watchSystemTheme } from "./shell/theme";

applyTheme();          // resolve persisted/system choice (bootstrap already set it pre-paint)
watchSystemTheme();    // keep "auto" live across OS light/dark flips
bootstrap(config, score);
