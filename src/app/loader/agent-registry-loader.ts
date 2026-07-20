import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { ModelWithApiKey } from "../../lib/types.js";
import type { SubagentManager } from "../../lib/index.js";
import type { Cron } from "../cron.js";
import type { EventBus } from "../event-bus.js";
import { loadAgentConfig, validateAgentConfig, type ValidationError } from "./agent-config.js";
import {
  agentProjectRoot,
  agentRelativeDir,
  agentsRootForAgentDir,
  listRuntimeAgentDirectories,
} from "./agent-discovery.js";
import { buildTools } from "./toolset-loader.js";
import { buildAgentDefinition } from "./agent-definition.js";

export interface AgentLoaderOptions {
  agentsRoot: string;
  sharedRoot: string;
  projectsRoot: string;
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
export async function loadAgents(opts: AgentLoaderOptions, runtime: AgentRegistryRuntime): Promise<LoadResult> {
  const { agentsRoot, projectRoot, projectsRoot, models, manager } = opts;
  const added: string[] = [];
  const updated: string[] = [];
  const allErrors: ValidationError[] = [];

  const seen = new Map<string, string>();

  for (const agentSource of listRuntimeAgentDirectories(agentsRoot, projectsRoot)) {
    const agentDir = agentSource.dir;
    const config = loadAgentConfig(agentDir, opts.bus);
    if (!config) continue;

    const errors = validateAgentConfig(config, models, agentsRoot);
    const priorDir = seen.get(config.name);
    if (priorDir) {
      // Project-app agents override global stubs: if the prior registration came
      // from agents/<name> and this one comes from projects/*.app/agents/<name>,
      // treat it as a silent override rather than an error.
      const priorIsGlobal = priorDir.startsWith("agents/");
      const currentIsProjectApp = !!agentSource.projectId;
      if (priorIsGlobal && currentIsProjectApp) {
        // Override: let the project-app agent win. Remove the old seen entry
        // so registration proceeds below.
        seen.delete(config.name);
      } else {
        errors.push({
          agent: config.name,
          field: "name",
          message: `Duplicate agent name. Already loaded from ${priorDir}; duplicate at ${agentRelativeDir(agentSource)}`,
        });
      }
    }
    if (errors.length > 0) {
      allErrors.push(...errors);
      continue;
    }
    seen.set(config.name, agentRelativeDir(agentSource));

    // F2: detect cron.json present but `cron` tool missing. The tool gate at
    // toolset-loader.ts:148 silently skips cron.json when the agent's
    // config.tools doesn't include "cron". Surface this as a warning so the
    // agent author sees their cron entries are being ignored.
    if (existsSync(resolve(agentDir, "cron.json")) && !(config.tools ?? []).includes("cron")) {
      opts.bus.emit({
        type: "info",
        message: `[loader] ${config.name}: cron.json found at ${agentRelativeDir(agentSource)}/cron.json but "cron" is not in agent.json tools[]; entries will be IGNORED. Add "cron" to tools to enable.`,
      });
    }

    const isUpdate = manager.hasAgent(config.name);
    const model = models[config.model];
    const effectiveProjectRoot = agentProjectRoot(agentSource, projectRoot);
    const definition = await buildAgentDefinition({
      config,
      source: agentSource,
      model,
      tools: await buildTools(config, {
        ...opts,
        projectRoot: effectiveProjectRoot,
        agentsRoot: agentsRootForAgentDir(agentSource),
        globalAgentsRoot: agentsRoot,
        agentDir,
        getAgentSessionId: runtime.getAgentSessionId,
        getAgentCrons: runtime.getAgentCrons,
        setAgentCron: runtime.setAgentCron,
        addCleanup: runtime.addCleanup,
      }),
      projectRoot: effectiveProjectRoot,
      sharedRoot: opts.sharedRoot,
      globalAgentsRoot: agentsRoot,
    });
    if (definition.skillCatalog?.diagnostics.length) {
      const skillErrors: ValidationError[] = definition.skillCatalog.diagnostics.map((message) => ({
        agent: config.name,
        field: "skills",
        message,
      }));
      const report = skillErrors.map((error) => `  ${error.agent}.${error.field}: ${error.message}`).join("\n");
      opts.bus.emit({ type: "info", message: `[loader] Skill diagnostics:\n${report}` });
      opts.bus.emit({
        type: "agent.config_invalid",
        source: "loader",
        owner: "agent:may",
        urgency: "immediate",
        data: {
          count: skillErrors.length,
          errors: skillErrors,
          message: `Skill diagnostics:\n${report}`,
          priority: "P0",
        },
      });
    }

    manager.register(definition);

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
      source: "loader",
      owner: "agent:may",
      urgency: "immediate",
      data: {
        count: allErrors.length,
        errors: allErrors,
        message: `Skipped agents with config errors:\n${report}`,
        priority: "P0",
      },
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
