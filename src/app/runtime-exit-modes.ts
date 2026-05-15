import type { SubagentManager } from "../lib/index.js";
import type { AppArgs } from "./app-args.js";
import { formatDurationMs } from "./daemon.js";
import type { EventBus } from "./event-bus.js";
import type { ModelRegistry } from "./model-registry.js";
import { runMessageMode, runStatusMode } from "./modes/command.js";
import { runOneshotMode } from "./modes/oneshot.js";
import { runWorkflowMode } from "./modes/run-workflow.js";

export async function runRequestedExitMode(opts: {
  appArgs: AppArgs;
  agentsRoot: string;
  sharedRoot: string;
  projectsRoot: string;
  projectRoot: string;
  persistDir: string;
  bus: EventBus;
  manager: SubagentManager;
  models: ModelRegistry["models"];
  litellmApiKey: string;
}): Promise<void> {
  const {
    chatMode,
    cronEnabled,
    dryRun,
    initialTask,
    interfaceAgent,
    messageMode,
    notify,
    oneshotMode,
    oneshotTimeoutMinutes,
    runWorkflow,
    socketEnabled,
    statusMode,
    telegramEnabled,
    webEnabled,
  } = opts.appArgs;

  if (statusMode) {
    await runStatusMode({ persistDir: opts.persistDir, notify });
    process.exit(0);
  }

  if (messageMode) {
    process.exit(await runMessageMode({ argv: process.argv, persistDir: opts.persistDir, agentsRoot: opts.agentsRoot }));
  }

  if (runWorkflow) {
    try {
      await runWorkflowMode({
        mode: runWorkflow,
        dryRun,
        agentsRoot: opts.agentsRoot,
        sharedRoot: opts.sharedRoot,
        projectsRoot: opts.projectsRoot,
        projectRoot: opts.projectRoot,
        persistDir: opts.persistDir,
        bus: opts.bus,
        manager: opts.manager,
        models: opts.models,
        apiKey: opts.litellmApiKey,
      });
      process.exit(0);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  }

  if (!chatMode && !initialTask && !cronEnabled && !oneshotMode && !webEnabled && !socketEnabled && !telegramEnabled) {
    console.error("Error: need --chat, --task, --oneshot, --status, --message, --emit, --web, --socket, --telegram, or --cron.");
    process.exit(1);
  }

  if (oneshotMode) {
    try {
      const exitCode = await runOneshotMode({
        task: initialTask,
        agentName: interfaceAgent,
        manager: opts.manager,
        timeoutMinutes: oneshotTimeoutMinutes,
        formatDurationMs,
      });
      process.exit(exitCode);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  }
}
