import { chmodSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { connect, createServer, type Server } from "node:net";
import { dirname } from "node:path";
import type { Duplex } from "node:stream";
import {
  taskCancelRequestedEvent,
  taskCloseRequestedEvent,
  taskReopenRequestedEvent,
  type EventInput,
  type EventReceipt,
  type EventView,
} from "./events.js";
import { normalizeSocketFrame } from "./protocol.js";
import { isTaskDerivedViewWake, taskUpdateIdentity } from "./task-wake.js";

export type ControlEvent = Record<string, unknown> & { type: string };
export type ControlEmitResult = { eventId?: number };
export type ApprovalIngressAuthorization = {
  actor: { kind: "operator"; id: string };
  reference: string;
  evidence: Record<string, unknown>;
};

export interface ControlStatusItem {
  agent: string;
  sessionId: string;
  status: string;
  kind?: string;
  task: string;
}

export type ControlStatusSnapshot = { sessions: ControlStatusItem[]; activeWork: boolean };
export type ControlStatus = ControlStatusItem[] | ControlStatusSnapshot;

export interface AttachControlSocketOptions {
  conversationAppId?: string;
  socketPath: string;
  getStatus: () => ControlStatus;
  getDiagnostics?: () => Record<string, unknown>;
  emitEvent: (event: ControlEvent) => ControlEmitResult | void;
  publishEvent?: (event: EventInput, approvalAuthorization?: ApprovalIngressAuthorization) => EventReceipt;
  getEvent?: (eventId: number) => EventView | undefined;
  describeProjectActions?: (projectId: string) => unknown[];
  admitAppInput?: (input: {
    appId: string;
    targetTaskId?: string;
    input: Record<string, unknown>;
    source: Record<string, unknown>;
    conversationId?: string;
    conversationSequence?: number;
    channel?: string;
    channelTargetId?: string;
    channelThreadId?: string;
    channelMessageId?: number;
    replyToSourceId?: string;
    idempotencyKey: string;
  }) => {
    eventId: number;
    eventType: string;
  };
  getAppConversation?: (
    appId: string,
    conversationId: string,
    options?: { limit?: number; topicId?: string; topicLimit?: number; topicCursor?: string },
  ) => unknown;
  getAppTaskWorkload?: (appId: string, options?: { agent?: string; limit?: number; cursor?: string; inputCursor?: string }) => unknown;
  listAppTasks?: (appId: string, options?: { status?: string[]; limit?: number; cursor?: string }) => unknown;
  getAppTask?: (
    appId: string,
    taskId: string,
    options?: { acceptedEvidence?: { limit?: number; cursor?: string }; inputKeys?: string[] },
  ) => unknown;
  listApps?: (appId?: string) => unknown;
  listTasks?: (options?: {
    appId?: string;
    includeDone?: boolean;
    humanActionOnly?: boolean;
    status?: string[];
    limit?: number;
    cursor?: string;
  }) => unknown;
  getTask?: (input: {
    ref?: string;
    appId?: string;
    taskId?: string;
    acceptedEvidence?: { limit?: number; cursor?: string };
  }) => unknown;
  invokeProjectAction?: (input: { projectId: string; actionId: string; params: unknown; idempotencyKey?: string }) => {
    eventId: number;
    eventType: string;
  };
  subscribeEvents: (handler: (event: ControlEvent) => void) => () => void;
  onInfo?: (message: string) => void;
  /** Interface agent label, kept for compatibility with existing welcome frames. */
  agentName: string;
  /** Daemon instance label. The socket is shared by the whole instance. */
  instance: string;
}

export interface ControlSocket {
  close: () => void;
  clientCount: () => number;
}

interface ClientState {
  socket: Duplex;
  filter: Set<string> | null;
  conversations: Set<string>;
  taskApps: Set<string>;
  task: { appId: string; taskId: string } | null;
  subscribed: boolean;
}

export const CONTROL_SOCKET_LIMITS = {
  maxFrameBytes: 1_048_576,
  maxIncompleteBufferBytes: 1_048_576,
  maxOutboundBufferBytes: 1_048_576,
  maxConnections: 64,
  maxErrorPreviewBytes: 160,
} as const;

export function isSocketAlive(socketPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const client = connect(socketPath);
    const timer = setTimeout(() => {
      client.destroy();
      resolve(false);
    }, 1000);
    client.on("connect", () => {
      clearTimeout(timer);
      client.destroy();
      resolve(true);
    });
    client.on("error", () => {
      clearTimeout(timer);
      resolve(false);
    });
  });
}

function activeStatus(status: ControlStatusItem[]): ControlStatusItem[] {
  return status
    .filter((item) => item.status === "running" || item.status === "idle")
    .map((item) => ({
      agent: item.agent,
      sessionId: item.sessionId,
      status: item.status,
      kind: item.kind ?? "",
      task: item.task.slice(0, 100),
    }));
}

function statusFields(status: ControlStatus): Record<string, unknown> {
  return Array.isArray(status)
    ? { activeAgents: activeStatus(status) }
    : { activeAgents: activeStatus(status.sessions), activeWork: status.activeWork };
}

function acceptedEvidenceOptions(frame: Record<string, unknown>): {
  acceptedEvidence?: { limit?: number; cursor?: string };
} {
  if (frame.acceptedEvidence !== true) {
    if (frame.acceptedEvidence !== undefined && frame.acceptedEvidence !== false)
      throw new Error("acceptedEvidence must be a boolean");
    if (frame.evidenceLimit !== undefined || frame.evidenceCursor !== undefined)
      throw new Error("acceptedEvidence=true is required for evidence pagination");
    return {};
  }
  if (frame.evidenceLimit !== undefined && !Number.isSafeInteger(frame.evidenceLimit))
    throw new Error("evidenceLimit must be an integer");
  if (frame.evidenceCursor !== undefined && (typeof frame.evidenceCursor !== "string" || !frame.evidenceCursor.trim()))
    throw new Error("evidenceCursor must be a non-empty string");
  return {
    acceptedEvidence: {
      ...(frame.evidenceLimit === undefined ? {} : { limit: frame.evidenceLimit as number }),
      ...(typeof frame.evidenceCursor === "string" ? { cursor: frame.evidenceCursor.trim() } : {}),
    },
  };
}

function runtimeDiagnostics(): Record<string, unknown> {
  const memory = process.memoryUsage();
  const cpu = process.cpuUsage();
  return {
    pid: process.pid,
    uptimeSeconds: process.uptime(),
    cpu: {
      userMicros: cpu.user,
      systemMicros: cpu.system,
    },
    memory: {
      rssBytes: memory.rss,
      heapTotalBytes: memory.heapTotal,
      heapUsedBytes: memory.heapUsed,
      externalBytes: memory.external,
      arrayBuffersBytes: memory.arrayBuffers,
    },
  };
}

function shouldForward(client: ClientState, event: ControlEvent): boolean {
  if (!client.subscribed) return false;
  const data = eventPayload(event);
  // Runtime control results are correlated by requestId in the initiating
  // adapter rather than by an agent session.
  if (event.type === "runtime.reload.finished") return true;
  if (event.type === "conversation.updated") {
    return typeof data.conversationId === "string" && client.conversations.has(data.conversationId);
  }
  if (!client.filter) return true;
  if (typeof data.sessionId === "string") return client.filter.has(data.sessionId);
  if (event.type === "message.created" && data.to === "human") return false;
  return false;
}

function eventPayload(event: ControlEvent): Record<string, unknown> {
  return event.data && typeof event.data === "object" && !Array.isArray(event.data)
    ? (event.data as Record<string, unknown>)
    : event;
}

export interface ControlSocketCoreOptions {
  conversationAppId?: string;
  getStatus: () => ControlStatus;
  getDiagnostics?: AttachControlSocketOptions["getDiagnostics"];
  emitEvent: (event: ControlEvent) => ControlEmitResult | void;
  publishEvent?: AttachControlSocketOptions["publishEvent"];
  getEvent?: AttachControlSocketOptions["getEvent"];
  describeProjectActions?: AttachControlSocketOptions["describeProjectActions"];
  admitAppInput?: AttachControlSocketOptions["admitAppInput"];
  getAppConversation?: AttachControlSocketOptions["getAppConversation"];
  listAppTasks?: AttachControlSocketOptions["listAppTasks"];
  getAppTaskWorkload?: AttachControlSocketOptions["getAppTaskWorkload"];
  getAppTask?: AttachControlSocketOptions["getAppTask"];
  listApps?: AttachControlSocketOptions["listApps"];
  listTasks?: AttachControlSocketOptions["listTasks"];
  getTask?: AttachControlSocketOptions["getTask"];
  invokeProjectAction?: AttachControlSocketOptions["invokeProjectAction"];
  subscribeEvents: (handler: (event: ControlEvent) => void) => () => void;
  agentName: string;
  instance: string;
}

export function createControlSocketCore(opts: ControlSocketCoreOptions): {
  attachClient: (socket: Duplex) => void;
  close: () => void;
  clientCount: () => number;
} {
  const {
    getStatus,
    emitEvent,
    publishEvent,
    getEvent,
    admitAppInput,
    getAppConversation,
    listAppTasks,
    getAppTaskWorkload,
    getAppTask,
    listApps,
    listTasks,
    getTask,
    describeProjectActions,
    invokeProjectAction,
    subscribeEvents,
    agentName,
    instance,
  } = opts;
  const clients = new Map<Duplex, ClientState>();
  function writeFrame(socket: Duplex, frame: Record<string, unknown>): boolean {
    if (socket.writableLength > CONTROL_SOCKET_LIMITS.maxOutboundBufferBytes) {
      clients.delete(socket);
      socket.destroy(new Error("Control socket outbound buffer limit exceeded"));
      return false;
    }
    const writable = socket.write(JSON.stringify(frame) + "\n");
    if (!writable && socket.writableLength > CONTROL_SOCKET_LIMITS.maxOutboundBufferBytes) {
      clients.delete(socket);
      socket.destroy(new Error("Control socket client is too slow"));
      return false;
    }
    return true;
  }

  function broadcast(event: ControlEvent): void {
    const data = eventPayload(event);
    if (clients.size === 0) return;

    if (
      event.type === "session.start" &&
      typeof data.parentSessionId === "string" &&
      typeof data.sessionId === "string"
    ) {
      for (const client of clients.values()) {
        if (client.filter?.has(data.parentSessionId)) client.filter.add(data.sessionId);
      }
    }

    let line: string | undefined;
    for (const [sock, client] of clients) {
      if (!shouldForward(client, event)) continue;
      try {
        line ??= JSON.stringify(event) + "\n";
        if (sock.writableLength + Buffer.byteLength(line) > CONTROL_SOCKET_LIMITS.maxOutboundBufferBytes) {
          clients.delete(sock);
          sock.destroy(new Error("Control socket client is too slow"));
          continue;
        }
        sock.write(line);
      } catch {
        clients.delete(sock);
      }
    }

    const wake = taskUpdateIdentity(event);
    if (!wake) return;
    const derivedViewWake = isTaskDerivedViewWake(event);
    let wakeLine: string | undefined;
    for (const [sock, client] of clients) {
      if (
        !client.subscribed ||
        !(
          (client.task?.appId === wake.appId && client.task.taskId === wake.taskId) ||
          (derivedViewWake && client.taskApps.has(wake.appId))
        )
      ) {
        continue;
      }
      try {
        wakeLine ??= `${JSON.stringify({ type: "app.task.updated", data: wake })}\n`;
        if (sock.writableLength + Buffer.byteLength(wakeLine) > CONTROL_SOCKET_LIMITS.maxOutboundBufferBytes) {
          clients.delete(sock);
          sock.destroy(new Error("Control socket client is too slow"));
          continue;
        }
        sock.write(wakeLine);
      } catch {
        clients.delete(sock);
      }
    }
  }

  const unsubscribe = subscribeEvents(broadcast);

  const controlHandlers: Record<string, (frame: Record<string, unknown>) => Record<string, unknown>> = {
    status: (frame) => {
      try {
        return {
          type: "status",
          ...statusFields(getStatus()),
          ...(frame.diagnostics === true ? { diagnostics: { ...runtimeDiagnostics(), ...opts.getDiagnostics?.() } } : {}),
        };
      } catch {
        throw new Error("Execution status unavailable");
      }
    },
    publish: (frame) => {
      const input = frame.event;
      if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw new Error("publish requires object field 'event'");
      }
      if (!publishEvent) throw new Error("Event publication is unavailable");
      const event = input as Record<string, unknown>;
      const eventType = typeof event.type === "string" ? event.type.trim() : "";
      const data = event.data;
      const target = event.target;
      if (!eventType) throw new Error("Event type is required");
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new Error("Event data must be an object");
      }
      if (target !== undefined && (!target || typeof target !== "object" || Array.isArray(target))) {
        throw new Error("Event target must be an object");
      }
      const eventData = data as Record<string, unknown>;
      const eventTarget = target as EventInput["target"] | undefined;
      const approvalAuthorization =
        (eventType === "project.approval.submitted" ||
          (eventType === "conversation.message.created" && frame.operatorId && eventData.approvalReply))
          ? {
              actor: {
                kind: "operator" as const,
                id: typeof frame.operatorId === "string" ? frame.operatorId.trim() : "",
              },
              reference:
                typeof frame.authorizationReference === "string" ? frame.authorizationReference.trim() : "",
              evidence:
                frame.authorizationEvidence &&
                typeof frame.authorizationEvidence === "object" &&
                !Array.isArray(frame.authorizationEvidence)
                  ? (frame.authorizationEvidence as Record<string, unknown>)
                  : {},
            }
          : undefined;
      return publishEvent(
        {
          type: eventType,
          ...(eventTarget ? { target: eventTarget } : {}),
          data: eventData,
          ...(typeof event.idempotencyKey === "string" && event.idempotencyKey.trim()
            ? { idempotencyKey: event.idempotencyKey.trim() }
            : {}),
        },
        approvalAuthorization,
      );
    },
    "event.get": (frame) => {
      const eventId = Number(frame.eventId);
      if (!Number.isSafeInteger(eventId) || eventId <= 0) throw new Error("eventId must be a positive integer");
      if (!getEvent) throw new Error("Event reads are unavailable");
      const event = getEvent(eventId);
      if (!event) throw new Error(`Event ${eventId} was not found`);
      return { event };
    },
    "app.input.admit": (frame) => {
      const appId = typeof frame.appId === "string" ? frame.appId.trim() : "";
      const input = frame.input;
      const source = frame.source;
      const idempotencyKey = typeof frame.idempotencyKey === "string" ? frame.idempotencyKey.trim() : "";
      if (!appId) throw new Error("appId is required");
      if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("input must be an object");
      if (!source || typeof source !== "object" || Array.isArray(source)) throw new Error("source must be an object");
      if (!idempotencyKey) throw new Error("idempotencyKey is required");
      if (!admitAppInput) throw new Error("App input admission is unavailable");
      const hasTargetTaskId = frame.targetTaskId !== undefined;
      const targetTaskId = typeof frame.targetTaskId === "string" ? frame.targetTaskId.trim() : "";
      if (hasTargetTaskId && !targetTaskId) throw new Error("targetTaskId must be a non-empty string");
      const result = admitAppInput({
        appId,
        input: input as Record<string, unknown>,
        source: source as Record<string, unknown>,
        ...(targetTaskId ? { targetTaskId } : {}),
        ...(typeof frame.conversationId === "string" && frame.conversationId.trim()
          ? { conversationId: frame.conversationId.trim() }
          : {}),
        ...(typeof frame.conversationSequence === "number"
          ? { conversationSequence: frame.conversationSequence }
          : {}),
        ...(typeof frame.channel === "string" && frame.channel.trim() ? { channel: frame.channel.trim() } : {}),
        ...(typeof frame.channelTargetId === "string" && frame.channelTargetId.trim()
          ? { channelTargetId: frame.channelTargetId.trim() }
          : {}),
        ...(typeof frame.channelThreadId === "string" && frame.channelThreadId.trim()
          ? { channelThreadId: frame.channelThreadId.trim() }
          : {}),
        ...(typeof frame.channelMessageId === "number" ? { channelMessageId: frame.channelMessageId } : {}),
        ...(typeof frame.replyToSourceId === "string" && frame.replyToSourceId.trim()
          ? { replyToSourceId: frame.replyToSourceId.trim() }
          : {}),
        idempotencyKey,
      });
      return { appId, ...result };
    },
    "app.conversation.get": (frame) => {
      const appId = typeof frame.appId === "string" ? frame.appId.trim() : "";
      const conversationId = typeof frame.conversationId === "string" ? frame.conversationId.trim() : "";
      if (!appId) throw new Error("appId is required");
      if (!conversationId) throw new Error("conversationId is required");
      if (!getAppConversation) throw new Error("App conversation reads are unavailable");
      const limit = frame.limit === undefined ? undefined : Number(frame.limit);
      const topicId = typeof frame.topicId === "string" ? frame.topicId.trim() : "";
      const topicCursor = typeof frame.topicCursor === "string" ? frame.topicCursor.trim() : "";
      const topicLimit = frame.topicLimit === undefined ? undefined : Number(frame.topicLimit);
      return {
        appId,
        conversationId,
        conversation: getAppConversation(appId, conversationId, {
          limit,
          ...(topicId ? { topicId } : {}),
          ...(topicCursor ? { topicCursor } : {}),
          ...(topicLimit === undefined ? {} : { topicLimit }),
        }),
      };
    },
    "app.tasks.workload": (frame) => {
      const appId = typeof frame.appId === "string" ? frame.appId.trim() : "";
      if (!appId) throw new Error("appId is required");
      if (!getAppTaskWorkload) throw new Error("App workload reads are unavailable");
      if (frame.agent !== undefined && (typeof frame.agent !== "string" || !frame.agent.trim()))
        throw new Error("agent must be a non-empty string");
      if (frame.limit !== undefined && (!Number.isSafeInteger(frame.limit) || Number(frame.limit) < 1 || Number(frame.limit) > 100))
        throw new Error("limit must be an integer between 1 and 100");
      if (frame.cursor !== undefined && (typeof frame.cursor !== "string" || !frame.cursor.trim()))
        throw new Error("cursor must be a non-empty string");
      if (frame.inputCursor !== undefined && (typeof frame.inputCursor !== "string" || !frame.inputCursor.trim()))
        throw new Error("inputCursor must be a non-empty string");
      return {
        appId,
        workload: getAppTaskWorkload(appId, {
          ...(typeof frame.agent === "string" ? { agent: frame.agent } : {}),
          ...(typeof frame.limit === "number" ? { limit: frame.limit } : {}),
          ...(typeof frame.cursor === "string" ? { cursor: frame.cursor } : {}),
          ...(typeof frame.inputCursor === "string" ? { inputCursor: frame.inputCursor } : {}),
        }),
      };
    },
    "app.tasks.list": (frame) => {
      const appId = typeof frame.appId === "string" ? frame.appId.trim() : "";
      if (!appId) throw new Error("appId is required");
      if (!listAppTasks) throw new Error("App Task reads are unavailable");
      if (
        frame.status !== undefined &&
        (!Array.isArray(frame.status) ||
          !frame.status.every((value) => typeof value === "string" && Boolean(value.trim())))
      ) {
        throw new Error("status must be an array of non-empty strings");
      }
      const status = frame.status as string[] | undefined;
      return {
        appId,
        tasks: listAppTasks(appId, {
          ...(status ? { status } : {}),
          ...(frame.limit === undefined ? {} : { limit: Number(frame.limit) }),
          ...(typeof frame.cursor === "string" && frame.cursor.trim() ? { cursor: frame.cursor.trim() } : {}),
        }),
      };
    },
    "app.task.get": (frame) => {
      const appId = typeof frame.appId === "string" ? frame.appId.trim() : "";
      const taskId = typeof frame.taskId === "string" ? frame.taskId.trim() : "";
      if (!appId) throw new Error("appId is required");
      if (!taskId) throw new Error("taskId is required");
      if (!getAppTask) throw new Error("App Task reads are unavailable");
      return {
        appId,
        taskId,
        task: getAppTask(appId, taskId, {
          ...acceptedEvidenceOptions(frame),
          ...(frame.inputKeys === undefined ? {} : { inputKeys: frame.inputKeys as string[] }),
        }),
      };
    },
    "app.task.retry": (frame) => {
      const appId = typeof frame.appId === "string" ? frame.appId.trim() : "";
      const taskId = typeof frame.taskId === "string" ? frame.taskId.trim() : "";
      const expectedGeneration = frame.expectedGeneration;
      if (!appId) throw new Error("appId is required");
      if (!taskId) throw new Error("taskId is required");
      if (typeof expectedGeneration !== "number" || !Number.isSafeInteger(expectedGeneration) || expectedGeneration < 1) {
        throw new Error("expectedGeneration must be a positive integer");
      }
      if (!publishEvent || !getTask) throw new Error("App Task retry is unavailable");
      const task = getTask({ appId, taskId }) as Record<string, unknown> | null;
      if (!task) throw new Error(`Task ${appId}/${taskId} was not found`);
      if (task.generation !== expectedGeneration) {
        throw new Error(
          `Task ${appId}/${taskId} generation changed: expected ${expectedGeneration}, current ${String(task.generation)}`,
        );
      }
      if (!Number.isSafeInteger(task.resourceVersion) || Number(task.resourceVersion) < 1) {
        throw new Error(`Task ${appId}/${taskId} has no valid resource version`);
      }
      const receipt = publishEvent({
        type: "app.task.retry.requested",
        target: { appId, taskId },
        data: {
          expectedGeneration,
          expectedResourceVersion: Number(task.resourceVersion),
        },
        idempotencyKey: `app-task-retry:${appId}:${taskId}:${expectedGeneration}:${Number(task.resourceVersion)}`,
      });
      if (receipt.delivery !== "accepted") {
        throw new Error(`Task ${appId}/${taskId} retry was recorded but not accepted; read the Task and retry`);
      }
      return { receipt };
    },
    "apps.list": (frame) => {
      if (!listApps) throw new Error("App reads are unavailable");
      const appId = typeof frame.appId === "string" && frame.appId.trim() ? frame.appId.trim() : undefined;
      return { apps: listApps(appId) };
    },
    "tasks.list": (frame) => {
      if (!listTasks) throw new Error("Task reads are unavailable");
      if (
        frame.status !== undefined &&
        (!Array.isArray(frame.status) ||
          !frame.status.every((value) => typeof value === "string" && Boolean(value.trim())))
      ) {
        throw new Error("status must be an array of non-empty strings");
      }
      return {
        tasks: listTasks({
          ...(typeof frame.appId === "string" && frame.appId.trim() ? { appId: frame.appId.trim() } : {}),
          ...(frame.includeDone === true ? { includeDone: true } : {}),
          ...(frame.humanActionOnly === true ? { humanActionOnly: true } : {}),
          ...(Array.isArray(frame.status) ? { status: frame.status as string[] } : {}),
          ...(frame.limit === undefined ? {} : { limit: Number(frame.limit) }),
          ...(typeof frame.cursor === "string" && frame.cursor.trim() ? { cursor: frame.cursor.trim() } : {}),
        }),
      };
    },
    "task.get": (frame) => {
      if (!getTask) throw new Error("Task reads are unavailable");
      return {
        task: getTask({
          ...(typeof frame.ref === "string" && frame.ref.trim() ? { ref: frame.ref.trim() } : {}),
          ...(typeof frame.appId === "string" && frame.appId.trim() ? { appId: frame.appId.trim() } : {}),
          ...(typeof frame.taskId === "string" && frame.taskId.trim() ? { taskId: frame.taskId.trim() } : {}),
          ...(typeof frame.reason === "string" && frame.reason.trim() ? { reason: frame.reason.trim() } : {}),
          ...acceptedEvidenceOptions(frame),
        }),
      };
    },
    "task.close": (frame) => handleTaskCloseOrReopen("task.close", frame),
    "task.reopen": (frame) => handleTaskCloseOrReopen("task.reopen", frame),
    "task.cancel": (frame) => {
      if (!getTask || !publishEvent) throw new Error("Task cancellation is unavailable");
      const input = {
        ...(typeof frame.ref === "string" && frame.ref.trim() ? { ref: frame.ref.trim() } : {}),
        ...(typeof frame.appId === "string" && frame.appId.trim() ? { appId: frame.appId.trim() } : {}),
        ...(typeof frame.taskId === "string" && frame.taskId.trim() ? { taskId: frame.taskId.trim() } : {}),
      };
      const task = getTask(input) as Record<string, unknown> | null;
      if (!task) throw new Error("Task was not found");
      const appId = typeof task.appId === "string" ? task.appId.trim() : "";
      const taskId = typeof task.taskId === "string" ? task.taskId.trim() : "";
      const generation = Number(task.generation);
      const resourceVersion = Number(task.resourceVersion);
      if (!appId || !taskId || !Number.isSafeInteger(generation) || !Number.isSafeInteger(resourceVersion)) {
        throw new Error("Task has no exact mutable resource identity");
      }
      const reason =
        typeof frame.reason === "string" && frame.reason.trim()
          ? frame.reason.trim()
          : "human requested cancellation";
      const receipt = publishEvent(taskCancelRequestedEvent({ appId, taskId, generation, resourceVersion }, reason));
      if (receipt.delivery !== "accepted") {
        throw new Error(
          `Task ${appId}/${taskId} cancellation was recorded but not accepted; read the Task and retry`,
        );
      }
      return { receipt, task: getTask({ appId, taskId }) };
    },
    "project.actions.describe": (frame) => {
      const projectId = typeof frame.projectId === "string" ? frame.projectId.trim() : "";
      if (!projectId) throw new Error("projectId is required");
      if (!describeProjectActions) throw new Error("project action discovery is unavailable");
      return { projectId, actions: describeProjectActions(projectId) };
    },
    "project.action.invoke": (frame) => {
      const projectId = typeof frame.projectId === "string" ? frame.projectId.trim() : "";
      const actionId = typeof frame.actionId === "string" ? frame.actionId.trim() : "";
      if (!projectId) throw new Error("projectId is required");
      if (!actionId) throw new Error("actionId is required");
      if (!invokeProjectAction) throw new Error("project action invocation is unavailable");
      const result = invokeProjectAction({
        projectId,
        actionId,
        params: frame.params ?? {},
        ...(typeof frame.idempotencyKey === "string" && frame.idempotencyKey.trim()
          ? { idempotencyKey: frame.idempotencyKey.trim() }
          : {}),
      });
      return { projectId, actionId, ...result };
    },
  };

  function handleTaskCloseOrReopen(
    command: "task.close" | "task.reopen",
    frame: Record<string, unknown>,
  ): Record<string, unknown> {
    const appId = typeof frame.appId === "string" ? frame.appId.trim().replace(/\.app$/, "") : "";
    const taskId = typeof frame.taskId === "string" ? frame.taskId.trim() : "";
    const expectedGeneration = frame.expectedGeneration;
    const expectedResourceVersion = frame.expectedResourceVersion;
    const afterResult = typeof frame.afterResult === "string" ? frame.afterResult.trim() : "";
    const reason = typeof frame.reason === "string" ? frame.reason.trim() : "";
    if (!publishEvent) throw new Error("guarded Task control is unavailable");
    const receipt = publishEvent(
      command === "task.reopen"
        ? taskReopenRequestedEvent(
            {
              appId,
              taskId,
              generation: expectedGeneration as number,
              resourceVersion: expectedResourceVersion as number,
            },
            reason,
            frame.input as { kind: string; data: unknown } | undefined,
          )
        : taskCloseRequestedEvent(
            {
              appId,
              taskId,
              generation: expectedGeneration as number,
              resourceVersion: expectedResourceVersion as number,
            },
            afterResult,
            reason,
          ),
    );
    if (receipt.delivery !== "accepted") {
      throw new Error(`Task ${appId}/${taskId} control was recorded but not accepted; read the Task and retry`);
    }
    return {
      receipt,
      ...(getTask ? { task: getTask({ appId, taskId }) } : {}),
    };
  }

  function attachClient(socket: Duplex): void {
    for (const [clientSocket] of clients) {
      if (clientSocket.destroyed || clientSocket.readableEnded || clientSocket.writableEnded) {
        clients.delete(clientSocket);
      }
    }
    if (clients.size >= CONTROL_SOCKET_LIMITS.maxConnections) {
      writeFrame(socket, {
        type: "error",
        command: null,
        message: "Control socket connection limit exceeded",
      });
      socket.end();
      return;
    }
    clients.set(socket, {
      socket,
      filter: null,
      conversations: new Set(),
      taskApps: new Set(),
      task: null,
      subscribed: false,
    });
    const removeClient = () => clients.delete(socket);
    socket.on("close", removeClient);
    socket.on("error", removeClient);
    socket.on("end", removeClient);
    socket.on("finish", removeClient);

    let initialStatus: Record<string, unknown>;
    try {
      initialStatus = statusFields(getStatus());
    } catch {
      initialStatus = { statusError: "Execution status unavailable" };
    }
    writeFrame(socket, {
      type: "connected",
      pid: process.pid,
      agent: agentName,
      instance,
      sessionId: "",
      ...initialStatus,
    });

    let buffer = "";
    socket.setEncoding("utf8");
    socket.on("data", (data) => {
      buffer += data;
      const lines = buffer.split("\n");
      buffer = lines.pop()!;
      if (Buffer.byteLength(buffer) > CONTROL_SOCKET_LIMITS.maxIncompleteBufferBytes) {
        writeFrame(socket, { type: "error", command: null, message: "Incomplete control socket frame is too large" });
        socket.destroy();
        return;
      }

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (Buffer.byteLength(trimmed) > CONTROL_SOCKET_LIMITS.maxFrameBytes) {
          writeFrame(socket, { type: "error", command: null, message: "Control socket frame is too large" });
          continue;
        }

        let frame: Record<string, unknown>;
        try {
          frame = JSON.parse(trimmed) as Record<string, unknown>;
        } catch {
          writeFrame(socket, {
            type: "error",
            command: null,
            message: `Invalid JSON: ${trimmed.slice(0, CONTROL_SOCKET_LIMITS.maxErrorPreviewBytes)}`,
          });
          continue;
        }

        const normalized = normalizeSocketFrame(frame);
        if (normalized.kind === "error") {
          writeFrame(socket, {
            type: "error",
            command: normalized.command ?? null,
            message: normalized.message,
          });
          continue;
        }

        if (normalized.kind === "control" && normalized.command === "subscribe") {
          const sessions = frame.sessions;
          const conversations = frame.conversations;
          const taskApps = frame.taskApps;
          const task = frame.task;
          const client = clients.get(socket);
          if (
            client &&
            Array.isArray(sessions) &&
            sessions.every((session) => typeof session === "string") &&
            (conversations === undefined ||
              (Array.isArray(conversations) && conversations.every((id) => typeof id === "string" && id.trim()))) &&
            (taskApps === undefined ||
              (Array.isArray(taskApps) && taskApps.every((id) => typeof id === "string" && id.trim()))) &&
            (task === undefined ||
              task === null ||
              (typeof task === "object" &&
                !Array.isArray(task) &&
                typeof (task as Record<string, unknown>).appId === "string" &&
                Boolean(String((task as Record<string, unknown>).appId).trim()) &&
                typeof (task as Record<string, unknown>).taskId === "string" &&
                Boolean(String((task as Record<string, unknown>).taskId).trim())))
          ) {
            client.filter = sessions.includes("*") ? null : new Set(sessions);
            client.conversations = new Set(
              Array.isArray(conversations) ? conversations.map((id) => String(id).trim()) : [],
            );
            client.taskApps = new Set(
              Array.isArray(taskApps)
                ? taskApps.map((id) =>
                    String(id)
                      .trim()
                      .replace(/\.app$/, ""),
                  )
                : [],
            );
            client.task =
              task && typeof task === "object" && !Array.isArray(task)
                ? {
                    appId: String((task as Record<string, unknown>).appId)
                      .trim()
                      .replace(/\.app$/, ""),
                    taskId: String((task as Record<string, unknown>).taskId).trim(),
                  }
                : null;
            client.subscribed = true;
            writeFrame(socket, { type: "ok", command: "subscribe" });
          } else {
            writeFrame(socket, {
              type: "error",
              command: "subscribe",
              message:
                !Array.isArray(sessions) || !sessions.every((session) => typeof session === "string")
                  ? "sessions must be an array of strings"
                  : conversations !== undefined &&
                      (!Array.isArray(conversations) ||
                        !conversations.every((id) => typeof id === "string" && id.trim()))
                    ? "conversations must be an array of non-empty strings"
                    : taskApps !== undefined &&
                        (!Array.isArray(taskApps) || !taskApps.every((id) => typeof id === "string" && id.trim()))
                      ? "taskApps must be an array of non-empty strings"
                      : task !== undefined &&
                          task !== null &&
                          (typeof task !== "object" ||
                            Array.isArray(task) ||
                            typeof (task as Record<string, unknown>).appId !== "string" ||
                            typeof (task as Record<string, unknown>).taskId !== "string")
                        ? "task must contain non-empty appId and taskId strings"
                        : "invalid subscription",
            });
          }
          continue;
        }

        if (normalized.kind === "control") {
          const handler = controlHandlers[normalized.command];
          if (handler) {
            try {
              const result = handler(frame);
              writeFrame(socket, {
                type: typeof result.type === "string" ? result.type : "ok",
                command: normalized.command,
                ...result,
              });
            } catch (error) {
              writeFrame(socket, {
                type: "error",
                command: normalized.command,
                message: error instanceof Error ? error.message : String(error),
              });
            }
            continue;
          }
        }

        if (normalized.kind !== "event") continue;
        try {
          const result = emitEvent(normalized.event as ControlEvent);
          const eventId = Number(result?.eventId);
          if (!Number.isInteger(eventId) || eventId <= 0) {
            throw new Error(`Event ${normalized.command} was not durably persisted`);
          }
          writeFrame(socket, { type: "ok", command: normalized.command, eventId });
        } catch (error) {
          writeFrame(socket, {
            type: "error",
            command: normalized.command,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    });
  }

  return {
    attachClient,
    close: () => {
      unsubscribe();
      for (const client of clients.keys()) client.destroy();
      clients.clear();
    },
    clientCount: () => clients.size,
  };
}

export async function attachControlSocket(opts: AttachControlSocketOptions): Promise<ControlSocket> {
  const {
    socketPath,
    getStatus,
    emitEvent,
    publishEvent,
    getEvent,
    subscribeEvents,
    onInfo,
    agentName,
    instance,
  } = opts;
  mkdirSync(dirname(socketPath), { recursive: true });

  if (existsSync(socketPath)) {
    const alive = await isSocketAlive(socketPath);
    if (alive) {
      const message = `[control] Socket ${socketPath} already has a live owner. Refusing to start without control-socket ownership; use a different INSTANCE for a separate daemon.`;
      onInfo?.(message);
      throw new Error(message);
    }
    unlinkSync(socketPath);
  }

  const core = createControlSocketCore({
    getStatus,
    getDiagnostics: opts.getDiagnostics,
    emitEvent,
    publishEvent,
    getEvent,
    admitAppInput: opts.admitAppInput,
    getAppConversation: opts.getAppConversation,
    listAppTasks: opts.listAppTasks,
    getAppTaskWorkload: opts.getAppTaskWorkload,
    getAppTask: opts.getAppTask,
    listApps: opts.listApps,
    listTasks: opts.listTasks,
    getTask: opts.getTask,
    describeProjectActions: opts.describeProjectActions,
    invokeProjectAction: opts.invokeProjectAction,
    subscribeEvents,
    conversationAppId: opts.conversationAppId,
    agentName,
    instance,
  });
  const server: Server = createServer((socket) => core.attachClient(socket));

  server.on("close", () => {
    onInfo?.("[control] Socket server CLOSED");
  });

  const cleanup = () => {
    try {
      server.close();
      if (existsSync(socketPath)) unlinkSync(socketPath);
    } catch {
      // ignore
    }
  };
  process.on("exit", cleanup);

  try {
    await new Promise<void>((resolve, reject) => {
      const onListenError = (err: Error) => {
        onInfo?.(`[control] Socket error: ${err.message}`);
        reject(err);
      };
      server.once("error", onListenError);
      server.listen(socketPath, () => {
        server.off("error", onListenError);
        server.on("error", (err) => {
          onInfo?.(`[control] Socket error: ${err.message}`);
        });
        try {
          chmodSync(socketPath, 0o600);
          onInfo?.(`[control] Listening on ${socketPath}`);
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  } catch (error) {
    process.off("exit", cleanup);
    core.close();
    cleanup();
    throw error;
  }

  return {
    close: () => {
      process.off("exit", cleanup);
      core.close();
      cleanup();
    },
    clientCount: () => core.clientCount(),
  };
}
