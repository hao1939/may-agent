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
import {
  loadAgents as loadAgentsFromRegistry,
  reloadAgents as reloadAgentsFromRegistry,
  type AgentLoaderOptions,
} from "./loader/agent-registry-loader.js";
import { loadHandlersForAgentCrons } from "./loader/handler-loader.js";

export { loadAgentConfig, validateAgentConfig, type AgentConfig, type ValidationError } from "./loader/agent-config.js";
export { listAgentDirectories, listConfiguredAgentNames, listProjectAgentDirectories, listRuntimeAgentDirectories } from "./loader/agent-discovery.js";
export { buildTools, loadLocalTools } from "./loader/toolset-loader.js";
export { generateAutoHeartbeats } from "./loader/heartbeat-loader.js";
export { loadHandlersForAgentCrons } from "./loader/handler-loader.js";
export type { AgentLoaderOptions, LoadResult } from "./loader/agent-registry-loader.js";

// ── Track active session IDs for subagent/workflow tools ────────────────

/** Per-agent session ID tracking. Updated by session.start bus event. */
const agentSessionIds = new Map<string, string>();

export function getAgentSessionId(name: string): string | undefined {
  return agentSessionIds.get(name);
}

export function setAgentSessionId(name: string, sid: string): void {
  agentSessionIds.set(name, sid);
}

// ── Tool factories ──────────────────────────────────────────────────────

/** Per-agent cleanup functions. Called when agent sessions end. */
const agentCleanups = new Map<string, Array<() => void>>();

/** Per-agent cron instances. Created for agents with the "cron" tool preset. */
const agentCrons = new Map<string, Cron>();

/** Get all cron instances (for starting/stopping from may.ts). */
export function getAgentCrons(): Map<string, Cron> {
  return agentCrons;
}

/** Register a cleanup function for an agent. */
function addCleanup(agentName: string, fn: () => void): void {
  const existing = agentCleanups.get(agentName);
  if (existing) {
    existing.push(fn);
  } else {
    agentCleanups.set(agentName, [fn]);
  }
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
  return loadAgentsFromRegistry(opts, {
    getAgentSessionId,
    getAgentCrons,
    setAgentCron: (agentName, cron) => agentCrons.set(agentName, cron),
    addCleanup,
  });
}

/**
 * Reload: scan agent.json files, register new agents and update existing ones.
 * Active sessions keep their old config; only new sessions use the updated definition.
 * Returns { added, updated, errors } — errors are reported but don't crash.
 */
export async function reloadAgents(
  opts: AgentLoaderOptions,
): Promise<{ added: string[]; updated: string[]; errors: string[] }> {
  return reloadAgentsFromRegistry(opts, {
    getAgentSessionId,
    getAgentCrons,
    setAgentCron: (agentName, cron) => agentCrons.set(agentName, cron),
    addCleanup,
  });
}

/**
 * Auto-discover and register JS handlers for cron entries.
 *
 * For each agent with a cron, scans its cron.json for entries with a `handler`
 * field. The handler field names a file in agents/<name>/handlers/<handler>.js.
 * The file must export { create } conforming to HandlerModule.
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
