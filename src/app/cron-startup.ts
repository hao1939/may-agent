import type { ChatSession } from "./chat-session.js";
import type { EventBus } from "./event-bus.js";
import { existsSync, readFileSync } from "node:fs";
import { projectRuntimePaths } from "@may-agent/sdk";
import { getAgentCrons, getAgentSessionId, loadAgentHandlers, type AgentLoaderOptions } from "./agent-loader.js";
import type { SubagentManager } from "../lib/index.js";
import { log } from "../lib/log.js";
import type { PersistedSession } from "../lib/persistence.js";
import { PROJECT_APP_TASK_RECOVERY_OWNER } from "./project-app-task-reconciler.js";
import { recoverInstalledProjectAppTasks } from "./loader/project-app-loader.js";
import { APP_INBOX_RECOVERY_OWNER } from "./app-inbox-host.js";

export interface CronRuntimeOptions {
  manager: SubagentManager;
  bus: EventBus;
  loaderOpts: AgentLoaderOptions;
  chatMode: boolean;
  chatSession?: ChatSession;
}

function fieldFromPrompt(prompt: string, name: string): string | null {
  const match = prompt.match(new RegExp(`^${name}:\\s*(.+)$`, "m"));
  return match?.[1]?.trim() ?? null;
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
  sessionId: string,
  session: PersistedSession,
  claimedProjectTaskSessionIds: ReadonlySet<string> = new Set(),
): { resume: true } | { resume: false; reason?: string } {
  if (session.recoveryOwner === APP_INBOX_RECOVERY_OWNER || session.source === "app-inbox-owner") {
    return {
      resume: false,
      reason: "App inbox host reclaims the fenced request with a fresh bounded owner attempt",
    };
  }
  if (session.recoveryOwner === PROJECT_APP_TASK_RECOVERY_OWNER || session.source === "project-app-task-owner") {
    if (claimedProjectTaskSessionIds.has(sessionId)) return { resume: true };
    return {
      resume: false,
      reason: "Task-bound project session was not claimed by project-app recovery during startup",
    };
  }
  if (!session.projectId) return { resume: true };

  const appDir = fieldFromPrompt(session.task, "App") ?? `/app/projects/${session.projectId}.app`;
  if (currentProjectLifecycle(appDir) === "paused") {
    return {
      resume: false,
      reason: `Project ${session.projectId} is paused in ${projectRuntimePaths(appDir).taskStatePath}`,
    };
  }

  return { resume: true };
}

export function shouldResumeStartupChatSession(
  _sessionId: string,
  session: PersistedSession,
): { resume: true } | { resume: false; reason: string } {
  if (session.status === "idle") {
    return {
      resume: false,
      reason: "Idle chat turn already completed before restart",
    };
  }
  return { resume: true };
}

export async function startCronRuntime(options: CronRuntimeOptions): Promise<void> {
  const { manager, bus, loaderOpts, chatMode, chatSession } = options;

  const claimedProjectTaskSessionIds = recoverInstalledProjectAppTasks({
    ...loaderOpts,
    agentCrons: getAgentCrons(),
  });
  const { resumed, interrupted } = manager.resumeStaleSessions({
    kinds: ["job", "call"],
    shouldResume: (sessionId, session) =>
      shouldResumeStartupSession(sessionId, session, claimedProjectTaskSessionIds),
  });
  const orphansCleaned: typeof interrupted = [];
  if (!chatMode) {
    const { interrupted: chatCleaned } = manager.resumeStaleSessions({ abort: true, kinds: ["chat"] });
    orphansCleaned.push(...chatCleaned);
  } else {
    const { resumed: chatResumed, interrupted: chatCleaned } = manager.resumeStaleSessions({
      kinds: ["chat"],
      shouldResume: shouldResumeStartupChatSession,
    });
    resumed.push(...chatResumed);
    orphansCleaned.push(...chatCleaned);
    chatSession?.resumeAfterLoad();
  }

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

  for (const [name, cron] of getAgentCrons()) {
    // Subscribe + start in one place for all crons (agent-level and app-level).
    // Crons are created by toolset-loader (agent "cron" tool) and
    // ensureOwnerCron (project-app owners). Neither subscribes or starts —
    // that responsibility lives here so each cron activates exactly once.
    cron.subscribeToBus(bus);

    // Defensive: rebuild event subscriptions after bus subscription to
    // prevent stale-map dispatch gaps (evaluation-aftermath-session-dispatch-fix).
    // Idempotent — if subscriptions are already correct, this is a no-op rebuild.
    cron.rebuildEventSubscriptions();

    // Verify all enabled entries with `on` events are properly subscribed.
    // If any are missing, log a warning so the issue is visible in daemon logs.
    const gaps = cron.verifyEventSubscriptions();
    if (gaps.length > 0) {
      for (const gap of gaps) {
        bus.emit({
          type: "info",
          message: `[cron:${name}] ⚠️ Subscription gap: ${gap.entryName} missing events [${gap.missingEvents.join(", ")}]`,
        });
      }
      // Re-rebuild as a last resort — should not be needed but provides
      // defense-in-depth for the intermittent startup-ordering bug.
      cron.rebuildEventSubscriptions();
    }

    cron.onFire((entry) => {
      const handler =
        typeof entry.handler === "string"
          ? entry.handler
          : entry.handler
            ? `workflow:${entry.handler.agent ? `${entry.handler.agent}/` : ""}${entry.handler.workflow}`
            : entry.name;
      bus.emit({
        type: "info",
        message: `[cron] ${entry.name} fired (handler -> ${handler})`,
      });
    });

    const entries = cron.getEntries();
    if (entries.length > 0) {
      bus.emit({ type: "info", message: `[cron:${name}] Starting ${entries.length} job(s)` });
      cron.start();
    }
  }
}
