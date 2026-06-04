import { config } from "virtual:triagekit-config";
import { score } from "virtual:triagekit-hooks";
import { mountShell } from "./shell/app-shell";

mountShell(config, score);
