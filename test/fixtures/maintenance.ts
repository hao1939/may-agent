import { writeFileSync } from "node:fs";
import type { HostMaintenance } from "../../src/app/adapters/maintenance/runtime.js";
import type { MaintenanceEntry } from "../../src/app/adapters/maintenance/contracts.js";

/** Exercise actual configuration/reload rather than a synthetic production API. */
export function configureMaintenance(runtime: HostMaintenance, entry: MaintenanceEntry): void {
  const configured = { ...entry, ...(!entry.intervalMs && !entry.on?.length ? { on: ["fixture.manual"] } : {}) };
  const entries = runtime.getEntries().filter((previous) => previous.name !== entry.name);
  writeFileSync(runtime.getConfigPath(), JSON.stringify([...entries, configured]));
  runtime.reload();
}
