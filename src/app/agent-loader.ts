/**
 * Dynamic agent loader.
 *
 * Scans agents/ for agent.json configs and registers them with SubagentManager.
 * Tool presets map strings like "coding", "agents", "workflow" to actual tool
 * constructors. Adding a new agent = create agents/<name>/agent.json + restart
 * (or send reload_agents command).
 *
 * Convention-based paths:
 *   agents/<name>/knowledge/   → knowledgeDir
 *   agents/<name>/workspace/   → workspace
 *   agents/<name>/workflows/   → workflowDir (if exists)
 *
 * System prompt is assembled from:
 *   shared/common-sense.md + agents/<name>/AGENTS.md + generated runtime facts
 * The order is intentional: shared defaults first, then agent identity as the
 * more specific layer for role-specific behavior.
 * Domain files, skills, lessons, and knowledge indexes are read on demand.
 */

import type { HostMaintenance } from "./adapters/maintenance/runtime.js";
import { log } from "../lib/log.js";
import { currentAgentSessionId } from "../lib/agent-session-context.js";
import {
  loadAgents as loadAgentsFromRegistry,
  prepareAgents as prepareAgentsFromRegistry,
  publishAgentGeneration as publishAgentGenerationFromRegistry,
  reloadAgents as reloadAgentsFromRegistry,
  discardAgentGeneration,
  type AgentGenerationPublication,
  type AgentLoaderOptions,
  type PreparedAgentGeneration,
} from "./loader/agent-registry-loader.js";
import { loadMaintenanceHandlers } from "./adapters/maintenance/handler-loader.js";

export { loadAgentConfig, validateAgentConfig, type AgentConfig, type ValidationError } from "./loader/agent-config.js";
export {
  listAgentDirectories,
  listConfiguredAgentNames,
  listProjectAgentDirectories,
  listRuntimeAgentDirectories,
} from "./loader/agent-discovery.js";
export { buildTools, loadLocalTools } from "./loader/toolset-loader.js";
export { loadMaintenanceHandlers } from "./adapters/maintenance/handler-loader.js";
export type { AgentLoaderOptions, LoadResult } from "./loader/agent-registry-loader.js";

// ── Track active session IDs for subagent/workflow tools ────────────────

/** Per-agent session ID tracking. Updated by session.start bus event. */
const agentSessionIds = new Map<string, string>();

export function getAgentSessionId(name: string): string | undefined {
  return currentAgentSessionId(name) ?? agentSessionIds.get(name);
}

export function setAgentSessionId(name: string, sid: string): void {
  agentSessionIds.set(name, sid);
}

// ── Tool factories ──────────────────────────────────────────────────────

/** Per-agent cleanup functions. Called when agent sessions end. */
const agentCleanups = new Map<string, Array<() => void>>();

/** Prepared Host-maintenance instances, independent of agent tool presets. */
const agentMaintenance = new Map<string, HostMaintenance>();

/** Get all trigger scheduler instances (for starting/stopping from may.ts). */
export function getAgentMaintenance(): Map<string, HostMaintenance> {
  return agentMaintenance;
}

function publishResources(generation: PreparedAgentGeneration): AgentGenerationPublication {
  const previousCrons = new Map(agentMaintenance);
  const previousCleanups = new Map([...agentCleanups].map(([name, cleanups]) => [name, [...cleanups]]));

  try {
    agentMaintenance.clear();
    for (const [name, cron] of generation.maintenance) agentMaintenance.set(name, cron);
    // Keep cleanup callbacks for already-running sessions and add the callbacks
    // captured by the new definitions. They are retired naturally when the
    // corresponding session ends.
    for (const [name, cleanups] of generation.cleanups) {
      const existing = agentCleanups.get(name);
      if (existing) existing.push(...cleanups);
      else agentCleanups.set(name, [...cleanups]);
    }
  } catch (error) {
    discardAgentGeneration(generation);
    agentMaintenance.clear();
    for (const [name, cron] of previousCrons) agentMaintenance.set(name, cron);
    agentCleanups.clear();
    for (const [name, cleanups] of previousCleanups) agentCleanups.set(name, [...cleanups]);
    throw error;
  }

  let settled = false;
  return {
    rollback() {
      if (settled) return;
      settled = true;
      discardAgentGeneration(generation);
      agentMaintenance.clear();
      for (const [name, cron] of previousCrons) agentMaintenance.set(name, cron);
      agentCleanups.clear();
      for (const [name, cleanups] of previousCleanups) agentCleanups.set(name, [...cleanups]);
    },
    finalize() {
      if (settled) return;
      settled = true;
      const retained = new Set(generation.maintenance.values());
      for (const cron of previousCrons.values()) {
        if (!retained.has(cron)) cron.close();
      }
    },
  };
}

function registryRuntime() {
  return {
    getAgentSessionId,
    publishResources,
  };
}

/** Run all cleanup functions for an agent and clear the list. */
export function runAgentCleanup(agentName: string): void {
  const fns = agentCleanups.get(agentName);
  if (!fns) return;
  for (const fn of fns) {
    try {
      fn();
    } catch {
      /* best-effort */
    }
  }
  agentCleanups.delete(agentName);
}

/**
 * Scan agents/ directory, load and validate agent.json configs, register with manager.
 * Re-registers existing agents so config changes (model, tools, etc.)
 * take effect on next session. Active sessions keep their old config.
 */
export async function loadAgents(opts: AgentLoaderOptions) {
  return loadAgentsFromRegistry(opts, registryRuntime());
}

/** Prepare every definition and side-effect container without publication. */
export async function prepareAgentGeneration(opts: AgentLoaderOptions): Promise<PreparedAgentGeneration> {
  const generation = await prepareAgentsFromRegistry(opts, registryRuntime());
  const handlers = await loadMaintenanceHandlers({ ...opts, agentMaintenance: generation.maintenance });
  if (handlers.errors.length === 0) return generation;
  discardAgentGeneration(generation);
  throw new Error(`Agent handler preparation failed:\n${handlers.errors.map((error) => `  ${error}`).join("\n")}`);
}

/** Publish a prepared generation synchronously; caller finalizes or rolls it back. */
export function publishPreparedAgentGeneration(
  opts: AgentLoaderOptions,
  generation: PreparedAgentGeneration,
): AgentGenerationPublication {
  return publishAgentGenerationFromRegistry(opts, registryRuntime(), generation);
}

/**
 * Reload: scan agent.json files, register new agents and update existing ones.
 * Active sessions keep their old config; only new sessions use the updated definition.
 * Returns { added, updated, errors } — errors are reported but don't crash.
 */
export async function reloadAgents(
  opts: AgentLoaderOptions,
): Promise<{ added: string[]; updated: string[]; errors: string[] }> {
  return reloadAgentsFromRegistry(opts, registryRuntime());
}

/** Prepare legacy handlers without attaching routes or starting timers. */
export async function prepareAgentTriggers(loaderOpts: AgentLoaderOptions): Promise<void> {
  const { bus } = loaderOpts;
  const handlerResult = await loadMaintenanceHandlers({ ...loaderOpts, agentMaintenance });
  if (handlerResult.registered.length > 0) {
    bus.emit({
      type: "info",
      message: `[handlers] Registered ${handlerResult.registered.length}: ${handlerResult.registered.join(", ")}`,
    });
  }
  if (handlerResult.errors.length > 0) {
    bus.emit({
      type: "info",
      message: `[handlers] ${handlerResult.errors.length} error(s): ${handlerResult.errors.join("; ")}`,
    });
    for (const err of handlerResult.errors) {
      const handlerName = err.match(/"(\w[\w-]*)\.(js|ts)"/)?.[1] ?? err.match(/"([^"]+)"/)?.[1] ?? "unknown";
      log("warn", `[handlers] Failed to load handler "${handlerName}": ${err}`);
    }
  }
}
