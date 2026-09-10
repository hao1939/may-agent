import { existsSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { loadAgentConfig, validateAgentConfig } from "./loader/agent-config.js";
import { buildTools } from "./loader/toolset-loader.js";
import { buildAgentDefinition } from "./loader/agent-definition.js";
import type { EventBus } from "./core/events/bus.js";
import type { SubagentManager } from "../lib/index.js";
import type { ModelWithApiKey } from "../lib/types.js";
import type { AgentLoaderOptions } from "./agent-loader.js";
import { getAgentMaintenance, loadAgents, getAgentSessionId, prepareAgentTriggers } from "./agent-loader.js";
import { installAppTaskRuntimes, type AppTaskRuntimeOptions } from "./core/tasks/app-task-runtime.js";
import { createTaskExecutionBackends } from "./composition/task-execution.js";
import type { AppRegistry } from "./core/apps/registry.js";
import type { HostCapacity } from "./core/scheduling/host-capacity.js";
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
  canonicalProjectsRoot?: string;
  appDirectories?: readonly string[];
  projectRoot: string;
  persistDir: string;
  models: Record<string, ModelWithApiKey>;
  manager: SubagentManager;
  bus: EventBus;
  cronEnabled: boolean;
  appRegistry: AppRegistry;
  hostCapacity: HostCapacity;
  /** Controllers in the daemon, descriptor-only setup in an attempt worker, or no Task runtime. */
  taskRuntimeMode: "controllers" | "manual" | "none";
  executeTaskAttempt?: AppTaskRuntimeOptions["executeAttempt"];
  executeTaskRecovery?: AppTaskRuntimeOptions["executeRecovery"];
  taskAppIds?: readonly string[];
  syncTaskReadModels?: boolean;
  readOutcomes?: AppTaskRuntimeOptions["readOutcomes"];
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
    canonicalProjectsRoot: opts.canonicalProjectsRoot,
    appDirectories: opts.appDirectories,
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
    const appFolder = basename(appDir);
    const projectId = appFolder.replace(/\.app$/, "");
    const domainDir = resolve(opts.canonicalProjectsRoot ?? opts.projectsRoot, projectId);
    const definition = await buildAgentDefinition({
      config,
      source: {
        name: basename(agentDir),
        dir: agentDir,
        agentsRoot: dirname(agentDir),
        projectId,
        projectDir: existsSync(domainDir) ? domainDir : appDir,
        // agentDir may be in a source release; writes belong to the installation.
        relativeDir: `projects/${appFolder}/agents/${basename(agentDir)}`,
      },
      model,
      tools: await buildTools(config, {
        ...loaderOpts,
        agentsRoot: resolve(appDir, "agents"),
        globalAgentsRoot: opts.agentsRoot,
        agentDir,
        getAgentSessionId,
        getAgentMaintenance: () => getAgentMaintenance(),
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
  const taskRuntimeMode = opts.taskRuntimeMode;
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
      sharedRoot: opts.definitionSharedRoot,
      bus: opts.bus,
      hostCapacity: opts.hostCapacity,
      ...createTaskExecutionBackends({
        manager: opts.manager,
        bus: opts.bus,
        persistDir: opts.persistDir,
        registerLocalAgent,
      }),
      ...(opts.executeTaskAttempt ? { executeAttempt: opts.executeTaskAttempt } : {}),
      ...(opts.executeTaskRecovery ? { executeRecovery: opts.executeTaskRecovery } : {}),
      ...(opts.taskAppIds ? { taskAppIds: opts.taskAppIds } : {}),
      syncReadModels: opts.syncTaskReadModels !== false,
      readOutcomes: opts.readOutcomes,
      installControllers: taskRuntimeMode === "controllers",
      executors: {
        "codex-goal": codexGoalExecutor,
        ...(retainTrialExecutorAlias ? { "codex-goal-poc": codexGoalExecutor } : {}),
      },
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

  // Producer activation is separate from Task recovery and controller startup.

  if (taskRuntimeMode === "controllers") await prepareAgentTriggers(loaderOpts);

  return { loaderOpts, appTaskOptions, startAppTaskControllers };
}
