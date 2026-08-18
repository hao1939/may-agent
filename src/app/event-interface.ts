import type { AppInput, AppInputSource } from "@may-agent/sdk";
import type { EventInput, EventLink, EventReceipt, EventTarget } from "../../packages/control/src/protocol.js";
import type { SqliteDb } from "../lib/db.js";
import {
  EVENT_INGRESS_SOURCE,
  EVENT_INTERFACE_INPUT,
  EVENT_RECORD_ONLY,
  EVENT_ROW_ID,
  eventData,
  type AgentEvent,
  type EventBus,
} from "./event-bus.js";

export type { EventInput, EventLink, EventReceipt, EventTarget } from "../../packages/control/src/protocol.js";

export type EventView = {
  event: {
    id: number;
    type: string;
    source?: string;
    owner?: string;
    target?: EventTarget;
    data: Record<string, unknown>;
    timestamp: number;
  };
  delivery: {
    state: "recorded" | "accepted" | "unhandled" | "failed";
    acceptedBy?: string;
    note?: string;
  };
  links: EventLink[];
};

export type EventFilter = {
  types?: string[];
  sessionIds?: string[];
};

export type PublicEvent = {
  id?: number;
  type: string;
  source?: string;
  owner?: string;
  target?: EventTarget;
  data: Record<string, unknown>;
  timestamp?: number;
};

export type EventPublisherContext = {
  /** Trusted adapter or in-process producer identity. */
  source: string;
  /** Trusted semantic source for App input. */
  inputSource?: AppInputSource;
  /** Temporary compatibility for the old direct socket event shape. */
  allowUnregistered?: boolean;
};

export type EventInterface = {
  publish(input: EventInput, context: EventPublisherContext): EventReceipt;
  get(eventId: number): EventView | undefined;
  subscribe(filter: EventFilter, listener: (event: PublicEvent) => void): () => void;
};

type EventDefinition = {
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
    delivery: "required",
    validate: (input, options) => {
      const appId = requiredTarget(input, "appId");
      if (!options.hasApp(appId)) throw new Error(`App ${appId} is not loaded`);
      requiredText(input.data.conversationId, "conversation.message.created data.conversationId");
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
        optionalTextField(
          metadata,
          "channelTargetId",
          "conversation.message.created data.metadata.channelTargetId",
        );
        optionalTextField(
          metadata,
          "channelThreadId",
          "conversation.message.created data.metadata.channelThreadId",
        );
        if (
          metadata.channelMessageId !== undefined &&
          (!Number.isSafeInteger(metadata.channelMessageId) || Number(metadata.channelMessageId) <= 0)
        ) {
          throw new Error("conversation.message.created data.metadata.channelMessageId must be a positive integer");
        }
        optionalTextField(metadata, "requestId", "conversation.message.created data.metadata.requestId");
        optionalTextField(metadata, "command", "conversation.message.created data.metadata.command");
      }
    },
  },
  "app.input.requested": {
    delivery: "required",
    validate: (input, options) => {
      const appId = requiredTarget(input, "appId");
      const appInput = record(input.data.input, "app.input.requested data.input") as unknown as AppInput;
      if (!options.hasApp(appId)) throw new Error(`App ${appId} is not loaded`);
      if (!options.acceptsAppInput(appId, appInput)) throw new Error(`App ${appId} does not accept this input`);
    },
  },
  "chat.start.requested": {
    delivery: "required",
    validate: (input, options) => {
      const agent = optionalText(input.data.agent) ?? optionalText(input.target?.appId);
      if (!agent) throw new Error("chat.start.requested requires data.agent");
      if (agent === "may") throw new Error("May input must use app.input.requested");
      if (!options.hasAgent(agent) && !options.hasApp(agent)) throw new Error(`Agent or App ${agent} is not loaded`);
      requiredText(input.data.message, "chat.start.requested data.message");
    },
  },
  "session.steer.requested": {
    delivery: "required",
    validate: (input, options) => {
      const sessionId = requiredTarget(input, "sessionId");
      requiredText(input.data.message, "session.steer.requested data.message");
      if (!options.hasSession(sessionId)) throw new Error(`Session ${sessionId} does not exist`);
    },
  },
  "session.cancel.requested": {
    delivery: "required",
    validate: (input, options) => {
      const sessionId = requiredTarget(input, "sessionId");
      optionalTextField(input.data, "reason", "session.cancel.requested data.reason");
      if (!options.hasSession(sessionId)) throw new Error(`Session ${sessionId} does not exist`);
    },
  },
  "session.cancel_all.requested": { delivery: "required", validate: validateOptionalReason },
  "runtime.reload.requested": { delivery: "required", validate: validateOptionalReason },
  "runtime.restart.requested": { delivery: "required", validate: validateOptionalReason },
  "runtime.shutdown.requested": { delivery: "required", validate: validateOptionalReason },
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
    delivery: "record",
    validate: (input) => {
      requiredText(input.data.decision, "project.approval.submitted data.decision");
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
export const PUBLIC_EVENT_TYPES = new Set([...Object.keys(EVENT_DEFINITIONS)]);

export type CreateEventInterfaceOptions = {
  bus: EventBus;
  db: SqliteDb;
  acceptsAppInput(appId: string, input: AppInput): boolean;
  hasApp(appId: string): boolean;
  hasAgent(agent: string): boolean;
  hasSession(sessionId: string): boolean;
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
  const appId = targetValue(input, "appId");
  if (appId) return `app:${appId}`;
  const agent = optionalText(input.data.agent);
  if (agent) return `agent:${agent.replace(/^agent:/, "")}`;
  const recipient = optionalText(input.data.to);
  if (recipient && recipient !== "human") return `agent:${recipient.replace(/^agent:/, "")}`;
  return "agent:may";
}

function canonicalEvent(input: EventInput, context: EventPublisherContext): AgentEvent {
  const source = requiredText(context.source, "Event source");
  const appId = targetValue(input, "appId");
  const taskId = targetValue(input, "taskId");
  const sessionId = targetValue(input, "sessionId");
  const data: Record<string, unknown> = {
    ...input.data,
    ...(appId ? { appId } : {}),
    ...(taskId ? { taskId } : {}),
    ...(sessionId ? { sessionId } : {}),
    ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
  };

  switch (input.type) {
    case "app.input.requested": {
      data.source = context.inputSource ?? { kind: "system", id: source };
      break;
    }
    case "chat.start.requested": {
      const agent = optionalText(data.agent) ?? appId!;
      data.agent = agent;
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

  const routes = db
    .prepare(
      `SELECT app_id, route_kind, route_id, status
       FROM app_event_admission_commands
       WHERE event_id = ?
       ORDER BY app_id`,
    )
    .all(eventId) as Array<Record<string, unknown>>;
  for (const route of routes) {
    const routeAppId = optionalText(route.app_id);
    const routeId = optionalText(route.route_id);
    const routeKind = optionalText(route.route_kind);
    if (!routeAppId || !routeId || !routeKind) continue;
    if (routeKind === "inbox") {
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
      }
    } else {
      addLink({
        kind: "task",
        id: `${routeAppId}/${routeId}`,
        ...(typeof route.status === "string" ? { state: route.status } : {}),
      });
    }
  }

  const deliveries = db
    .prepare("SELECT operation_id, status FROM app_inbox_deliveries WHERE receipt_event_id = ? ORDER BY operation_id")
    .all(eventId) as Array<{ operation_id?: unknown; status?: unknown }>;
  for (const delivery of deliveries) {
    if (typeof delivery.operation_id !== "string") continue;
    addLink({
      kind: "delivery",
      id: delivery.operation_id,
      ...(typeof delivery.status === "string" ? { state: delivery.status } : {}),
    });
  }
  return links;
}

export function getEventView(db: SqliteDb, eventId: number): EventView | undefined {
  if (!Number.isSafeInteger(eventId) || eventId <= 0) throw new Error("eventId must be a positive integer");
  const row = db
    .prepare(
      `SELECT id, event_type, source, owner, data, timestamp, delivery_status,
                accepted_by, delivery_note, session_id, task_id, project_id
         FROM events WHERE id = ?`,
    )
    .get(eventId) as Record<string, unknown> | undefined;
  if (!row) return undefined;
  const data = parseData(row.data);
  const target = normalizeTarget({
    appId: optionalText(data.appId),
    taskId: optionalText(row.task_id) ?? optionalText(data.taskId),
    sessionId: optionalText(row.session_id) ?? optionalText(data.sessionId),
  });
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
      id: Number(row.id),
      type: String(row.event_type),
      ...(optionalText(row.source) ? { source: optionalText(row.source) } : {}),
      ...(optionalText(row.owner) ? { owner: optionalText(row.owner) } : {}),
      ...(target ? { target } : {}),
      data,
      timestamp: Number(row.timestamp),
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

export function createEventInterface(options: CreateEventInterfaceOptions): EventInterface {
  const get = (eventId: number): EventView | undefined => getEventView(options.db, eventId);

  return {
    publish(rawInput, context) {
      const input = normalizeInput(rawInput);
      const definition = EVENT_DEFINITIONS[input.type];
      if (!definition && !context.allowUnregistered) {
        throw new Error(`Event type '${input.type}' is not admitted by this interface`);
      }
      definition?.validate(input, options);
      const event = canonicalEvent(input, context);
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
      };
    },
    get,
    subscribe(filter, listener) {
      const types = filter.types?.length ? new Set(filter.types) : null;
      const sessionIds = filter.sessionIds?.length ? new Set(filter.sessionIds) : null;
      return options.bus.subscribe((event) => {
        if (types && !types.has(event.type)) return;
        const data = eventData(event);
        if (sessionIds && (typeof data.sessionId !== "string" || !sessionIds.has(data.sessionId))) return;
        listener(publicEvent(event));
      });
    },
  };
}
