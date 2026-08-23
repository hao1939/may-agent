import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { importRuntimeModule } from "../lib/runtime-import.js";
import { listRuntimeAgentDirectories } from "./loader/agent-discovery.js";
import { loadAgentConfig, validateAgentConfig } from "./loader/agent-config.js";
import { buildTools } from "./loader/toolset-loader.js";
import { buildAgentDefinition } from "./loader/agent-definition.js";
import type { EventBus } from "./event-bus.js";
import type { SubagentManager } from "../lib/index.js";
import type { ModelWithApiKey } from "../lib/types.js";
import type { AgentLoaderOptions } from "./agent-loader.js";
import { generateAutoHeartbeats, getAgentCrons, loadAgents, getAgentSessionId } from "./agent-loader.js";
import { installAppTaskRuntimes, type AppTaskRuntimeOptions } from "./app-task-runtime.js";
import type { AppRegistry } from "./app-registry.js";
import type { HostCapacity } from "./host-capacity.js";
import { createCodexGoalPocExecutor } from "./codex-goal-poc-executor.js";

export async function prepareDaemonAgents(opts: {
  agentsRoot: string;
  sharedRoot: string;
  definitionSharedRoot: string;
  projectsRoot: string;
  projectRoot: string;
  persistDir: string;
  models: Record<string, ModelWithApiKey>;
  manager: SubagentManager;
  bus: EventBus;
  cronEnabled: boolean;
  appRegistry: AppRegistry;
  hostCapacity: HostCapacity;
}): Promise<{
  loaderOpts: AgentLoaderOptions;
  appTaskOptions?: AppTaskRuntimeOptions;
  startAppTaskControllers: () => void;
}> {
  const loaderOpts: AgentLoaderOptions = {
    agentsRoot: opts.agentsRoot,
    sharedRoot: opts.sharedRoot,
    definitionSharedRoot: opts.definitionSharedRoot,
    projectsRoot: opts.projectsRoot,
    projectRoot: opts.projectRoot,
    persistDir: opts.persistDir,
    models: opts.models,
    manager: opts.manager,
    bus: opts.bus,
    cronEnabled: opts.cronEnabled,
  };

  const loadResult = await loadAgents(loaderOpts);
  console.log(`[agents] Loaded ${loadResult.added.length}: ${loadResult.added.join(", ")}`);
  opts.bus.emit({
    type: "info",
    message: `Loaded ${loadResult.added.length} agent(s): ${loadResult.added.join(", ")}`,
  });

  const agentSources = listRuntimeAgentDirectories(opts.agentsRoot, opts.projectsRoot);
  // Build a map from agentsRoot -> projectId for App-local agent directories.
  // Global agents/ has no projectId (undefined), App-local dirs have one.
  const projectIdByAgentsRoot = new Map<string, string | undefined>();
  for (const agent of agentSources) {
    if (!projectIdByAgentsRoot.has(agent.agentsRoot)) {
      projectIdByAgentsRoot.set(agent.agentsRoot, agent.projectId);
    }
  }
  const heartbeatRoots = [...projectIdByAgentsRoot.entries()];
  const agentRootByName = new Map(agentSources.map((agent) => [agent.name, agent.agentsRoot]));
  const autoHeartbeats = heartbeatRoots.flatMap(([root, pid]) => generateAutoHeartbeats(root, pid));
  if (autoHeartbeats.length > 0) {
    const mayCron = getAgentCrons().get("may");
    if (mayCron) {
      for (const entry of autoHeartbeats) {
        mayCron.addSyntheticEntry(entry);
      }
      opts.bus.emit({
        type: "info",
        message: `[auto-heartbeat] Generated ${autoHeartbeats.length} heartbeat(s): ${autoHeartbeats.map((e) => e.agent).join(", ")}`,
      });
    }
  }

  // App brings its own agents — register from local agent.json when not already loaded.
  const registerLocalAgent = async (agentName: string, appDir: string, resolvedAgentDir?: string): Promise<boolean> => {
    const agentDir = resolvedAgentDir ?? resolve(appDir, "agents", agentName);
    const config = loadAgentConfig(agentDir, opts.bus);
    if (!config) {
      opts.bus.emit({
        type: "info",
        message: `[app-task] No valid agent.json at ${agentDir} for app agent "${agentName}"`,
      });
      return false;
    }

    const errors = validateAgentConfig(config, opts.models, opts.agentsRoot);
    if (errors.length > 0) {
      opts.bus.emit({
        type: "info",
        message: `[app-task] Agent config errors for ${agentName}: ${errors.map((e) => e.message).join(", ")}`,
      });
      return false;
    }

    const model = opts.models[config.model];
    const definition = await buildAgentDefinition({
      config,
      source: {
        name: config.name,
        dir: agentDir,
        agentsRoot: resolve(appDir, "agents"),
      },
      model,
      tools: await buildTools(config, {
        ...loaderOpts,
        agentsRoot: resolve(appDir, "agents"),
        globalAgentsRoot: opts.agentsRoot,
        agentDir,
        getAgentSessionId,
        getAgentCrons: () => getAgentCrons(),
        setAgentCron: (name, cron) => getAgentCrons().set(name, cron),
        addCleanup: () => {},
      }),
      projectRoot: opts.projectRoot,
      sharedRoot: opts.definitionSharedRoot,
      globalAgentsRoot: opts.agentsRoot,
      appLocal: true,
    });
    for (const diagnostic of definition.skillCatalog?.diagnostics ?? []) {
      opts.bus.emit({ type: "info", message: `[app-task] ${config.name} skill diagnostic: ${diagnostic}` });
    }
    opts.manager.register(definition);

    opts.bus.emit({
      type: "info",
      message: `[app-task] Auto-registered app agent "${agentName}" from ${agentDir}`,
    });
    return true;
  };

  let appTaskOptions: AppTaskRuntimeOptions | undefined;
  let startAppTaskControllers = () => {};
  if (opts.cronEnabled) {
    let started = false;
    let openStartGate = () => {};
    const startAfter = new Promise<void>((resolve) => {
      openStartGate = resolve;
    });
    startAppTaskControllers = () => {
      if (started) return;
      started = true;
      openStartGate();
    };
    const codexGoalExecutor = createCodexGoalPocExecutor({
      stateFile: join(opts.persistDir, "codex-goal-poc-bindings.json"),
      command: process.env.MAY_CODEX_GOAL_COMMAND,
      executorName: "codex-goal",
    });
    appTaskOptions = {
      projectsRoot: opts.projectsRoot,
      projectRoot: opts.projectRoot,
      persistDir: opts.persistDir,
      agentsRoot: opts.agentsRoot,
      sharedRoot: opts.sharedRoot,
      manager: opts.manager,
      bus: opts.bus,
      hostCapacity: opts.hostCapacity,
      executors: {
        "codex-goal": codexGoalExecutor,
        // Existing trial Tasks keep their durable executor name through the
        // rollout; new Evaluation work uses the production name above.
        "codex-goal-poc": codexGoalExecutor,
      },
      registerLocalAgent,
      appRegistry: opts.appRegistry,
      startAfter,
    };

    // Startup recovery retires previous execution attempts and queues their
    // Tasks behind the normal Host capacity gate.
    const appResult = await installAppTaskRuntimes(appTaskOptions, { includeFreshLeases: true });
    if (appResult.installed.length > 0) {
      opts.bus.emit({
        type: "info",
        message: `[app-task] Installed ${appResult.installed.length} task-enabled App(s): ${appResult.installed.map((app) => `${app.id}->${app.agent}`).join(", ")}`,
      });
    }
  }

  // Cron subscribe + start is handled by cron-startup.ts in one centralized
  // loop after all crons (agent-level and app-level) are created and loaded.

  let failures = 0;
  const heartbeatFiles = autoHeartbeats
    .map((entry) => {
      const agentRoot = agentRootByName.get(entry.agent!) ?? opts.agentsRoot;
      const agentWfDir = join(agentRoot, entry.agent!, "workflows");
      return join(agentWfDir, `${entry.agent}-heartbeat.ts`);
    })
    .filter((file) => existsSync(file));

  for (const file of heartbeatFiles) {
    try {
      await importRuntimeModule(file);
    } catch (err) {
      failures++;
      const msg = err instanceof Error ? err.message : String(err);
      opts.bus.emit({
        type: "info",
        message: `[startup-check] ⚠️ WORKFLOW BROKEN: ${file.split("/").slice(-3).join("/")} — ${msg}`,
      });
      console.error(`[startup-check] BROKEN WORKFLOW: ${file}\n  ${msg}`);
    }
  }
  if (failures > 0) {
    opts.bus.emit({
      type: "info",
      message: `[startup-check] ⚠️ ${failures} heartbeat workflow(s) failed to load! Heartbeats will NOT fire for those agents.`,
    });
  }

  return { loaderOpts, appTaskOptions, startAppTaskControllers };
}
