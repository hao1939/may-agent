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
import { createCodexGoalExecutor, migrateCodexGoalBindingFile } from "./codex-goal-executor.js";
import { getDb } from "../lib/requests.js";

function hasRetainedCodexGoalTrialTask(persistDir: string): boolean {
  return Boolean(
    getDb(persistDir)
      .prepare(
        `SELECT 1
         FROM app_tasks task
         WHERE json_extract(task.resource_json, '$.spec.executor') = 'codex-goal-poc'
           AND NOT EXISTS (
             SELECT 1 FROM app_task_cancellations cancellation
             WHERE cancellation.app_id = task.app_id AND cancellation.task_id = task.task_id
           )
           AND (
             task.phase <> 'converged'
             OR json_extract(task.resource_json, '$.spec.mode') = 'maintain'
           )
         LIMIT 1`,
      )
      .get(),
  );
}

export const daemonAgentInternals = { hasRetainedCodexGoalTrialTask };

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
  /** Controllers in the daemon, descriptor-only setup in an attempt worker, or no Task runtime. */
  taskRuntimeMode?: "controllers" | "manual" | "none";
  executeTaskAttempt?: AppTaskRuntimeOptions["executeAttempt"];
  executeTaskRecovery?: AppTaskRuntimeOptions["executeRecovery"];
  taskAppIds?: readonly string[];
  syncTaskReadModels?: boolean;
  agentNames?: readonly string[];
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
    ...(opts.agentNames ? { agentNames: opts.agentNames } : {}),
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
  const taskRuntimeMode = opts.taskRuntimeMode ?? (opts.cronEnabled ? "controllers" : "none");
  if (taskRuntimeMode !== "none") {
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
    const codexGoalStateFile = join(opts.persistDir, "codex-goal-bindings.json");
    const bindingMigration = migrateCodexGoalBindingFile({
      legacyPath: join(opts.persistDir, "codex-goal-poc-bindings.json"),
      currentPath: codexGoalStateFile,
    });
    if (bindingMigration.migrated) {
      opts.bus.emit({
        type: "info",
        message: `[app-task] Migrated ${bindingMigration.bindings} Codex goal binding(s) to ${codexGoalStateFile}`,
      });
    }
    const retainTrialExecutorAlias = hasRetainedCodexGoalTrialTask(opts.persistDir);
    const codexGoalExecutor = createCodexGoalExecutor({
      stateFile: codexGoalStateFile,
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
      ...(opts.executeTaskAttempt ? { executeAttempt: opts.executeTaskAttempt } : {}),
      ...(opts.executeTaskRecovery ? { executeRecovery: opts.executeTaskRecovery } : {}),
      ...(opts.taskAppIds ? { taskAppIds: opts.taskAppIds } : {}),
      syncReadModels: opts.syncTaskReadModels !== false,
      installControllers: taskRuntimeMode === "controllers",
      executors: {
        "codex-goal": codexGoalExecutor,
        ...(retainTrialExecutorAlias ? { "codex-goal-poc": codexGoalExecutor } : {}),
      },
      registerLocalAgent,
      appRegistry: opts.appRegistry,
      ...(taskRuntimeMode === "controllers" ? { startAfter } : {}),
    };

    // Publish definitions and gated controllers now. Recovery is activated
    // only after the control socket opens, so startup cannot create task
    // workspaces while every human interface is still unavailable.
    const appResult = await installAppTaskRuntimes(appTaskOptions, { deferRecovery: true });
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
