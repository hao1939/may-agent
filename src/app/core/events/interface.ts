import { readVerifiedApprovalDecision } from "@may-agent/control/events";
import type { AppInput, AppInputSource } from "@may-agent/sdk";
import type {
  EventInput,
  EventLink,
  EventReceipt,
  EventTarget,
  EventView,
  PublicEvent,
} from "@may-agent/control/events";
import { findPersistedEventId } from "../../../lib/db-writer.js";
import {
  ApprovalValidationError,
  approvalDecision,
  stampApproval,
  stampConversationApproval,
  validateCurrentApproval,
  type ApprovalIngressAuthorization,
} from "./approval.js";
import { readEventTaskTarget } from "./task-target.js";
import { readPersistedEventEnvelope } from "./persisted.js";
import { getAppEventAdmissionPlan } from "../state/app-event-admission-store.js";
import type { SqliteDb } from "../../../lib/db.js";
import {
  EVENT_INGRESS_SOURCE,
  EVENT_INTERFACE_INPUT,
  EVENT_RECORD_ONLY,
  EVENT_ROW_ID,
  eventData,
  type AgentEvent,
  type EventBus,
} from "./bus.js";

export type EventFilter = {
  types?: string[];
  sessionIds?: string[];
};

export type EventPublisherContext = {
  /** Trusted adapter or in-process producer identity. */
  source: string;
  /** Trusted semantic source for App input. */
  inputSource?: AppInputSource;
  /** Operator/in-process fact ingress may publish domain types not owned by Host routing. */
  allowUnregisteredFact?: boolean;
  /** Trusted adapter evidence for the formal approval boundary; payload provenance is ignored. */
  approvalAuthorization?: ApprovalIngressAuthorization;
};

export type EventInterface = {
  publish(input: EventInput, context: EventPublisherContext): EventReceipt;
  /** Trusted operator diagnostics, not a stable payload contract for every type. */
  get(eventId: number): EventView | undefined;
  /** Best-effort observations; slow/failing listeners never acknowledge work. */
  subscribe(filter: EventFilter, listener: (event: PublicEvent) => void | Promise<void>): () => void;
};

type EventDefinition = {
  taskControl?: "retry" | "close" | "cancel" | "reopen";
  /** Payload aliases that this contract defines as the addressed resource. */
  addressFields?: readonly (keyof EventTarget)[];
  delivery: "record" | "required";
  validate(input: EventInput, options: CreateEventInterfaceOptions): void;
};

/**
 * Host-owned ingress definitions. Apps add domain meaning through their input
 * schema and subscriptions; they do not register required delivery types.
 * Trusted in-process facts may remain unregistered and default to record-only.
 */
const EVENT_DEFINITIONS: Readonly<Record<string, EventDefinition>> = {
  "conversation.message.created": {
    addressFields: ["appId"],
    delivery: "required",
    validate: (input, options) => {
      const appId = requiredTarget(input, "appId");
      if (!options.hasApp(appId)) throw new Error(`App ${appId} is not loaded`);
      requiredText(input.data.conversationId, "conversation.message.created data.conversationId");
      optionalTextField(input.data, "messageId", "conversation.message.created data.messageId");
      requiredText(input.data.text, "conversation.message.created data.text");
      const author = record(input.data.author, "conversation.message.created data.author");
      const kind = requiredText(author.kind, "conversation.message.created data.author.kind");
      if (!(["human", "agent", "tool", "command"] as const).includes(kind as never)) {
        throw new Error("conversation.message.created data.author.kind is invalid");
      }
      requiredText(author.id, "conversation.message.created data.author.id");
      if (input.data.transient !== undefined && typeof input.data.transient !== "boolean") {
        throw new Error("conversation.message.created data.transient must be boolean");
      }
      optionalTextField(input.data, "replyTo", "conversation.message.created data.replyTo");
      if (input.data.context !== undefined) {
        record(input.data.context, "conversation.message.created data.context");
      }
      if (input.data.metadata !== undefined) {
        const metadata = record(input.data.metadata, "conversation.message.created data.metadata");
        optionalTextField(metadata, "channel", "conversation.message.created data.metadata.channel");
        optionalTextField(metadata, "channelTargetId", "conversation.message.created data.metadata.channelTargetId");
        optionalTextField(metadata, "channelThreadId", "conversation.message.created data.metadata.channelThreadId");
        if (
          metadata.channelMessageId !== undefined &&
          (!Number.isSafeInteger(metadata.channelMessageId) || Number(metadata.channelMessageId) <= 0)
        ) {
          throw new Error("conversation.message.created data.metadata.channelMessageId must be a positive integer");
        }
        optionalTextField(metadata, "requestId", "conversation.message.created data.metadata.requestId");
        optionalTextField(metadata, "command", "conversation.message.created data.metadata.command");
        optionalTextField(metadata, "topicId", "conversation.message.created data.metadata.topicId");
        if (metadata.followTask !== undefined) {
          const followTask = record(metadata.followTask, "conversation.message.created data.metadata.followTask");
          requiredText(followTask.appId, "conversation.message.created data.metadata.followTask.appId");
          requiredText(followTask.taskId, "conversation.message.created data.metadata.followTask.taskId");
        }
        if (
          metadata.taskRefs !== undefined &&
          (!Array.isArray(metadata.taskRefs) ||
            metadata.taskRefs.length > 100 ||
            metadata.taskRefs.some(
              (value) =>
                !value ||
                typeof value !== "object" ||
                Array.isArray(value) ||
                typeof (value as Record<string, unknown>).appId !== "string" ||
                !String((value as Record<string, unknown>).appId).trim() ||
                typeof (value as Record<string, unknown>).taskId !== "string" ||
                !String((value as Record<string, unknown>).taskId).trim(),
            ))
        ) {
          throw new Error(
            "conversation.message.created data.metadata.taskRefs must be an array of at most 100 canonical Task identities",
          );
        }
      }
    },
  },
  "app.input.requested": {
    addressFields: ["appId", "taskId"],
    delivery: "required",
    validate: (input, options) => {
      const appId = requiredTarget(input, "appId");
      optionalTextField(input.data, "targetTaskId", "app.input.requested data.targetTaskId");
      readEventTaskTarget(input);
      const appInput = record(input.data.input, "app.input.requested data.input") as unknown as AppInput;
      if (!options.hasApp(appId)) throw new Error(`App ${appId} is not loaded`);
      options.validateAppInput(appId, appInput);
    },
  },
  "app.task.retry.requested": {
    addressFields: ["appId", "taskId"],
    taskControl: "retry",
    delivery: "required",
    validate: (input, options) => validateTaskControl(input, options, false),
  },
  "conversation.turn.stop.requested": {
    addressFields: ["appId"],
    delivery: "required",
    validate: (input, options) => {
      const appId = requiredTarget(input, "appId");
      if (!options.hasApp(appId)) throw new Error(`App ${appId} is not loaded`);
      requiredText(input.data.conversationId, "conversationId");
      requiredText(input.data.turnId, "turnId");
      if (!Number.isSafeInteger(input.data.expectedRevision) || Number(input.data.expectedRevision) < 1) {
        throw new Error("expectedRevision must be a positive integer");
      }
    },
  },
  "app.task.cancel.requested": {
    addressFields: ["appId", "taskId"],
    taskControl: "cancel",
    delivery: "required",
    validate: (input, options) => validateTaskControl(input, options, true),
  },
  "app.task.reopen.requested": {
    addressFields: ["appId", "taskId"],
    taskControl: "reopen",
    delivery: "required",
    validate: (input, options) => {
      validateTaskControl(input, options, true);
      if (input.data.input !== undefined) {
        const appInput = record(input.data.input, "app.task.reopen.requested data.input") as unknown as AppInput;
        options.validateAppInput(requiredTarget(input, "appId"), appInput);
      }
    },
  },
  "app.task.close.requested": {
    addressFields: ["appId", "taskId"],
    taskControl: "close",
    delivery: "required",
    validate: (input, options) => {
      validateTaskControl(input, options, true);
      requiredText(input.data.afterResult, "app.task.close.requested data.afterResult");
    },
  },
  "chat.start.requested": {
    delivery: "required",
    validate: (input, options) => {
      if (input.target?.appId) throw new Error("App input must use app.input.requested");
      const agent = optionalText(input.data.agent);
      if (!agent) throw new Error("chat.start.requested requires data.agent");
      const appId = agent.replace(/\.app$/, "");
      if (appId === options.conversationAppId?.trim().replace(/\.app$/, ""))
        throw new Error(`${appId} input must use app.input.requested`);
      if (!options.hasAgent(agent)) throw new Error(`Agent ${agent} is not loaded`);
      requiredText(input.data.message, "chat.start.requested data.message");
    },
  },
  "session.steer.requested": {
    addressFields: ["sessionId"],
    delivery: "required",
    validate: (input, options) => {
      const sessionId = requiredTarget(input, "sessionId");
      requiredText(input.data.message, "session.steer.requested data.message");
      if (!options.hasSession(sessionId)) throw new Error(`Session ${sessionId} does not exist`);
      options.validateSessionControl?.(input.type, sessionId);
    },
  },
  "session.cancel.requested": {
    addressFields: ["sessionId"],
    delivery: "required",
    validate: (input, options) => {
      const sessionId = requiredTarget(input, "sessionId");
      optionalTextField(input.data, "reason", "session.cancel.requested data.reason");
      if (!options.hasSession(sessionId)) throw new Error(`Session ${sessionId} does not exist`);
      options.validateSessionControl?.(input.type, sessionId);
    },
  },
  "session.cancel_all.requested": {
    delivery: "required",
    validate: (input, options) => {
      validateOptionalReason(input);
      options.validateSessionControl?.(input.type);
    },
  },
  "runtime.reload.requested": {
    delivery: "required",
    validate: (input) => {
      validateOptionalReason(input);
      if (
        input.data.expectedSourceCommit !== undefined &&
        (typeof input.data.expectedSourceCommit !== "string" || !/^[0-9a-f]{40}$/.test(input.data.expectedSourceCommit))
      ) {
        throw new Error(
          "runtime.reload.requested data.expectedSourceCommit must be a 40-character lowercase Git commit",
        );
      }
    },
  },
  "runtime.restart.requested": { delivery: "required", validate: validateOptionalReason },
  "runtime.shutdown.requested": { delivery: "required", validate: validateOptionalReason },
  "evaluation.session.requested": {
    addressFields: ["appId", "sessionId"],
    delivery: "record",
    validate: (input, options) => {
      const appId = requiredTarget(input, "appId");
      const sessionId = requiredTarget(input, "sessionId");
      if (!options.hasApp(appId)) throw new Error(`App ${appId} is not loaded`);
      if (!options.hasSession(sessionId)) throw new Error(`Session ${sessionId} does not exist`);
      requiredText(input.data.source, "evaluation.session.requested data.source");
      requiredText(input.data.instructions, "evaluation.session.requested data.instructions");
    },
  },
  "metric.threshold_changed": {
    delivery: "record",
    validate: (input) => {
      requiredText(input.data.metricId, "metric.threshold_changed data.metricId");
      if (typeof input.data.to !== "number" || !Number.isFinite(input.data.to)) {
        throw new Error("metric.threshold_changed data.to must be a finite number");
      }
      if (
        input.data.from !== undefined &&
        input.data.from !== null &&
        (typeof input.data.from !== "number" || !Number.isFinite(input.data.from))
      ) {
        throw new Error("metric.threshold_changed data.from must be a finite number or null");
      }
    },
  },
  "metric.alert_resolved": {
    delivery: "record",
    validate: (input) => {
      requiredText(input.data.metricId, "metric.alert_resolved data.metricId");
      if (!Number.isSafeInteger(input.data.alertId) || Number(input.data.alertId) <= 0) {
        throw new Error("metric.alert_resolved data.alertId must be a positive integer");
      }
      if (input.data.reason !== undefined && input.data.reason !== null) {
        optionalTextField(input.data, "reason", "metric.alert_resolved data.reason");
      }
    },
  },
  "project.owner.requested": {
    delivery: "record",
    validate: (input) => {
      requiredText(input.data.reason, "project.owner.requested data.reason");
      if (
        !optionalText(input.target?.appId) &&
        !optionalText(input.data.project) &&
        !optionalText(input.data.projectId) &&
        !optionalText(input.data.projectPath)
      ) {
        throw new Error("project.owner.requested requires a project target");
      }
    },
  },
  "project.approval.submitted": {
    addressFields: ["appId", "taskId"],
    delivery: "record",
    validate: (input, options) => {
      requiredText(input.data.decision, "project.approval.submitted data.decision");
      validateCurrentApproval(input, options.db);
    },
  },
  "project.comment.created": {
    delivery: "record",
    validate: (input) => {
      requiredText(input.data.projectPath, "project.comment.created data.projectPath");
      requiredText(input.data.comment, "project.comment.created data.comment");
      optionalTextField(input.data, "author", "project.comment.created data.author");
    },
  },
};

export function eventDeliveryContract(type: string): "record" | "required" {
  return EVENT_DEFINITIONS[type]?.delivery ?? "record";
}

/** Types accepted by the new generic socket/HTTP publish operation. */
/** Ingress permission only. Never use this as an outbound observation filter. */
export const PUBLIC_EVENT_TYPES = new Set([...Object.keys(EVENT_DEFINITIONS)]);

export type CreateEventInterfaceOptions = {
  bus: EventBus;
  db: SqliteDb;
  validateAppInput(appId: string, input: AppInput): void;
  hasApp(appId: string): boolean;
  hasAgent(agent: string): boolean;
  hasSession(sessionId: string): boolean;
  /** Composition verifies that the selected execution controller owns the target. */
  validateSessionControl?(type: string, sessionId?: string): void;
  /** Composition selects the conversational App; its input must use durable admission. */
  conversationAppId?: string;
};

function requiredText(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} must be a non-empty string`);
  return value.trim();
}

function optionalText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function optionalTextField(value: Record<string, unknown>, key: string, field: string): void {
  if (value[key] !== undefined && !optionalText(value[key])) throw new Error(`${field} must be a non-empty string`);
}

function validateOptionalReason(input: EventInput): void {
  optionalTextField(input.data, "reason", `${input.type} data.reason`);
}

/** Classify using the existing ingress definitions, not a second routing list. */
export function taskControlAction(type: string): EventDefinition["taskControl"] {
  return EVENT_DEFINITIONS[type]?.taskControl;
}

function validateTaskControl(input: EventInput, options: CreateEventInterfaceOptions, requiresReason: boolean): void {
  const appId = requiredTarget(input, "appId");
  requiredTarget(input, "taskId");
  if (!options.hasApp(appId)) throw new Error(`App ${appId} is not loaded`);
  requiredText(input.idempotencyKey, `${input.type} idempotencyKey`);
  for (const field of ["expectedGeneration", "expectedResourceVersion"] as const) {
    const value = input.data[field];
    if (!Number.isSafeInteger(value) || Number(value) < 1) {
      throw new Error(`${input.type} data.${field} must be a positive integer`);
    }
  }
  if (requiresReason) requiredText(input.data.reason, `${input.type} data.reason`);
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${field} must be an object`);
  return value as Record<string, unknown>;
}

function normalizeTarget(value: EventTarget | undefined): EventTarget | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Event target must be an object");
  const unknown = Object.keys(value).filter((key) => !["appId", "taskId", "sessionId"].includes(key));
  if (unknown.length) throw new Error(`Event target contains unsupported field '${unknown[0]}'`);
  for (const [key, field] of Object.entries(value)) {
    if (field !== undefined && !optionalText(field)) throw new Error(`Event target.${key} must be a non-empty string`);
  }
  const target = {
    appId: optionalText(value.appId),
    taskId: optionalText(value.taskId),
    sessionId: optionalText(value.sessionId),
  };
  return Object.values(target).some(Boolean) ? target : undefined;
}

function normalizeInput(input: EventInput): EventInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Event input must be an object");
  const unknown = Object.keys(input).filter((key) => !["type", "target", "data", "idempotencyKey"].includes(key));
  if (unknown.length) throw new Error(`Event input contains Host-owned or unsupported field '${unknown[0]}'`);
  const type = requiredText(input.type, "Event type");
  if (!type.includes(".")) throw new Error(`Event type '${type}' must be namespaced`);
  const data = record(input.data, "Event data");
  const target = normalizeTarget(input.target);
  if (input.idempotencyKey !== undefined && !optionalText(input.idempotencyKey)) {
    throw new Error("Event idempotencyKey must be a non-empty string");
  }
  const idempotencyKey = optionalText(input.idempotencyKey);
  return {
    type,
    ...(target ? { target } : {}),
    data: { ...data },
    ...(idempotencyKey ? { idempotencyKey } : {}),
  };
}

function requiredTarget(input: EventInput, field: keyof EventTarget): string {
  return requiredText(input.target?.[field], `${input.type} target.${field}`);
}

function targetValue(input: EventInput, field: keyof EventTarget): string | undefined {
  const fromTarget = optionalText(input.target?.[field]);
  const fromData = optionalText(input.data[field]);
  if (fromTarget && fromData && fromTarget !== fromData) {
    throw new Error(`Event target.${field} conflicts with data.${field}`);
  }
  return fromTarget ?? fromData;
}

function eventOwner(input: EventInput): string {
  const appId = optionalText(input.target?.appId) ?? optionalText(input.data.appId);
  if (appId) return `app:${appId}`;
  const agent = optionalText(input.data.agent);
  if (agent) return `agent:${agent.replace(/^agent:/, "")}`;
  const recipient = optionalText(input.data.to);
  if (recipient && recipient !== "human") return `agent:${recipient.replace(/^agent:/, "")}`;
  return "agent:may";
}

function canonicalEvent(input: EventInput, context: EventPublisherContext): AgentEvent {
  const source = requiredText(context.source, "Event source");
  const address = Object.fromEntries((EVENT_DEFINITIONS[input.type]?.addressFields ?? []).flatMap((field) => {
    const value = targetValue(input, field);
    return value ? [[field, value]] : [];
  }));
  const data: Record<string, unknown> = {
    ...input.data,
    ...address,
    ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
  };

  switch (input.type) {
    case "app.input.requested": {
      data.source = context.inputSource ?? { kind: "system", id: source };
      break;
    }
  }

  const event = {
    type: input.type,
    source,
    owner: eventOwner(input),
    ...(input.target ? { target: input.target } : {}),
    data: structuredClone(data),
  } as AgentEvent;
  Object.defineProperty(event, EVENT_INGRESS_SOURCE, { value: source, configurable: true });
  Object.defineProperty(event, EVENT_INTERFACE_INPUT, { value: true, configurable: true });
  return event;
}

/** Canonical caller input, including adapter-owned approval attribution. */
function publicationInput(rawInput: EventInput, context: EventPublisherContext): EventInput {
  const input = normalizeInput(rawInput);
  if (input.type === "conversation.message.created")
    return stampConversationApproval(input, context.source, context.approvalAuthorization);
  if (input.type !== "project.approval.submitted") return input;
  requiredText(input.data.decision, "project.approval.submitted data.decision");
  if (!context.approvalAuthorization) throw new Error("Formal approval requires trusted ingress authorization");
  return stampApproval(input, requiredText(context.source, "Event source"), context.approvalAuthorization);
}

/** Confirm a publication without rerunning App routing or accepting a key-only receipt. */
export function findEventPublication(
  db: SqliteDb,
  input: EventInput,
  context: EventPublisherContext,
): number | undefined {
  return findPersistedEventId(db, canonicalEvent(publicationInput(input, context), context));
}

function publicEvent(event: AgentEvent & { [EVENT_ROW_ID]?: number }): PublicEvent {
  const envelope = event as AgentEvent & Record<string, unknown> & { [EVENT_ROW_ID]?: number };
  const canonicalData = envelope.data;
  const data =
    canonicalData && typeof canonicalData === "object" && !Array.isArray(canonicalData)
      ? { ...canonicalData }
      : Object.fromEntries(
          Object.entries(envelope).filter(
            ([key]) => !["type", "source", "owner", "target", "timestamp", "trace"].includes(key),
          ),
        );
  const rawTarget =
    envelope.target && typeof envelope.target === "object" && !Array.isArray(envelope.target)
      ? (envelope.target as Record<string, unknown>)
      : undefined;
  const target = rawTarget
    ? normalizeTarget({
        appId: optionalText(rawTarget.appId),
        taskId: optionalText(rawTarget.taskId),
        sessionId: optionalText(rawTarget.sessionId),
      })
    : undefined;
  const eventId = Number(envelope[EVENT_ROW_ID]);
  return {
    ...(Number.isSafeInteger(eventId) && eventId > 0 ? { id: eventId } : {}),
    type: event.type,
    ...(optionalText(envelope.source) ? { source: optionalText(envelope.source) } : {}),
    ...(optionalText(envelope.owner) ? { owner: optionalText(envelope.owner) } : {}),
    ...(target ? { target } : {}),
    data: structuredClone(data),
    ...(typeof envelope.timestamp === "number" && Number.isFinite(envelope.timestamp)
      ? { timestamp: envelope.timestamp }
      : {}),
  };
}

function parseData(value: unknown): Record<string, unknown> {
  if (typeof value !== "string") return {};
  try {
    return record(JSON.parse(value), "Stored event data");
  } catch {
    return {};
  }
}

function linksForEvent(db: SqliteDb, eventId: number, eventType: string, data: Record<string, unknown>): EventLink[] {
  const links: EventLink[] = [];
  const addLink = (link: EventLink): void => {
    if (!links.some((current) => current.kind === link.kind && current.id === link.id)) links.push(link);
  };
  const appId = optionalText(data.appId);
  const idempotencyKey = optionalText(data.idempotencyKey) ?? `event:${eventId}`;
  if (eventType === "runtime.reload.requested") {
    const completion = db
      .prepare(
        `SELECT e.id, e.data
         FROM event_traces t
         JOIN events e ON e.id = t.event_id
         WHERE t.parent_event_id = ?
           AND e.event_type = 'runtime.reload.finished'
         ORDER BY e.id DESC
         LIMIT 1`,
      )
      .get(eventId) as { id?: unknown; data?: unknown } | undefined;
    if (typeof completion?.id === "number") {
      const result = parseData(completion.data);
      addLink({
        kind: "operation",
        id: `event:${completion.id}`,
        state: result.ok === true ? "succeeded" : "failed",
        ...(optionalText(result.summary) ? { summary: optionalText(result.summary) } : {}),
      });
    }
  }
  const conversationAuthor =
    data.author && typeof data.author === "object" && !Array.isArray(data.author)
      ? (data.author as Record<string, unknown>)
      : undefined;
  if (
    (eventType === "app.input.requested" ||
      (eventType === "conversation.message.created" && conversationAuthor?.kind === "human")) &&
    appId
  ) {
    const item = db
      .prepare(
        `SELECT id, status FROM app_inbox_items
         WHERE app_id = ? AND (origin_event_id = ? OR idempotency_key = ?)
         ORDER BY CASE WHEN origin_event_id = ? THEN 0 ELSE 1 END
         LIMIT 1`,
      )
      .get(appId, eventId, idempotencyKey, eventId) as { id?: unknown; status?: unknown } | undefined;
    if (typeof item?.id === "string") {
      addLink({
        kind: "request",
        id: item.id,
        ...(typeof item.status === "string" ? { state: item.status } : {}),
      });
    }
  }

  const sessionId = optionalText(data.sessionId);
  if (sessionId) {
    const session = db.prepare("SELECT status FROM sessions WHERE sessionId = ?").get(sessionId) as
      { status?: unknown } | undefined;
    if (session) {
      addLink({
        kind: "session",
        id: sessionId,
        ...(typeof session.status === "string" ? { state: session.status } : {}),
      });
    }
  }

  const startedSession = db
    .prepare(
      `SELECT e.session_id, s.status
       FROM event_traces t
       JOIN events e ON e.id = t.event_id
       JOIN sessions s ON s.sessionId = e.session_id
       WHERE t.parent_event_id = ?
         AND e.event_type = 'session.start'
         AND e.session_id IS NOT NULL
       ORDER BY e.id
       LIMIT 1`,
    )
    .get(eventId) as { session_id?: unknown; status?: unknown } | undefined;
  if (typeof startedSession?.session_id === "string") {
    addLink({
      kind: "session",
      id: startedSession.session_id,
      ...(typeof startedSession.status === "string" ? { state: startedSession.status } : {}),
    });
  }

  for (const route of getAppEventAdmissionPlan(db, eventId)?.commands ?? []) {
    const { appId: routeAppId, routeId } = route;
    // A route label is not a Task identity. Saved Condition destinations
    // coexist with new work, exact targeting and inbox delivery.
    const taskIds = new Set(route.conditionTaskIds);
    if (route.kind === "task" && route.intent) taskIds.add(route.intent.id);
    if (route.kind === "exact-task") taskIds.add(route.targetedTaskId);
    for (const taskId of taskIds) {
      addLink({
        kind: "task",
        id: `${routeAppId}/${taskId}`,
        state: route.status,
        ...(route.lastError ? { summary: route.lastError } : {}),
      });
    }
    if (route.kind === "inbox") {
      const key = `subscription:${routeAppId}:${routeId}:event:${eventId}`;
      const item = db
        .prepare(
          `SELECT id, status FROM app_inbox_items
           WHERE app_id = ? AND (origin_event_id = ? OR idempotency_key = ?)
           ORDER BY CASE WHEN origin_event_id = ? THEN 0 ELSE 1 END
           LIMIT 1`,
        )
        .get(routeAppId, eventId, key, eventId) as { id?: unknown; status?: unknown } | undefined;
      if (typeof item?.id === "string") {
        addLink({
          kind: "request",
          id: item.id,
          ...(typeof item.status === "string" ? { state: item.status } : {}),
        });
        continue;
      }
    }
    if (route.kind !== "task" && route.kind !== "exact-task") {
      addLink({
        kind: "delivery",
        id: `app-event:${eventId}:${routeAppId}`,
        state: String(route.status),
        summary: route.lastError ??
          (route.kind === "noop" ? "App selected no work" : `App ${routeAppId} admission is pending`),
      });
    }
  }

  return links;
}

export function getEventView(db: SqliteDb, eventId: number): EventView | undefined {
  if (!Number.isSafeInteger(eventId) || eventId <= 0) throw new Error("eventId must be a positive integer");
  const row = db
    .prepare(
      `SELECT id, event_type, source, owner, data, timestamp, delivery_status,
                accepted_by, delivery_note, envelope_json
         FROM events WHERE id = ?`,
    )
    .get(eventId) as Record<string, unknown> | undefined;
  if (!row) return undefined;
  const data = parseData(row.data);
  const envelope = readPersistedEventEnvelope(row.envelope_json, String(row.event_type));
  const metadata = envelope ?? { type: row.event_type, source: row.source, owner: row.owner, timestamp: row.timestamp };
  const storedStatus = optionalText(row.delivery_status) ?? "pending";
  const required = eventDeliveryContract(String(row.event_type)) === "required";
  const state =
    storedStatus === "unhandled"
      ? "unhandled"
      : storedStatus === "failed"
        ? "failed"
        : required && storedStatus === "accepted"
          ? "accepted"
          : "recorded";
  return {
    event: {
      ...publicEvent({ ...metadata, data } as AgentEvent),
      id: Number(row.id),
      timestamp: Number(metadata.timestamp),
    },
    delivery: {
      state,
      ...(required && optionalText(row.accepted_by) ? { acceptedBy: optionalText(row.accepted_by) } : {}),
      ...((required || state === "unhandled" || state === "failed") && optionalText(row.delivery_note)
        ? { note: optionalText(row.delivery_note) }
        : {}),
    },
    links: linksForEvent(db, eventId, String(row.event_type), data),
  };
}

/** Called by the existing durable Conversation route before acknowledging human input. */
export function deliverConversationApproval(
  event: AgentEvent & { [EVENT_ROW_ID]?: number },
  db: SqliteDb,
  bus: EventBus,
): EventReceipt["approval"] {
  const data = eventData(event);
  if (!data.approvalReply || !approvalDecision(data.text)) return undefined;
  const reply = data.approvalReply as Record<string, unknown>;
  if (!reply.hostApproval)
    return { reason: "No valid, authorized proposal reply was supplied. Your text remains conversation." };
  const { target, ...decision } = reply;
  const input: EventInput = { type: "project.approval.submitted", target: target as EventTarget, data: decision };
  const source = requiredText((event as { source?: string }).source, "Saved input source");
  if (!readVerifiedApprovalDecision({ ...input, source }))
    throw new Error("Saved input has invalid approval attribution");
  const originalEventId = event[EVENT_ROW_ID];
  if (!originalEventId) throw new Error("Approval reply must be saved before delivery");
  const bound: EventInput = {
    ...input,
    data: { ...input.data, inputEventId: originalEventId },
    idempotencyKey: `input-approval:${originalEventId}`,
  };
  const canonical = canonicalEvent(bound, { source });
  // A saved decision remains the receipt even after its Condition has resolved.
  const prior = findPersistedEventId(db, canonical);
  if (!prior) {
    try {
      validateCurrentApproval(bound, db);
    } catch (error) {
      if (!(error instanceof ApprovalValidationError)) throw error;
      return { reason: `${error.message}. No approval was recorded; your text remains conversation.` };
    }
  }
  Object.defineProperty(canonical, EVENT_RECORD_ONLY, { value: true, configurable: true });
  const emitted = bus.emit(canonical);
  const eventId = emitted[EVENT_ROW_ID];
  if (!eventId) throw new Error("Approval decision was not durably saved");
  return { decision: String(input.data.decision), eventId };
}

function conversationApprovalReceipt(
  db: SqliteDb,
  eventId: number,
  source: string,
  data: Record<string, unknown>,
): EventReceipt["approval"] {
  if (!data.approvalReply || !approvalDecision(data.text)) return undefined;
  if (!(data.approvalReply as Record<string, unknown>).hostApproval)
    return { reason: "No valid, authorized proposal reply was supplied. Your text remains conversation." };
  const row = db
    .prepare(
      "SELECT id, data FROM events WHERE event_type = 'project.approval.submitted' AND source = ? AND idempotency_key = ? LIMIT 1",
    )
    .get(source, `input-approval:${eventId}`) as { id: number; data: string } | undefined;
  return row
    ? { eventId: row.id, decision: String(parseData(row.data).decision) }
    : { reason: "No approval recorded. Read the current proposal or discuss it with May." };
}

export function createEventInterface(options: CreateEventInterfaceOptions): EventInterface {
  const get = (eventId: number): EventView | undefined => getEventView(options.db, eventId);

  return {
    publish(rawInput, context) {
      const input = publicationInput(rawInput, context);
      const definition = EVENT_DEFINITIONS[input.type];
      if (!definition && !context.allowUnregisteredFact) {
        throw new Error(`Event type '${input.type}' is not admitted by this interface`);
      }
      if (input.type === "app.task.reopen.requested" && context.source !== "control-socket")
        throw new Error("Task reopening requires explicit operator control");
      const event = canonicalEvent(input, context);
      // A recorded decision keeps its receipt after the Condition changes.
      // Still use normal publication so the bus can finish interrupted routing.
      const savedApproval = input.type === "project.approval.submitted" && findPersistedEventId(options.db, event);
      if (!savedApproval) definition?.validate(input, options);
      if (definition?.delivery !== "required") {
        Object.defineProperty(event, EVENT_RECORD_ONLY, { value: true, configurable: true });
      }
      const emitted = options.bus.emit(event);
      const eventId = Number(emitted[EVENT_ROW_ID]);
      if (!Number.isSafeInteger(eventId) || eventId <= 0) {
        throw new Error(`Event ${input.type} was not durably persisted`);
      }
      const view = get(eventId);
      if (!view) throw new Error(`Persisted event ${eventId} is unavailable`);
      return {
        eventId,
        eventType: input.type,
        delivery: view.delivery.state === "accepted" ? "accepted" : "recorded",
        ...(view.links.length ? { links: view.links } : {}),
        ...(input.type === "conversation.message.created" && view.delivery.state === "accepted"
          ? { approval: conversationApprovalReceipt(options.db, eventId, context.source, input.data) } : {}),
      };
    },
    get,
    subscribe(filter, listener) {
      const types = filter.types?.length ? new Set(filter.types) : null;
      const sessionIds = filter.sessionIds?.length ? new Set(filter.sessionIds) : null;
      return options.bus.listen(
        (event) => {
          const data = eventData(event);
          if (sessionIds && (typeof data.sessionId !== "string" || !sessionIds.has(data.sessionId))) return;
          return listener(publicEvent(event));
        },
        { label: "event-interface", ...(types ? { types: [...types] } : {}) },
      );
    },
  };
}
