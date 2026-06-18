import type { ChatSession } from "./chat-session.js";
import type { EventBus } from "./event-bus.js";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getAgentCrons, getAgentSessionId, loadAgentHandlers, type AgentLoaderOptions } from "./agent-loader.js";
import type { SubagentManager } from "../lib/index.js";
import { log } from "../lib/log.js";
import type { PersistedSession } from "../lib/persistence.js";

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

function assignedTaskFromPrompt(prompt: string): Record<string, unknown> | null {
  const marker = "Assigned task:";
  const markerIndex = prompt.indexOf(marker);
  if (markerIndex < 0) return null;
  const fenceStart = prompt.indexOf("```json", markerIndex);
  if (fenceStart < 0) return null;
  const jsonStart = prompt.indexOf("\n", fenceStart);
  if (jsonStart < 0) return null;
  const fenceEnd = prompt.indexOf("```", jsonStart + 1);
  if (fenceEnd < 0) return null;
  try {
    const parsed = JSON.parse(prompt.slice(jsonStart + 1, fenceEnd));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function traceString(task: Record<string, unknown>, key: string): string | null {
  const trace = task.trace;
  if (!trace || typeof trace !== "object" || Array.isArray(trace)) return null;
  const value = (trace as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

function currentTaskFromTree(appDir: string, taskId: string): Record<string, unknown> | null {
  const treePath = join(appDir, "tasks", "tree.json");
  if (!existsSync(treePath)) return null;
  try {
    const tree = JSON.parse(readFileSync(treePath, "utf8")) as {
      tasks?: Record<string, unknown>;
    };
    const task = tree.tasks?.[taskId];
    return task && typeof task === "object" && !Array.isArray(task) ? (task as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function shouldResumeStartupSession(
  sessionId: string,
  session: PersistedSession,
): { resume: true } | { resume: false; reason?: string } {
  if (session.source !== "workflow:task-worker") return { resume: true };
  if (!session.projectId) return { resume: true };

  const appDir = fieldFromPrompt(session.task, "App") ?? `/app/projects/${session.projectId}.app`;
  const assignedTask = assignedTaskFromPrompt(session.task);
  const taskId = typeof assignedTask?.id === "string" ? assignedTask.id : null;
  if (!taskId) return { resume: true };

  const currentTask = currentTaskFromTree(appDir, taskId);
  if (!currentTask) {
    return {
      resume: false,
      reason: `Project task ${taskId} no longer exists in ${appDir}/tasks/tree.json`,
    };
  }

  const currentSessionId = typeof currentTask.session_id === "string" ? currentTask.session_id : null;
  if (currentSessionId && currentSessionId !== sessionId) {
    return {
      resume: false,
      reason: `Project task ${taskId} moved to newer session ${currentSessionId}`,
    };
  }

  const promptAttempt = fieldFromPrompt(session.task, "Attempt");
  const currentAttempt = traceString(currentTask, "current_attempt_id");
  if (promptAttempt && currentAttempt && promptAttempt !== currentAttempt) {
    return {
      resume: false,
      reason: `Project task ${taskId} moved to newer attempt ${currentAttempt}`,
    };
  }

  return { resume: true };
}

export async function startCronRuntime(options: CronRuntimeOptions): Promise<void> {
  const { manager, bus, loaderOpts, chatMode, chatSession } = options;

  const { resumed, interrupted } = manager.resumeStaleSessions({
    kinds: ["job", "call"],
    shouldResume: shouldResumeStartupSession,
  });
  const orphansCleaned: typeof interrupted = [];
  if (!chatMode) {
    const { interrupted: chatCleaned } = manager.resumeStaleSessions({ abort: true, kinds: ["chat"] });
    orphansCleaned.push(...chatCleaned);
  } else {
    const { resumed: chatResumed } = manager.resumeStaleSessions({ kinds: ["chat"] });
    resumed.push(...chatResumed);
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
