import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { SubagentManager } from "../../lib/manager.js";
import { readFileWritePolicy } from "../../lib/tools/file-write-policy.js";
import type { ModelWithApiKey, SubagentDefinition } from "../../lib/types.js";
import type { AppRegistry } from "../core/apps/registry.js";
import type { EventBus } from "../core/events/bus.js";
import { readAgentConfigFile, validateAgentConfig, type AgentConfig, type ValidationError } from "./agent-config.js";
import { buildAgentDefinition } from "./agent-definition.js";
import { agentProjectRoot, agentsRootForAgentDir, listRuntimeAgentDirectories } from "./agent-discovery.js";
import { buildTools } from "./toolset-loader.js";

export interface AgentLoaderOptions {
  /** Published App addresses; discovery does not depend on Task scheduling. */
  appRegistry?: AppRegistry;
  agentsRoot: string;
  sharedRoot: string;
  /** Immutable prompt and shared-skill root for this definition generation. */
  definitionSharedRoot?: string;
  projectsRoot: string;
  /** Live installation folders own .disabled markers, not immutable source snapshots. */
  canonicalProjectsRoot?: string;
  /** App folders selected for this generation; never re-read live markers in its tools/workers. */
  appDirectories?: readonly string[];
  projectRoot: string;
  persistDir: string;
  models: Record<string, ModelWithApiKey>;
  manager: SubagentManager;
  bus: EventBus;
  /** Load only these exact agents in a short-lived execution worker. */
  agentNames?: readonly string[];
}

export interface LoadResult {
  added: string[];
  updated: string[];
}

export interface PreparedAgentGeneration extends LoadResult {
  definitions: readonly SubagentDefinition[];
}

export interface AgentGenerationPublication {
  rollback(): void;
  finalize(): void;
}

export interface AgentRegistryRuntime {
  getAgentSessionId: (agentName: string) => string | undefined;
}

function validationReport(errors: readonly ValidationError[]): string {
  return errors.map((error) => `  ${error.agent}.${error.field}: ${error.message}`).join("\n");
}

function reportInvalidGeneration(bus: EventBus, errors: readonly ValidationError[]): void {
  if (errors.length === 0) return;
  const report = validationReport(errors);
  bus.emit({ type: "info", message: `[loader] Agent generation rejected:\n${report}` });
  bus.emit({
    type: "agent.config_invalid",
    source: "loader",
    owner: "system:host",
    urgency: "immediate",
    data: {
      count: errors.length,
      errors: [...errors],
      message: `Agent generation rejected:\n${report}`,
      priority: "P0",
    },
  });
}

function readCandidate(agentDir: string, fallbackName: string, errors: ValidationError[]): AgentConfig | null {
  try {
    return readAgentConfigFile(agentDir);
  } catch (error) {
    errors.push({
      agent: fallbackName,
      field: "agent.json",
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Discover and build one complete agent generation without changing manager,
 * cleanup, or App state. Any validation or skill diagnostic rejects the
 * whole generation.
 */
export async function prepareAgents(
  opts: AgentLoaderOptions,
  runtime: AgentRegistryRuntime,
): Promise<PreparedAgentGeneration> {
  const { agentsRoot, projectRoot, projectsRoot, models, manager } = opts;
  const fileWritePolicy = readFileWritePolicy(opts.definitionSharedRoot ?? opts.sharedRoot ?? resolve(opts.projectRoot, "shared"), opts.projectRoot);
  const allErrors: ValidationError[] = [];
  const requestedNames = opts.agentNames ? new Set(opts.agentNames.map((name) => name.trim()).filter(Boolean)) : null;
  const selected = new Map<
    string,
    { config: AgentConfig; source: ReturnType<typeof listRuntimeAgentDirectories>[number] }
  >();

  for (const source of listRuntimeAgentDirectories(
    agentsRoot,
    projectsRoot,
    opts.canonicalProjectsRoot,
    opts.appDirectories,
  )) {
    const config = readCandidate(source.dir, source.name, allErrors);
    if (!config) continue;
    if (requestedNames && !requestedNames.has(config.name)) continue;
    allErrors.push(...validateAgentConfig(config, models, agentsRoot));

    const prior = selected.get(config.name);
    if (prior) {
      const priorIsGlobal = !prior.source.projectId;
      const currentIsAppLocal = Boolean(source.projectId);
      if (priorIsGlobal && currentIsAppLocal) {
        selected.set(config.name, { config, source });
      } else {
        allErrors.push({
          agent: config.name,
          field: "name",
          message: `Duplicate agent name. Already loaded from ${prior.source.relativeDir}; duplicate at ${source.relativeDir}`,
        });
      }
      continue;
    }
    selected.set(config.name, { config, source });
  }

  if (allErrors.length > 0) {
    reportInvalidGeneration(opts.bus, allErrors);
    throw new Error(`Agent generation validation failed:\n${validationReport(allErrors)}`);
  }

  const definitions: SubagentDefinition[] = [];
  for (const { config, source } of selected.values()) {
    try {
      const configPath = resolve(source.dir, "cron.json");
      if (existsSync(configPath)) {
        const entries: unknown = JSON.parse(readFileSync(configPath, "utf8"));
        if (!Array.isArray(entries) || entries.length)
          throw new Error("cron.json handlers are retired; move App duties to schedules/observers before upgrading");
      }
      const effectiveProjectRoot = agentProjectRoot(source, projectRoot);
      const definition = await buildAgentDefinition({
        config,
        source,
        model: models[config.model],
        tools: await buildTools(config, {
          ...opts,
          fileWritePolicy,
          projectRoot: effectiveProjectRoot,
          agentsRoot: agentsRootForAgentDir(source),
          agentDir: source.dir,
          getAgentSessionId: runtime.getAgentSessionId,
        }),
        projectRoot: effectiveProjectRoot,
        sharedRoot: opts.definitionSharedRoot ?? opts.sharedRoot,
        globalAgentsRoot: agentsRoot,
      });
      for (const message of definition.skillCatalog?.diagnostics ?? []) {
        allErrors.push({ agent: config.name, field: "skills", message });
      }
      definition.fileWritePolicy = fileWritePolicy;
      definitions.push(definition);
    } catch (error) {
      allErrors.push({
        agent: config.name,
        field: "definition",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (allErrors.length > 0) {
    reportInvalidGeneration(opts.bus, allErrors);
    throw new Error(`Agent generation preparation failed:\n${validationReport(allErrors)}`);
  }

  const names = definitions.map((definition) => definition.name);
  return {
    definitions: Object.freeze(definitions),
    added: names.filter((name) => !manager.hasAgent(name)),
    updated: names.filter((name) => manager.hasAgent(name)),
  };
}

/** Publish prepared definitions synchronously and return an exact rollback. */
export function publishAgentGeneration(
  opts: AgentLoaderOptions,
  _runtime: AgentRegistryRuntime,
  generation: PreparedAgentGeneration,
): AgentGenerationPublication {
  const manager = opts.manager as SubagentManager & {
    agentNames?: () => string[];
    getAgentDefinition?: (name: string) => SubagentDefinition | undefined;
    unregister?: (name: string) => void;
  };
  // Production managers expose the complete snapshot surface. Small SDK/tool
  // test doubles may provide only register/hasAgent, so loading remains useful
  // there without pretending those doubles support rollback of prior state.
  const agentNames = () => manager.agentNames?.() ?? [];
  const unregister = (name: string) => manager.unregister?.(name);
  const previous = new Map(
    agentNames()
      .map((name) => [name, manager.getAgentDefinition?.(name)] as const)
      .filter((entry): entry is readonly [string, SubagentDefinition] => Boolean(entry[1])),
  );
  const nextNames = new Set(generation.definitions.map((definition) => definition.name));
  try {
    for (const name of agentNames()) {
      if (!nextNames.has(name)) unregister(name);
    }
    for (const definition of generation.definitions) opts.manager.register(definition);
  } catch (error) {
    for (const name of agentNames()) {
      if (!previous.has(name)) unregister(name);
    }
    for (const definition of previous.values()) opts.manager.register(definition);
    throw error;
  }

  let settled = false;
  return {
    rollback() {
      if (settled) return;
      settled = true;
      for (const name of agentNames()) {
        if (!previous.has(name)) unregister(name);
      }
      for (const definition of previous.values()) opts.manager.register(definition);
    },
    finalize() {
      settled = true;
    },
  };
}

/**
 * Scan agents/ directory, load and validate agent.json configs, register with manager.
 * Re-registers existing agents so config changes take effect on next session.
 * Active sessions keep their old config.
 */
export async function loadAgents(opts: AgentLoaderOptions, runtime: AgentRegistryRuntime): Promise<LoadResult> {
  const generation = await prepareAgents(opts, runtime);
  const publication = publishAgentGeneration(opts, runtime, generation);
  publication.finalize();
  return { added: generation.added, updated: generation.updated };
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
