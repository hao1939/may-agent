import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { ModelWithApiKey } from "../../lib/types.js";
import type { SubagentDefinition } from "../../lib/types.js";
import type { SubagentManager } from "../../lib/manager.js";
import type { HostMaintenance } from "../adapters/maintenance/runtime.js";
import type { EventBus } from "../core/events/bus.js";
import { readAgentConfigFile, validateAgentConfig, type AgentConfig, type ValidationError } from "./agent-config.js";
import {
  agentProjectRoot,
  agentsRootForAgentDir,
  listRuntimeAgentDirectories,
} from "./agent-discovery.js";
import { buildTools } from "./toolset-loader.js";
import { buildAgentDefinition } from "./agent-definition.js";
import { prepareMaintenance } from "../composition/maintenance.js";

export interface AgentLoaderOptions {
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
  cronEnabled: boolean;
  /** Load only these exact agents in a short-lived execution worker. */
  agentNames?: readonly string[];
}

export interface LoadResult {
  added: string[];
  updated: string[];
}

export interface PreparedAgentGeneration extends LoadResult {
  definitions: readonly SubagentDefinition[];
  maintenance: ReadonlyMap<string, HostMaintenance>;
  cleanups: ReadonlyMap<string, readonly (() => void)[]>;
  warnings: readonly string[];
}

export interface AgentGenerationPublication {
  rollback(): void;
  finalize(): void;
}

const discardedGenerations = new WeakSet<object>();

/** Release resources belonging to a generation that was never committed. */
export function discardAgentGeneration(generation: Pick<PreparedAgentGeneration, "maintenance" | "cleanups">): void {
  if (discardedGenerations.has(generation)) return;
  discardedGenerations.add(generation);
  for (const cron of generation.maintenance.values()) cron.close();
  for (const cleanups of generation.cleanups.values()) {
    for (const cleanup of cleanups) cleanup();
  }
}

export interface AgentRegistryRuntime {
  getAgentSessionId: (agentName: string) => string | undefined;
  publishResources?: (generation: PreparedAgentGeneration) => AgentGenerationPublication;
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
    owner: "agent:may",
    urgency: "immediate",
    data: {
      count: errors.length,
      errors: [...errors],
      message: `Agent generation rejected:\n${report}`,
      priority: "P0",
    },
  });
}

function preparedResourceRuntime(runtime: AgentRegistryRuntime): {
  runtime: AgentRegistryRuntime;
  maintenance: Map<string, HostMaintenance>;
  cleanups: Map<string, Array<() => void>>;
} {
  const maintenance = new Map<string, HostMaintenance>();
  const cleanups = new Map<string, Array<() => void>>();
  return {
    maintenance,
    cleanups,
    runtime: {
      getAgentSessionId: runtime.getAgentSessionId,
    },
  };
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
 * HostMaintenance, cleanup, or App state. Any validation or skill diagnostic rejects the
 * whole generation.
 */
export async function prepareAgents(
  opts: AgentLoaderOptions,
  runtime: AgentRegistryRuntime,
): Promise<PreparedAgentGeneration> {
  const { agentsRoot, projectRoot, projectsRoot, models, manager } = opts;
  const allErrors: ValidationError[] = [];
  const warnings: string[] = [];
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

  const staged = preparedResourceRuntime(runtime);
  const definitions: SubagentDefinition[] = [];
  for (const { config, source } of selected.values()) {
    try {
      const configPath = resolve(source.dir, "cron.json");
      if (existsSync(configPath)) {
        staged.maintenance.set(
          config.name,
          prepareMaintenance({ configPath, persistDir: opts.persistDir, agentName: config.name, bus: opts.bus }),
        );
      }
      const effectiveProjectRoot = agentProjectRoot(source, projectRoot);
      const definition = await buildAgentDefinition({
        config,
        source,
        model: models[config.model],
        tools: await buildTools(config, {
          ...opts,
          projectRoot: effectiveProjectRoot,
          agentsRoot: agentsRootForAgentDir(source),
          globalAgentsRoot: agentsRoot,
          agentDir: source.dir,
          getAgentSessionId: staged.runtime.getAgentSessionId,
          getAgentMaintenance: () => staged.maintenance,
          addCleanup: (agentName, cleanup) => {
            const existing = staged.cleanups.get(agentName);
            if (existing) existing.push(cleanup);
            else staged.cleanups.set(agentName, [cleanup]);
          },
        }),
        projectRoot: effectiveProjectRoot,
        sharedRoot: opts.definitionSharedRoot ?? opts.sharedRoot,
        globalAgentsRoot: agentsRoot,
      });
      for (const message of definition.skillCatalog?.diagnostics ?? []) {
        allErrors.push({ agent: config.name, field: "skills", message });
      }
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
    discardAgentGeneration(staged);
    reportInvalidGeneration(opts.bus, allErrors);
    throw new Error(`Agent generation preparation failed:\n${validationReport(allErrors)}`);
  }

  const names = definitions.map((definition) => definition.name);
  return {
    definitions: Object.freeze(definitions),
    maintenance: staged.maintenance,
    cleanups: staged.cleanups,
    warnings: Object.freeze(warnings),
    added: names.filter((name) => !manager.hasAgent(name)),
    updated: names.filter((name) => manager.hasAgent(name)),
  };
}

/** Publish prepared definitions synchronously and return an exact rollback. */
export function publishAgentGeneration(
  opts: AgentLoaderOptions,
  runtime: AgentRegistryRuntime,
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
  let resourcePublication: AgentGenerationPublication | undefined;
  try {
    for (const name of agentNames()) {
      if (!nextNames.has(name)) unregister(name);
    }
    for (const definition of generation.definitions) opts.manager.register(definition);
    resourcePublication = runtime.publishResources?.(generation);
  } catch (error) {
    if (!resourcePublication) discardAgentGeneration(generation);
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
      resourcePublication?.rollback();
      for (const name of agentNames()) {
        if (!previous.has(name)) unregister(name);
      }
      for (const definition of previous.values()) opts.manager.register(definition);
    },
    finalize() {
      if (settled) return;
      settled = true;
      resourcePublication?.finalize();
      for (const warning of generation.warnings) {
        opts.bus.emit({ type: "info", message: `[loader] ${warning}` });
      }
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
