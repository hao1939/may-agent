import { existsSync, readFileSync } from "node:fs";
import type { MaintenanceEntry } from "./contracts.js";

/** Reject obsolete work declarations explicitly; never silently disable duties. */
export function parseMaintenanceEntries(value: unknown): MaintenanceEntry[] {
  if (!Array.isArray(value)) throw new Error("Maintenance configuration must be an array");
  const names = new Set<string>();
  return value.map((entry: MaintenanceEntry & Record<string, unknown>) => {
    if (!entry || typeof entry.name !== "string" || !entry.name.trim()) {
      throw new Error("Maintenance entry requires a name");
    }
    if (names.has(entry.name)) throw new Error(`Duplicate maintenance entry: ${entry.name}`);
    names.add(entry.name);
    if (typeof entry.handler !== "string" || !entry.handler.trim()) {
      throw new Error(
        `Maintenance ${entry.name} requires a named handler; use App schedules and Tasks for model/workflow work`,
      );
    }
    for (const field of ["category", "message", "preflight", "maxConcurrentTriggers", "maxQueueDepth"]) {
      if (entry[field] !== undefined)
        throw new Error(`Maintenance ${entry.name}: obsolete field ${field}; use App schedules and Tasks for work`);
    }
    if (entry.enabled !== undefined && typeof entry.enabled !== "boolean") {
      throw new Error(`Maintenance ${entry.name}: enabled must be boolean`);
    }
    if (
      entry.on !== undefined &&
      (!Array.isArray(entry.on) || entry.on.some((type) => typeof type !== "string" || !type.trim()))
    ) {
      throw new Error(`Maintenance ${entry.name}: on must contain event types`);
    }
    if (entry.intervalMs === undefined && !entry.on?.length) {
      throw new Error(`Maintenance ${entry.name} needs an interval or event subscription`);
    }
    if (entry.intervalMs !== undefined && (!Number.isFinite(entry.intervalMs) || entry.intervalMs < 10_000)) {
      throw new Error(`Maintenance ${entry.name}: intervalMs must be at least 10000`);
    }
    for (const field of ["timeoutMs", "offsetMs"] as const) {
      const delay = entry[field];
      if (delay !== undefined && (!Number.isFinite(delay) || delay < (field === "timeoutMs" ? 1 : 0))) {
        throw new Error(`Maintenance ${entry.name}: invalid ${field}`);
      }
    }
    return entry;
  });
}

export function readMaintenanceEntries(path: string): MaintenanceEntry[] {
  return existsSync(path) ? parseMaintenanceEntries(JSON.parse(readFileSync(path, "utf8"))) : [];
}
