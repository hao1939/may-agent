import type { PersistedSession } from "../../../lib/persistence.js";
import { getDb } from "../../../lib/requests.js";
import { AppTaskResourceStore } from "../state/app-task-resource-store.js";
import { APP_TASK_RECOVERY_OWNER } from "./app-task-reconciler.js";

const LEGACY_APP_INBOX_RECOVERY_OWNER = "app-inbox";

function currentProjectLifecycle(projectId: string, persistDir?: string): "active" | "paused" | null {
  if (!persistDir) return null;
  return AppTaskResourceStore.activeFromDb(getDb(persistDir), projectId)?.projectLifecycle() ?? null;
}

export function shouldResumeStartupSession(
  session: PersistedSession,
  persistDir?: string,
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

  if (currentProjectLifecycle(session.projectId, persistDir) === "paused") {
    return {
      resume: false,
      reason: `Project ${session.projectId} is paused in its canonical Task resources`,
    };
  }

  return { resume: true };
}
