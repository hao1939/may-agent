import { log } from "../../lib/log.js";
import type { SubagentManager } from "../../lib/manager.js";
import type { AppArgs } from "../app-args.js";
import type { EventBus } from "../core/events/bus.js";
import { recoverInstalledAppTasks } from "../core/tasks/app-task-runtime.js";

export interface BackgroundRuntimeOptions {
  manager: SubagentManager;
  bus: EventBus;
  persistDir: string;
  /** Open controllers after startup repair succeeds or yields to bounded retry. */
  onTaskRecoverySettled: () => void;
}

/** Process role, not optional schedules, determines ownership of background work. */
export function runsBackgroundWork(args: AppArgs, interactiveConsole: boolean): boolean {
  if (
    args.statusMode ||
    args.emitMode ||
    args.webOnlyMode ||
    args.taskWorkerRequest ||
    args.taskRecoveryWorker ||
    args.taskAdmissionWorker
  )
    return false;
  return interactiveConsole || args.socketEnabled || args.telegramEnabled || args.cronEnabled || args.webEnabled;
}

export function startBackgroundRuntime(options: BackgroundRuntimeOptions): void {
  const { manager, bus } = options;

  // Recovery is Task work. It must not hold startup, human admission, or the
  // command interface open while it scans and repairs durable Task state.
  void recoverInstalledAppTasks(bus)
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      log("warn", `[startup] Task recovery failed; bounded recovery will retry: ${message}`);
      bus.emit({ type: "info", message: `[startup] Task recovery will retry: ${message}` });
    })
    .finally(() => options.onTaskRecoverySettled?.());
  const { interrupted } = manager.cleanupStaleSessions();
  if (interrupted.length > 0) {
    bus.emit({
      type: "info",
      message: `[startup] Cleaned up ${interrupted.length} stopped session(s): ${interrupted.map((s) => `${s.agent}/${s.sessionId}`).join(", ")}`,
    });
  }
}
