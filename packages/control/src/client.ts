import { connect, Socket, type NetConnectOpts } from "node:net";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import type { Duplex } from "node:stream";
import { isSocketCommandType, type EventInput, type EventReceipt } from "./protocol.js";
import { buildCanonicalEventEnvelope } from "./event-envelope.js";

export interface SocketResponse {
  type: "ok" | "error" | "status";
  command?: string | null;
  message?: string;
  [key: string]: unknown;
}

export type SocketEndpoint = string | NetConnectOpts | (() => Duplex);

export type SocketFailureKind = "pre-send" | "definitive" | "post-send-unknown";

export class SocketCommandError extends Error {
  constructor(
    message: string,
    readonly kind: SocketFailureKind,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "SocketCommandError";
  }
}

function commandError(error: unknown, kind: SocketFailureKind): SocketCommandError {
  if (error instanceof SocketCommandError) return error;
  const message = error instanceof Error ? error.message : String(error);
  return new SocketCommandError(message, kind, { cause: error });
}

export function connectSocketEndpoint(endpoint: SocketEndpoint): Socket | Duplex {
  if (typeof endpoint === "function") return endpoint();
  return typeof endpoint === "string" ? connect(endpoint) : connect(endpoint);
}

export interface DaemonSocketPathOptions {
  instance?: string;
  interfaceAgent?: string;
}

export function daemonSocketPath(persistDir: string, opts: DaemonSocketPathOptions = {}): string {
  const instance = opts.instance?.trim() || "default";
  const interfaceAgent = opts.interfaceAgent?.trim() || "may";
  return resolve(persistDir, "instances", instance, `${interfaceAgent}.sock`);
}

function daemonEventFrame(eventType: string, data: Record<string, unknown>): Record<string, unknown> {
  if (!eventType.includes(".") || isSocketCommandType(eventType)) {
    return { ...data, type: eventType };
  }
  return buildCanonicalEventEnvelope(eventType, data, { source: "control" });
}

export function sendSocketCommand(
  socketPath: SocketEndpoint,
  command: Record<string, unknown>,
  opts?: { timeoutMs?: number },
): Promise<SocketResponse> {
  return new Promise((resolve, reject) => {
    const expectedCommand = typeof command.type === "string" ? command.type : null;
    let settled = false;
    let sent = false;
    const settle = (fn: () => void) => {
      if (!settled) {
        settled = true;
        fn();
      }
    };
    const timeoutMs = opts?.timeoutMs ?? 5000;
    let timeout: ReturnType<typeof setTimeout>;

    const onError = (err: Error) => {
      clearTimeout(timeout);
      settle(() => reject(commandError(err, sent ? "post-send-unknown" : "pre-send")));
    };

    let client: Socket | Duplex;
    try {
      if (typeof socketPath === "function") {
        client = socketPath();
        client.on("error", onError);
      } else {
        // Create socket and attach error handler BEFORE connecting
        // to prevent Bun's test runner from catching ENOENT as uncaught
        const sock = new Socket();
        sock.on("error", onError);
        if (typeof socketPath === "string") sock.connect(socketPath);
        else sock.connect(socketPath);
        client = sock;
      }
    } catch (error) {
      reject(commandError(error, "pre-send"));
      return;
    }

    timeout = setTimeout(() => {
      client.destroy();
      settle(() => reject(commandError(new Error("Socket timeout"), sent ? "post-send-unknown" : "pre-send")));
    }, timeoutMs);

    let buffer = "";
    // A socket chunk can end inside a UTF-8 character. Decode at stream scope.
    client.setEncoding("utf8");

    client.on("connect", () => {
      try {
        client.write(JSON.stringify(command) + "\n", (error?: Error | null) => {
          if (error) onError(error);
        });
        sent = true;
      } catch (error) {
        settle(() => reject(commandError(error, "pre-send")));
      }
    });

    client.on("data", (data) => {
      if (!sent) return;
      buffer += data;
      const lines = buffer.split("\n");
      for (let i = 0; i < lines.length - 1; i++) {
        const trimmed = lines[i].trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed) as SocketResponse;
          const isStatusReply = expectedCommand === "status" && parsed.type === "status";
          const isReply =
            parsed.command === expectedCommand && (parsed.type === "ok" || parsed.type === "error" || isStatusReply);
          if (isReply) {
            clearTimeout(timeout);
            client.destroy();
            if (parsed.type === "error") {
              settle(() => reject(commandError(new Error(parsed.message ?? "Socket command failed"), "definitive")));
            } else {
              settle(() => resolve(parsed));
            }
            return;
          }
        } catch {
          // Non-JSON line: ignore.
        }
      }
      buffer = lines[lines.length - 1];
    });

    client.on("close", () => {
      clearTimeout(timeout);
      if (sent) {
        settle(() =>
          reject(
            commandError(
              new Error(
                `Socket closed before acknowledgement for ${expectedCommand ?? "unknown command"}; outcome unknown`,
              ),
              "post-send-unknown",
            ),
          ),
        );
      } else {
        settle(() => reject(commandError(new Error("Socket closed before command sent"), "pre-send")));
      }
    });
  });
}

export async function publishEvent(
  endpoint: SocketEndpoint,
  event: EventInput,
  opts?: { timeoutMs?: number },
): Promise<EventReceipt> {
  const response = await sendSocketCommand(endpoint, { type: "publish", event }, opts);
  const eventId = Number(response.eventId);
  const eventType = typeof response.eventType === "string" ? response.eventType : "";
  const delivery = response.delivery;
  if (
    !Number.isSafeInteger(eventId) ||
    eventId <= 0 ||
    !eventType ||
    (delivery !== "recorded" && delivery !== "accepted")
  ) {
    throw new Error("Daemon returned an invalid event receipt");
  }
  return {
    eventId,
    eventType,
    delivery,
    ...(Array.isArray(response.links) ? { links: response.links as EventReceipt["links"] } : {}),
  };
}

export async function getEvent<T = unknown>(
  endpoint: SocketEndpoint,
  eventId: number,
  opts?: { timeoutMs?: number },
): Promise<T> {
  const response = await sendSocketCommand(endpoint, { type: "event.get", eventId }, opts);
  return response.event as T;
}

export interface SocketEvent {
  type: string;
  sessionId?: string;
  agent?: string;
  status?: string;
  message?: string;
  [key: string]: unknown;
}

export function waitForSocketEvent(
  socketPath: SocketEndpoint,
  eventType: string,
  opts?: { sessionId?: string; timeoutMs?: number },
): Promise<SocketEvent> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const settle = (fn: () => void) => {
      if (!settled) {
        settled = true;
        fn();
      }
    };
    const client = connectSocketEndpoint(socketPath);
    const sessions = opts?.sessionId ? [opts.sessionId] : ["*"];
    const timeoutMs = opts?.timeoutMs ?? 600_000;
    const timeout = setTimeout(() => {
      client.destroy();
      settle(() => reject(new Error(`Timeout waiting for ${eventType} (${timeoutMs}ms)`)));
    }, timeoutMs);

    let subscribed = false;
    let buffer = "";
    client.setEncoding("utf8");
    client.on("connect", () => {
      client.write(JSON.stringify({ type: "subscribe", sessions }) + "\n");
    });
    client.on("data", (data) => {
      buffer += data;
      const lines = buffer.split("\n");
      buffer = lines.pop()!;
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const event = JSON.parse(trimmed) as SocketEvent;
          if (!subscribed) {
            if (event.command !== "subscribe") continue;
            if (event.type === "error") {
              clearTimeout(timeout);
              client.destroy();
              settle(() => reject(new Error(event.message ?? "Socket subscription failed")));
              return;
            }
            if (event.type === "ok") subscribed = true;
            continue;
          }
          if (event.type === eventType) {
            const data =
              event.data && typeof event.data === "object" && !Array.isArray(event.data)
                ? (event.data as Record<string, unknown>)
                : event;
            if (opts?.sessionId && data.sessionId !== opts.sessionId) continue;
            clearTimeout(timeout);
            client.destroy();
            settle(() => resolve(event));
            return;
          }
        } catch {
          // Non-JSON line: ignore.
        }
      }
    });

    client.on("error", (err) => {
      clearTimeout(timeout);
      settle(() => reject(err));
    });

    client.on("close", () => {
      clearTimeout(timeout);
      settle(() => reject(new Error("Socket closed before event received")));
    });
  });
}

export function emitDaemonEvent(
  endpoint: SocketEndpoint,
  eventType: string,
  data: Record<string, unknown> = {},
  opts?: { timeoutMs?: number },
): Promise<SocketResponse> {
  return sendDaemonEvent(endpoint, daemonEventFrame(eventType, data), opts);
}

export interface EmitDaemonEventRetryOptions {
  timeoutMs?: number;
  maxAttempts?: number;
  retryDelayMs?: number;
  idempotencyKey?: string;
}

/**
 * Emit an operator event with one identity across all transport retries.
 * Only pre-send and post-send-unknown failures are retryable; a daemon error is definitive.
 */
export async function emitDaemonEventWithRetry(
  endpoint: SocketEndpoint,
  eventType: string,
  data: Record<string, unknown> = {},
  opts: EmitDaemonEventRetryOptions = {},
): Promise<SocketResponse> {
  const existingKey = typeof data.idempotencyKey === "string" ? data.idempotencyKey.trim() : "";
  const idempotencyKey = opts.idempotencyKey?.trim() || existingKey || `control-${randomUUID()}`;
  const durableData = { ...data, idempotencyKey };
  const maxAttempts = Math.max(1, opts.maxAttempts ?? 2);

  let lastError: SocketCommandError | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await emitDaemonEvent(endpoint, eventType, durableData, { timeoutMs: opts.timeoutMs });
    } catch (error) {
      const typed = commandError(error, "post-send-unknown");
      lastError = typed;
      if (typed.kind === "definitive" || attempt === maxAttempts) throw typed;
      if (opts.retryDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, opts.retryDelayMs));
      }
    }
  }

  throw lastError ?? new SocketCommandError("Event acknowledgement unresolved", "post-send-unknown");
}

export function sendDaemonEvent(
  endpoint: SocketEndpoint,
  event: Record<string, unknown>,
  opts?: { timeoutMs?: number },
): Promise<SocketResponse> {
  return sendSocketCommand(endpoint, event, opts);
}

export function sendDaemonInput(
  endpoint: SocketEndpoint,
  message: string,
  source = "control",
  opts?: { timeoutMs?: number },
): Promise<SocketResponse> {
  return sendSocketCommand(
    endpoint,
    {
      type: "publish",
      event: {
        type: "app.input.requested",
        target: { appId: "may" },
        data: {
          input: { kind: "message", data: { message } },
          channel: source,
        },
        idempotencyKey: `control-input-${randomUUID()}`,
      },
    },
    opts,
  );
}

export function sendAgentMessage(
  endpoint: SocketEndpoint,
  agent: string,
  message: string,
  source = "control",
  opts?: { timeoutMs?: number },
): Promise<SocketResponse> {
  if (agent === "may") return sendDaemonInput(endpoint, message, source, opts);
  return sendSocketCommand(
    endpoint,
    {
      type: "publish",
      event: {
        type: "chat.start.requested",
        data: {
          agent,
          message,
          channel: source,
        },
        idempotencyKey: `control-chat-${randomUUID()}`,
      },
    },
    opts,
  );
}
