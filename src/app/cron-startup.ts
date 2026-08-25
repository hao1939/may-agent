import type { EventBus } from "./event-bus.js";
import { existsSync, readFileSync } from "node:fs";
import { projectRuntimePaths } from "./app-task-runtime-state.js";
import { getAgentCrons, getAgentSessionId, loadAgentHandlers, type AgentLoaderOptions } from "./agent-loader.js";
import type { SubagentManager } from "../lib/index.js";
import { log } from "../lib/log.js";
import type { PersistedSession } from "../lib/persistence.js";
import { recoverInstalledAppTasks } from "./app-task-runtime.js";
import { APP_TASK_RECOVERY_OWNER } from "./app-task-reconciler.js";
import { activateAgentCrons } from "./cron-activation.js";

const LEGACY_APP_INBOX_RECOVERY_OWNER = "app-inbox";

export interface CronRuntimeOptions {
  manager: SubagentManager;
  bus: EventBus;
  loaderOpts: AgentLoaderOptions;
}

function currentProjectLifecycle(appDir: string): string | null {
  const paths = projectRuntimePaths(appDir);
  if (!existsSync(paths.taskStatePath)) return null;
  try {
    const tree = JSON.parse(readFileSync(paths.taskStatePath, "utf8")) as {
      project_lifecycle?: unknown;
    };
    return typeof tree.project_lifecycle === "string" ? tree.project_lifecycle.trim() : null;
  } catch {
    return null;
  }
}

export function shouldResumeStartupSession(
  _sessionId: string,
  session: PersistedSession,
  projectsRoot = "/app/projects",
): { resume: true } | { resume: false; reason?: string } {
  if (session.recoveryOwner === LEGACY_APP_INBOX_RECOVERY_OWNER || session.source === "app-inbox-owner") {
    return {
      resume: false,
      reason: "Legacy App inbox agent sessions are replaced by Task reconciliation",
    };
  }
  if (
    session.recoveryOwner === APP_TASK_RECOVERY_OWNER ||
    (typeof session.taskId === "string" && session.taskId.trim()) ||
    (typeof session.projectTaskId === "string" && session.projectTaskId.trim()) ||
    session.source === "app-task-agent" ||
    session.source === "app-task-owner" ||
    session.source === "project-app-task-owner"
  ) {
    return {
      resume: false,
      reason: "Task-bound execution is recovered through its Task, not by resuming the old session",
    };
  }
  if (!session.projectId) return { resume: true };

  const appDir = `${projectsRoot}/${session.projectId}.app`;
  if (currentProjectLifecycle(appDir) === "paused") {
    return {
      resume: false,
      reason: `Project ${session.projectId} is paused in ${projectRuntimePaths(appDir).taskStatePath}`,
    };
  }

  return { resume: true };
}

export async function startCronRuntime(options: CronRuntimeOptions): Promise<void> {
  const { manager, bus, loaderOpts } = options;

  await recoverInstalledAppTasks(bus);
  const { resumed, interrupted } = manager.resumeStaleSessions({
    kinds: ["job", "call"],
    shouldResume: shouldResumeStartupSession,
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

  const handlerResult = await loadAgentHandlers({
    ...loaderOpts,
    getSessionId: (agentName: string) => getAgentSessionId(agentName) ?? null,
  });
  if (handlerResult.registered.length > 0) {
    bus.emit({
      type: "info",
      message: `[handlers] Registered ${handlerResult.registered.length}: ${handlerResult.registered.join(", ")}`,
    });
  }
  if (handlerResult.errors.length > 0) {
    bus.emit({
      type: "info",
      message: `[handlers] ${handlerResult.errors.length} error(s): ${handlerResult.errors.join("; ")}`,
    });
    for (const err of handlerResult.errors) {
      const handlerName = err.match(/"(\w[\w-]*)\.(js|ts)"/)?.[1] ?? err.match(/"([^"]+)"/)?.[1] ?? "unknown";
      log("warn", `[handlers] Failed to load handler "${handlerName}": ${err}`);
    }
  }

  activateAgentCrons(getAgentCrons(), bus);
}
