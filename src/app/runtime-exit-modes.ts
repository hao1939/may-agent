import type { SubagentManager } from "../lib/index.js";
import type { AppArgs } from "./app-args.js";
import { formatDurationMs } from "./daemon.js";
import type { EventBus } from "./core/events/bus.js";
import { runMessageMode, runStatusMode } from "./modes/command.js";
import { runOneshotMode } from "./modes/oneshot.js";
import { runWorkflowMode } from "./modes/run-workflow.js";

/**
 * Run client-only control modes before daemon lifecycle ownership is created.
 * These commands inspect or contact an existing instance; they must never
 * overwrite that instance's identity record when they exit.
 */
export async function runRequestedControlExitMode(opts: {
  appArgs: AppArgs;
  agentsRoot: string;
  persistDir: string;
}): Promise<number | null> {
  if (opts.appArgs.statusMode) {
    await runStatusMode({ persistDir: opts.persistDir, notify: opts.appArgs.notify });
    return 0;
  }

  if (opts.appArgs.messageMode) {
    return runMessageMode({ argv: process.argv, persistDir: opts.persistDir, agentsRoot: opts.agentsRoot });
  }

  return null;
}

export async function runRequestedExitMode(opts: {
  appArgs: AppArgs;
  agentsRoot: string;
  sharedRoot: string;
  projectsRoot: string;
  projectRoot: string;
  persistDir: string;
  bus: EventBus;
  manager: SubagentManager;
}): Promise<void> {
  const {
    consoleEnabled,
    cronEnabled,
    dryRun,
    initialTask,
    interfaceAgent,
    oneshotMode,
    oneshotTimeoutMinutes,
    runWorkflow,
    socketEnabled,
    telegramEnabled,
    webEnabled,
  } = opts.appArgs;

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
      });
      process.exit(0);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  }

  if (
    !consoleEnabled &&
    !initialTask &&
    !cronEnabled &&
    !oneshotMode &&
    !webEnabled &&
    !socketEnabled &&
    !telegramEnabled
  ) {
    console.error(
      "Error: need --chat, --task, --oneshot, --status, --message, --emit, --web, --socket, --telegram, or --cron.",
    );
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
