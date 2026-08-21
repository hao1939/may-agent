import {
  childEventTrace,
  EVENT_ROW_ID,
  EVENT_TASK_EMISSION_FENCE,
  type AgentEvent,
  type EventBus,
  type EventTaskEmissionFence,
} from "./event-bus.js";
import type { AppTaskClaim } from "./app-task-reconciler.js";

export type AppTaskEmission = {
  type: string;
  data?: Record<string, unknown>;
  target?: Record<string, unknown>;
  owner?: string;
  urgency?: "low" | "normal" | "high" | "immediate";
  ttl_ms?: number;
};

export type AppTaskEmitter = {
  emit(localKey: string, event: AppTaskEmission): number;
};

/**
 * An execution-scoped event capability. DbWriter checks the hidden fence in
 * the same transaction that appends the event. The stable key is scoped to the
 * task generation, so a replacement attempt receives the original receipt.
 */
export function createAppTaskEmitter(input: {
  bus: EventBus;
  appId: string;
  claim: Pick<AppTaskClaim, "taskId" | "generation" | "attemptId" | "owner">;
  parentEvent?: AgentEvent;
}): AppTaskEmitter {
  const appId = input.appId.trim().replace(/\.app$/, "");
  return {
    emit(localKey, emitted) {
      const key = localKey.trim();
      if (!key || key.length > 256) throw new Error("Task emit localKey must contain 1-256 characters");
      if (!emitted.type.includes(".")) throw new Error("Task emit requires a canonical dot-separated event type");
      if (emitted.type === "app.input.requested") {
        throw new Error("Cross-App result work must use a typed Task dependency, not events.emit");
      }
      const idempotencyKey = `task:${appId}:${input.claim.taskId}:${input.claim.generation}:emit:${key}`;
      const event = {
        type: emitted.type,
        source: `app-task:${appId}`,
        owner: emitted.owner ?? `agent:${input.claim.owner}`,
        ...(emitted.target ? { target: emitted.target } : {}),
        ...(emitted.urgency ? { urgency: emitted.urgency } : {}),
        ...(typeof emitted.ttl_ms === "number" ? { ttl_ms: emitted.ttl_ms } : {}),
        data: {
          ...(emitted.data ?? {}),
          idempotencyKey,
          emission: {
            appId,
            taskId: input.claim.taskId,
            generation: input.claim.generation,
            localKey: key,
          },
        },
        ...(childEventTrace(input.parentEvent) ? { trace: childEventTrace(input.parentEvent) } : {}),
      } as unknown as AgentEvent;
      const fence: EventTaskEmissionFence = {
        appId,
        taskId: input.claim.taskId,
        taskGeneration: input.claim.generation,
        attemptId: input.claim.attemptId,
        localKey: key,
      };
      Object.defineProperty(event, EVENT_TASK_EMISSION_FENCE, { value: Object.freeze(fence) });
      const accepted = input.bus.emit(event);
      const eventId = Number(accepted[EVENT_ROW_ID]);
      if (!Number.isSafeInteger(eventId) || eventId <= 0) {
        throw new Error(`Task emission ${key} did not receive a durable event identity`);
      }
      return eventId;
    },
  };
}
