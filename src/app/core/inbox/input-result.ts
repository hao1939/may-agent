import type { AppResult } from "@may-agent/sdk";
import type { AgentEvent } from "../events/bus.js";
import type { AppInboxItem } from "../state/app-inbox-store.js";

/** The same exact caller feedback for live notification and saved-state recovery. */
export function appInputFeedbackEvent(item: AppInboxItem, result: AppResult & { attemptId?: string; reportRevision?: number }, status: "done" | "blocked" = "done"): AgentEvent | null {
  if (item.source.kind !== "app") return null;
  return {
    type: "app.dependency.updated",
    source: `app-inbox:${item.appId}`,
    owner: `app:${item.source.id}`,
    data: {
      kind: "app",
      id: item.id,
      status,
      ...(status === "blocked" && result.attemptId ? { reportAttemptId: result.attemptId } : {}),
      ...(status === "blocked" && result.reportRevision ? { reportRevision: result.reportRevision } : {}),
      summary: result.summary,
      ...(result.response ? { response: result.response } : {}),
      ...(result.result ? { result: result.result } : {}),
      ...(result.evidence ? { evidence: result.evidence } : {}),
      ...(item.waitingOn?.kind === "task" ? { taskId: item.waitingOn.id, appId: item.appId } : {}),
    },
  };
}
