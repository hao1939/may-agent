import type { EventBus } from "../event-bus.js";
import type { AppArgs } from "../app-args.js";
import type { SubagentManager } from "../../lib/manager.js";
import { log } from "../../lib/log.js";
import { recoverInstalledAppTasks } from "../app-task-runtime.js";
import { shouldResumeStartupSession } from "../core/tasks/startup-recovery.js";

export interface BackgroundRuntimeOptions {
  manager: SubagentManager;
  bus: EventBus;
  projectsRoot: string;
  persistDir: string;
  /** Open controllers after startup repair succeeds or yields to bounded retry. */
  onTaskRecoverySettled: () => void;
}

/** Process role, not optional schedules, determines ownership of background work. */
export function runsBackgroundWork(args: AppArgs, interactiveConsole: boolean): boolean {
  if (
    args.oneshotMode ||
    args.runWorkflow ||
    args.statusMode ||
    args.messageMode ||
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
  const { resumed, interrupted } = manager.resumeStaleSessions({
    kinds: ["job", "call"],
    shouldResume: (sessionId, session) =>
      shouldResumeStartupSession(sessionId, session, options.projectsRoot, options.persistDir),
  });
  const orphansCleaned: typeof interrupted = [];
  const { interrupted: chatCleaned } = manager.resumeStaleSessions({ abort: true, kinds: ["chat"] });
  orphansCleaned.push(...chatCleaned);

  if (resumed.length > 0) {
    bus.emit({
      type: "info",
      message: `[startup] Resumed ${resumed.length} session(s): ${resumed.map((s) => `${s.agent}/${s.sessionId}`).join(", ")}`,
    });
  }
  if (interrupted.length > 0) {
    bus.emit({
      type: "info",
      message: `[startup] ${interrupted.length} session(s) could not resume: ${interrupted.map((s) => `${s.agent}/${s.sessionId}`).join(", ")}`,
    });
  }
  if (orphansCleaned.length > 0) {
    bus.emit({
      type: "info",
      message: `[startup] Cleaned up ${orphansCleaned.length} orphaned session(s): ${orphansCleaned.map((s) => `${s.agent}/${s.sessionId}`).join(", ")}`,
    });
  }
}
