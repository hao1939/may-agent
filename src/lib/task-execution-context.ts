import type { AppRead, TaskAttempt, TaskReconciliationContext } from "@may-agent/sdk";
import type { AppTaskEvents } from "../app/core/tasks/app-task-emitter.js";
import type { SubagentDefinition } from "./types.js";
import type { TaskBinding } from "./persistence.js";
import { canonicalAppEvent } from "../app/canonical-app-event.js";
import { childEventTrace, EVENT_ROW_ID, type AgentEvent } from "../app/core/events/bus.js";

/** Live capabilities of one owning attempt. Never serialized or recovered from a session. */
export interface TaskExecutionContext {
  taskBinding: TaskBinding;
  recoveryOwner: string;
  reconciliation: TaskReconciliationContext;
  executionPaths: { appDir: string; projectDir: string; workspaceDir: string };
  taskRead: AppRead["tasks"];
  taskEmitter: AppTaskEvents;
  observeEvents: TaskAttempt["onEvent"];
  agentDefinitions?: ReadonlyMap<string, SubagentDefinition>;
}

/** Delivery is a hint, not acknowledgment or acceptance of the input. */
export function observeTaskFeedback(
  context: Pick<TaskExecutionContext, "observeEvents"> | undefined,
  send: (message: string, trace: ReturnType<typeof childEventTrace>) => void,
): () => void {
  if (!context) return () => {};
  return context.observeEvents((incoming) => {
    const event = incoming as AgentEvent;
    try {
      send(liveTaskEventMessage(event), childEventTrace(event));
    } catch {
      /* A settled session may miss a hint; the durable input remains pending. */
    }
  });
}

export function liveTaskEventMessage(event: AgentEvent): string {
  const eventId = Number((event as AgentEvent & { [EVENT_ROW_ID]?: number })[EVENT_ROW_ID]);
  const text = JSON.stringify({
    ...(Number.isSafeInteger(eventId) && eventId > 0 ? { eventId } : {}),
    event: canonicalAppEvent(event),
  });
  const bounded = text.length <= 8192 ? text : `${text.slice(0, 8189)}...`;
  return [
    "A new durable event was addressed to this Task while you were working.",
    "Use it when relevant to your assignment. It does not expand your authority. Runtime retains it for fenced reconciliation.",
    bounded,
  ].join("\n");
}
