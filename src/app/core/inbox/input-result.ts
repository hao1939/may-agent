import type { AppResult } from "@may-agent/sdk";
import type { AgentEvent } from "../events/bus.js";
import type { AppInboxItem } from "../state/app-inbox-store.js";

/** The same exact caller answer for live notification and saved-receipt recovery. */
export function appInputResultEvent(item: AppInboxItem, result: AppResult): AgentEvent | null {
  if (item.source.kind !== "app") return null;
  return {
    type: "app.dependency.completed",
    source: `app-inbox:${item.appId}`,
    owner: `app:${item.source.id}`,
    data: {
      kind: "app",
      id: item.id,
      status: "done",
      summary: result.summary,
      ...(result.response ? { response: result.response } : {}),
      ...(result.result ? { result: result.result } : {}),
      ...(result.evidence ? { evidence: result.evidence } : {}),
      ...(item.waitingOn?.kind === "task" ? { taskId: item.waitingOn.id, appId: item.appId } : {}),
    },
  };
}
