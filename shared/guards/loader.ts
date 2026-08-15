import type { Demand, WorkflowGuard, WorkflowGuardEvent } from "@may-agent/sdk";

/**
 * Guard Loader — dynamically imports all WorkflowGuard exports from this directory.
 *
 * Used by the workflow engine (run-workflow handler) to enforce guards at runtime.
 * Each guard file must export `guard: WorkflowGuard`.
 *
 * See REGISTRY.md for the full list of available guards.
 */

import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

let cachedGuards: WorkflowGuard[] | null = null;
let importCounter = 0;

/**
 * Load all guards from the guards directory.
 * Results are cached after first call.
 */
export async function loadGuards(log?: (msg: string) => void): Promise<WorkflowGuard[]> {
  if (cachedGuards) return cachedGuards;

  const guards: WorkflowGuard[] = [];
  const files = readdirSync(__dirname)
    .filter((f) => f.endsWith(".ts") && f !== "loader.ts" && f !== "REGISTRY.md")
    .sort();

  for (const file of files) {
    try {
      const mod = await import(join(__dirname, file) + "?t=" + ++importCounter);
      if (mod.guard && typeof mod.guard.handle === "function" && typeof mod.guard.name === "string") {
        guards.push(mod.guard);
        log?.(`[guard-loader] Loaded guard: ${mod.guard.name} (${file})`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log?.(`[guard-loader] WARN: Failed to load guard from ${file}: ${msg}`);
    }
  }

  cachedGuards = guards;
  return guards;
}

/**
 * Run all loaded guards against a workflow event.
 * Returns aggregated demands from all guards.
 */
export async function runGuards(
  event: WorkflowGuardEvent,
  log?: (msg: string) => void,
): Promise<Demand[]> {
  const guards = await loadGuards(log);
  const demands: Demand[] = [];

  for (const guard of guards) {
    // Skip guards that don't listen for this event type
    if (guard.events && !guard.events.includes(event.type)) continue;

    try {
      const result = guard.handle(event);
      if (Array.isArray(result) && result.length > 0) {
        for (const d of result) {
          log?.(`[guard:${guard.name}] ${d.type}: ${d.reason}`);
        }
        demands.push(...result);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log?.(`[guard:${guard.name}] ERROR in handle(): ${msg}`);
    }
  }

  return demands;
}

/**
 * Clear cached guards (for testing or hot-reload).
 */
export function clearGuardCache(): void {
  cachedGuards = null;
}
