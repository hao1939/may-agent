import { statSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

const configuredRoot = process.env.MAY_AGENT_APP_ROOT?.trim();
if (!configuredRoot || !isAbsolute(configuredRoot)) {
  throw new Error("Deployment checks require MAY_AGENT_APP_ROOT pointing to an explicit absolute App installation.");
}
export const APP_ROOT = resolve(configuredRoot);
for (const directory of ["agents", "projects", "shared"]) {
  if (!statSync(resolve(APP_ROOT, directory)).isDirectory()) {
    throw new Error(`Missing installation directory: ${directory}`);
  }
}
