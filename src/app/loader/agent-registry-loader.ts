import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { ModelWithApiKey } from "../../lib/types.js";
import type { SubagentManager } from "../../lib/index.js";
import type { Cron } from "../cron.js";
import type { EventBus } from "../event-bus.js";
import { loadAgentConfig, validateAgentConfig, type ValidationError } from "./agent-config.js";
import { listAgentDirectories } from "./agent-discovery.js";
import { buildTools } from "./toolset-loader.js";

export interface AgentLoaderOptions {
  agentsRoot: string;
  projectRoot: string;
  persistDir: string;
  models: Record<string, ModelWithApiKey>;
  manager: SubagentManager;
  bus: EventBus;
  cronEnabled: boolean;
}

export interface LoadResult {
  added: string[];
  updated: string[];
}

export interface AgentRegistryRuntime {
  getAgentSessionId: (agentName: string) => string | undefined;
  getAgentCrons: () => Map<string, Cron>;
  setAgentCron: (agentName: string, cron: Cron) => void;
  addCleanup: (agentName: string, fn: () => void) => void;
}

/**
 * Scan agents/ directory, load and validate agent.json configs, register with manager.
 * Re-registers existing agents so config changes take effect on next session.
 * Active sessions keep their old config.
 */
export async function loadAgents(
  opts: AgentLoaderOptions,
  runtime: AgentRegistryRuntime,
): Promise<LoadResult> {
  const { agentsRoot, projectRoot, models, manager } = opts;
  const added: string[] = [];
  const updated: string[] = [];
  const allErrors: ValidationError[] = [];

  for (const { dir: agentDir } of listAgentDirectories(agentsRoot)) {
    const config = loadAgentConfig(agentDir, opts.bus);
    if (!config) continue;

    const errors = validateAgentConfig(config, models, agentsRoot);
    if (errors.length > 0) {
      allErrors.push(...errors);
      continue;
    }

    const isUpdate = manager.hasAgent(config.name);
    const model = models[config.model];
    const knowledgeDir = resolve(agentDir, "knowledge");
    const workspace = resolve(agentDir, "workspace");

    manager.register({
      name: config.name,
      description: config.description,
      domain: config.domain,
      model,
      tools: await buildTools(config, {
        ...opts,
        getAgentSessionId: runtime.getAgentSessionId,
        getAgentCrons: runtime.getAgentCrons,
        setAgentCron: runtime.setAgentCron,
        addCleanup: runtime.addCleanup,
      }),
      agentDir,
      knowledgeDir: existsSync(knowledgeDir) ? knowledgeDir : undefined,
      workspace: existsSync(workspace) ? workspace : undefined,
      projectRoot,
      apiKey: model.apiKey,
      memoryLimit: config.memoryLimit,
      compaction: config.compaction,
      contextFiles: config.context_files?.map((f) => resolve(agentDir, f)),
    });

    if (isUpdate) {
      updated.push(config.name);
    } else {
      added.push(config.name);
    }
  }

  if (allErrors.length > 0) {
    const report = allErrors.map((e) => `  ${e.agent}.${e.field}: ${e.message}`).join("\n");
    opts.bus.emit({ type: "info", message: `[loader] Skipped agents with config errors:\n${report}` });
    opts.bus.emit({
      type: "agent.config_invalid",
      owner: "may",
      count: allErrors.length,
      errors: allErrors,
      message: `Skipped agents with config errors:\n${report}`,
      priority: "P0",
    });
  }

  return { added, updated };
}

/**
 * Reload definitions for future sessions. Active sessions keep their old
 * prompt, tools, model, and runtime context.
 */
export async function reloadAgents(
  opts: AgentLoaderOptions,
  runtime: AgentRegistryRuntime,
): Promise<{ added: string[]; updated: string[]; errors: string[] }> {
  try {
    const result = await loadAgents(opts, runtime);
    return { ...result, errors: [] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { added: [], updated: [], errors: [msg] };
  }
}
