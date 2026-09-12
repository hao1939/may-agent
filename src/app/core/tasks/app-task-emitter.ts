import {
  childEventTrace,
  EVENT_ROW_ID,
  EVENT_TASK_EMISSION_FENCE,
  type AgentEvent,
  type EventBus,
  type EventTaskEmissionFence,
} from "../events/bus.js";
import type { AppTaskClaim } from "./app-task-reconciler.js";
import type { SqliteDb } from "../../../lib/db.js";
import { findTaskEmission, readTaskEmission, taskEmissionIdentity } from "../state/task-emissions.js";

export type AppTaskEmission = {
  type: string;
  data?: Record<string, unknown>;
  target?: Record<string, unknown>;
  owner?: string;
  action?: string;
  urgency?: "low" | "normal" | "high" | "immediate";
  ttl_ms?: number;
};

export type AppTaskEmitter = {
  emit(localKey: string, event: AppTaskEmission): number;
};

export type AppTaskEvents = {
  /** Read the original published fact before redoing work with external effects. */
  read(type: string, localKey: string): { eventId: number; data: Record<string, unknown> } | null;
  /** Publish one durable fact from the current fenced attempt. */
  publish(localKey: string, event: AppTaskEmission): number;
  /**
   * Observe new durable events addressed to this Task while the attempt is
   * live. The Task's persisted event batch remains the recovery authority.
   */
  onEvent(listener: (event: AgentEvent) => void): () => void;
};

type TaskEventListener = (event: AgentEvent) => void;
type TaskEventMux = {
  listeners: Map<string, Set<TaskEventListener>>;
};

const taskEventMuxByBus = new WeakMap<EventBus, TaskEventMux>();

type PublicationListener = (event: AgentEvent, eventId: number) => void;
const publicationListeners = new WeakMap<EventBus, Map<string, Set<PublicationListener>>>();
type PublicationScope = { appId: string; taskId: string; generation: number; attemptId: string };
function publicationKey(scope: PublicationScope): string {
  return JSON.stringify([scope.appId, scope.taskId, scope.generation, scope.attemptId]);
}

/** Observe receipts, including idempotent returns that deliberately skip bus fan-out. */
export function subscribeAppTaskPublications(
  bus: EventBus,
  scope: PublicationScope,
  listener: PublicationListener,
): () => void {
  const scopes = publicationListeners.get(bus) ?? new Map<string, Set<PublicationListener>>();
  publicationListeners.set(bus, scopes);
  const key = publicationKey(scope);
  const listeners = scopes.get(key) ?? new Set<PublicationListener>();
  scopes.set(key, listeners);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) scopes.delete(key);
  };
}

function normalizedAppId(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\.app$/, "") : "";
}

function taskTargetKey(event: AgentEvent): string | null {
  const envelope = event as AgentEvent & { target?: Record<string, unknown> };
  const target =
    envelope.target && typeof envelope.target === "object" && !Array.isArray(envelope.target) ? envelope.target : {};
  const appId = [target.appId, target.project].map(normalizedAppId).find(Boolean) ?? "";
  const taskId =
    typeof (target as Record<string, unknown>).taskId === "string"
      ? String((target as Record<string, unknown>).taskId).trim()
      : "";
  return appId && taskId ? `${appId}\0${taskId}` : null;
}

function taskEventMux(bus: EventBus): TaskEventMux {
  const existing = taskEventMuxByBus.get(bus);
  if (existing) return existing;
  const listeners = new Map<string, Set<TaskEventListener>>();
  bus.listen(
    (event) => {
      const key = taskTargetKey(event);
      if (!key) return;
      for (const listener of listeners.get(key) ?? []) listener(event);
    },
    { label: "task-attempt-events" },
  );
  const created = { listeners };
  taskEventMuxByBus.set(bus, created);
  return created;
}

/** One executor-neutral Task event interface for a claimed attempt. */
export function createAppTaskEvents(input: {
  bus: EventBus;
  db: SqliteDb;
  persistDir?: string;
  appId: string;
  claim: Pick<AppTaskClaim, "taskId" | "generation" | "attemptId" | "agent">;
  parentEvent?: AgentEvent;
}): AppTaskEvents {
  const emitter = createAppTaskEmitter(input);
  const appId = normalizedAppId(input.appId);
  const key = `${appId}\0${input.claim.taskId}`;
  return {
    read: (type, localKey) => readTaskEmission(input.db, { appId, ...input.claim }, type, localKey, input.persistDir),
    publish: emitter.emit,
    onEvent(listener) {
      const mux = taskEventMux(input.bus);
      const listeners = mux.listeners.get(key) ?? new Set<TaskEventListener>();
      listeners.add(listener);
      mux.listeners.set(key, listeners);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) mux.listeners.delete(key);
      };
    },
  };
}

/**
 * An execution-scoped event capability. DbWriter checks the hidden fence in
 * the same transaction that appends the event. The stable key is scoped to the
 * task generation, so a replacement attempt receives the original receipt.
 */
export function createAppTaskEmitter(input: {
  bus: EventBus;
  db: SqliteDb;
  appId: string;
  claim: Pick<AppTaskClaim, "taskId" | "generation" | "attemptId" | "agent">;
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
      const scope = { appId, ...input.claim };
      const idempotencyKey =
        findTaskEmission(input.db, scope, emitted.type, key)?.idempotencyKey ?? taskEmissionIdentity(scope, key);
      const event = {
        type: emitted.type,
        source: `app-task:${appId}`,
        owner: emitted.owner ?? `agent:${input.claim.agent}`,
        ...(emitted.target ? { target: emitted.target } : {}),
        ...(emitted.action ? { action: emitted.action } : {}),
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
      for (const listener of publicationListeners.get(input.bus)?.get(publicationKey(scope)) ?? []) {
        listener(accepted, eventId);
      }
      return eventId;
    },
  };
}
