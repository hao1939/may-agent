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

import type { Cron } from "./cron.js";
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
import { loadHandlersForAgentCrons } from "./loader/handler-loader.js";
import { activateAgentCrons } from "./cron-activation.js";

export { loadAgentConfig, validateAgentConfig, type AgentConfig, type ValidationError } from "./loader/agent-config.js";
export {
  listAgentDirectories,
  listConfiguredAgentNames,
  listProjectAgentDirectories,
  listRuntimeAgentDirectories,
} from "./loader/agent-discovery.js";
export { buildTools, loadLocalTools } from "./loader/toolset-loader.js";
export { generateAutoHeartbeats } from "./loader/heartbeat-loader.js";
export { loadHandlersForAgentCrons } from "./loader/handler-loader.js";
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

/** Per-agent trigger scheduler instances. Created for agents with the legacy "cron" tool preset. */
const agentCrons = new Map<string, Cron>();

/** Get all trigger scheduler instances (for starting/stopping from may.ts). */
export function getAgentCrons(): Map<string, Cron> {
  return agentCrons;
}

function publishResources(opts: AgentLoaderOptions, generation: PreparedAgentGeneration): AgentGenerationPublication {
  const previousCrons = new Map(agentCrons);
  const previousCleanups = new Map([...agentCleanups].map(([name, cleanups]) => [name, [...cleanups]]));

  try {
    agentCrons.clear();
    for (const [name, cron] of generation.crons) agentCrons.set(name, cron);
    // Keep cleanup callbacks for already-running sessions and add the callbacks
    // captured by the new definitions. They are retired naturally when the
    // corresponding session ends.
    for (const [name, cleanups] of generation.cleanups) {
      const existing = agentCleanups.get(name);
      if (existing) existing.push(...cleanups);
      else agentCleanups.set(name, [...cleanups]);
    }
    if (opts.cronEnabled) activateAgentCrons(generation.crons, opts.bus);
  } catch (error) {
    discardAgentGeneration(generation);
    agentCrons.clear();
    for (const [name, cron] of previousCrons) agentCrons.set(name, cron);
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
      agentCrons.clear();
      for (const [name, cron] of previousCrons) agentCrons.set(name, cron);
      agentCleanups.clear();
      for (const [name, cleanups] of previousCleanups) agentCleanups.set(name, [...cleanups]);
    },
    finalize() {
      if (settled) return;
      settled = true;
      const retained = new Set(generation.crons.values());
      for (const cron of previousCrons.values()) {
        if (!retained.has(cron)) cron.close();
      }
    },
  };
}

function registryRuntime(opts: AgentLoaderOptions) {
  return {
    getAgentSessionId,
    publishResources: (generation: PreparedAgentGeneration) => publishResources(opts, generation),
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
  return loadAgentsFromRegistry(opts, registryRuntime(opts));
}

/** Prepare every definition and side-effect container without publication. */
export async function prepareAgentGeneration(opts: AgentLoaderOptions): Promise<PreparedAgentGeneration> {
  const generation = await prepareAgentsFromRegistry(opts, registryRuntime(opts));
  const handlers = await loadHandlersForAgentCrons({ ...opts, agentCrons: generation.crons });
  if (handlers.errors.length === 0) return generation;
  discardAgentGeneration(generation);
  throw new Error(`Agent handler preparation failed:\n${handlers.errors.map((error) => `  ${error}`).join("\n")}`);
}

/** Publish a prepared generation synchronously; caller finalizes or rolls it back. */
export function publishPreparedAgentGeneration(
  opts: AgentLoaderOptions,
  generation: PreparedAgentGeneration,
): AgentGenerationPublication {
  return publishAgentGenerationFromRegistry(opts, registryRuntime(opts), generation);
}

/**
 * Reload: scan agent.json files, register new agents and update existing ones.
 * Active sessions keep their old config; only new sessions use the updated definition.
 * Returns { added, updated, errors } — errors are reported but don't crash.
 */
export async function reloadAgents(
  opts: AgentLoaderOptions,
): Promise<{ added: string[]; updated: string[]; errors: string[] }> {
  return reloadAgentsFromRegistry(opts, registryRuntime(opts));
}

/**
 * Auto-discover and register handlers for trigger entries.
 *
 * For each agent with a scheduler, scans its cron.json for entries with a
 * `handler` field. String handlers name a file in the handlers/ directory
 * beside that cron.json. Object handlers are workflow-backed and are
 * registered directly.
 *
 * Call this after loadAgents() completes.
 */
export async function loadAgentHandlers(
  opts: AgentLoaderOptions & {
    /** Function to get an agent's active session ID (for followUp). */
    getSessionId: (agentName: string) => string | null;
  },
): Promise<{ registered: string[]; errors: string[] }> {
  return loadHandlersForAgentCrons({ ...opts, agentCrons });
}
