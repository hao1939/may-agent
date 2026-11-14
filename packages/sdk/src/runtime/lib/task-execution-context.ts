import type { AppEvent, AppEventTarget, AppRead, TaskAttempt, TaskReconciliationContext } from "@may-agent/sdk";
import type { EventTrace } from "../../event.js";
import type { SubagentDefinition } from "./types.js";
import type { TaskBinding } from "./persistence.js";
import type { TaskWorkspaceBrief } from "./task-workspace-context.js";

export type TaskAttemptEmission = {
  type: string;
  data?: Record<string, unknown>;
  target?: Record<string, unknown>;
  owner?: string;
  action?: string;
  urgency?: "low" | "normal" | "high" | "immediate";
  ttl_ms?: number;
};

export type TaskAttemptEventInterface = {
  read(type: string, localKey: string): { eventId: number; data: Record<string, unknown> } | null;
  publish(localKey: string, event: TaskAttemptEmission): number;
  onEvent(listener: (event: any) => void): () => void;
};

/** Live capabilities of one owning attempt. Never serialized or recovered from a session. */
export interface TaskExecutionContext {
  taskBinding: TaskBinding;
  recoveryOwner: string;
  reconciliation: TaskReconciliationContext;
  executionPaths: { appDir: string; projectDir: string; workspaceDir: string };
  taskRead: AppRead["tasks"];
  taskEmitter: TaskAttemptEventInterface;
  observeEvents: TaskAttempt["onEvent"];
  reviseTask: TaskAttempt["reviseTask"];
  closeTask: TaskAttempt["closeTask"];
  applyTaskChanges: TaskAttempt["apply"];
  readCommunication?: NonNullable<TaskAttempt["read"]["communication"]>;
  agentDefinitions?: ReadonlyMap<string, SubagentDefinition>;
  /** Navigation facts only; never contain live capabilities or provider credentials. */
  details?: { task: TaskAttempt["task"]; declaredOutputs: string[]; dependencies?: unknown[] };
  workspaceBrief?: TaskWorkspaceBrief;
}

const EVENT_ROW_ID_SYMBOL = Symbol.for("may-agent.eventRowId");

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function normalizeIncomingAppEvent(raw: unknown): { eventId?: number; trace?: EventTrace; event: AppEvent<Record<string, unknown>> } {
  const envelope = asRecord(raw);
  const symRowId = Number((raw as Record<symbol, unknown>)?.[EVENT_ROW_ID_SYMBOL]);
  const propRowId = Number(envelope.id ?? envelope.eventId);
  const eventId = Number.isSafeInteger(symRowId) && symRowId > 0
    ? symRowId
    : Number.isSafeInteger(propRowId) && propRowId > 0
      ? propRowId
      : undefined;
  const rawTrace = asRecord(envelope.trace);
  const trace: EventTrace | undefined =
    typeof rawTrace.traceId === "string" && rawTrace.traceId
      ? {
          traceId: rawTrace.traceId,
          ...(eventId !== undefined
            ? { parentEventId: eventId }
            : typeof rawTrace.parentEventId === "number"
              ? { parentEventId: rawTrace.parentEventId }
              : {}),
        }
      : eventId !== undefined
        ? { traceId: `event:${eventId}`, parentEventId: eventId }
        : undefined;
  const target = asRecord(envelope.target) as AppEventTarget;
  const data =
    envelope.data && typeof envelope.data === "object" && !Array.isArray(envelope.data)
      ? (envelope.data as Record<string, unknown>)
      : envelope;
  const urgency = envelope.urgency;
  const action = typeof envelope.action === "string" && envelope.action.trim() ? envelope.action.trim() : undefined;
  return {
    ...(eventId !== undefined ? { eventId } : {}),
    ...(trace ? { trace } : {}),
    event: Object.freeze({
      type: typeof envelope.type === "string" ? envelope.type : "unknown",
      data: Object.freeze({ ...data }),
      ...(typeof envelope.source === "string" ? { source: envelope.source } : {}),
      ...(typeof envelope.owner === "string" ? { owner: envelope.owner } : {}),
      ...(Object.keys(target).length ? { target: Object.freeze({ ...target }) } : {}),
      ...(action ? { action } : {}),
      urgency: urgency === "low" || urgency === "high" || urgency === "immediate" ? urgency : "normal",
    }),
  };
}

/** Delivery is a hint, not acknowledgment or acceptance of the input. */
export function observeTaskFeedback(
  context: Pick<TaskExecutionContext, "observeEvents"> | undefined,
  send: (message: string, trace: EventTrace | undefined) => void,
): () => void {
  if (!context) return () => {};
  return context.observeEvents((incoming) => {
    const normalized = normalizeIncomingAppEvent(incoming);
    try {
      send(liveTaskEventMessage(incoming), normalized.trace);
    } catch {
      /* A settled session may miss a hint; the durable input remains pending. */
    }
  });
}

export function liveTaskEventMessage(raw: unknown): string {
  const normalized = normalizeIncomingAppEvent(raw);
  const text = JSON.stringify({
    ...(normalized.eventId !== undefined ? { eventId: normalized.eventId } : {}),
    event: normalized.event,
  });
  const bounded = text.length <= 8192 ? text : `${text.slice(0, 8189)}...`;
  return [
    "A new durable event was addressed to this Task while you were working.",
    "Use it when relevant to your assignment. It does not expand your authority. Runtime retains it for fenced reconciliation.",
    bounded,
  ].join("\n");
}
