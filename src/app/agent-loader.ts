/**
 * Dynamic agent loader.
 *
 * Scans agents/ for agent.json configs and registers them with SubagentManager.
 * Tool presets map strings like "coding", "agents", "finish" to actual tool
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

import { currentAgentSessionId } from "../lib/agent-session-context.js";
import {
  loadAgents as loadAgentsFromRegistry,
  prepareAgents as prepareAgentsFromRegistry,
  publishAgentGeneration as publishAgentGenerationFromRegistry,
  reloadAgents as reloadAgentsFromRegistry,
  type AgentGenerationPublication,
  type AgentLoaderOptions,
  type PreparedAgentGeneration,
} from "./loader/agent-registry-loader.js";

export { loadAgentConfig, validateAgentConfig, type AgentConfig, type ValidationError } from "./loader/agent-config.js";
export {
  listAgentDirectories,
  listConfiguredAgentNames,
  listProjectAgentDirectories,
  listRuntimeAgentDirectories,
} from "./loader/agent-discovery.js";
export type { AgentLoaderOptions, LoadResult } from "./loader/agent-registry-loader.js";
export { buildTools, loadLocalTools } from "./loader/toolset-loader.js";

// ── Track active session IDs for subagent/workflow tools ────────────────

/** Per-agent session ID tracking. Updated by session.start bus event. */
const agentSessionIds = new Map<string, string>();

export function getAgentSessionId(name: string): string | undefined {
  return currentAgentSessionId(name) ?? agentSessionIds.get(name);
}

export function setAgentSessionId(name: string, sid: string): void {
  agentSessionIds.set(name, sid);
}

function registryRuntime() {
  return {
    getAgentSessionId,
  };
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
  return prepareAgentsFromRegistry(opts, registryRuntime());
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
