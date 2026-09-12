import type { SubagentManager } from "../lib/index.js";
import { log } from "../lib/log.js";
import { isRecord, normalizeEventOwner } from "../../packages/control/src/event-envelope.js";
import { childEventTrace, EVENT_ROW_ID, type DeliveryResult, type EventBus } from "./core/events/bus.js";
import type { RuntimeReloadResult } from "./daemon-lifecycle.js";

export interface CommandRouterOptions {
  bus: EventBus;
  manager: SubagentManager;
  reload: () => RuntimeReloadResult | Promise<RuntimeReloadResult>;
  restart: () => void;
  shutdown: () => void;
}

export interface CommandRouter {
  handleInput: (message: string, source?: string) => void;
  close: () => void;
}

function eventData(event: unknown): Record<string, unknown> {
  if (!isRecord(event)) return {};
  return isRecord(event.data) ? event.data : event;
}

function eventSource(event: unknown, fallback = "human"): string {
  if (!isRecord(event)) return fallback;
  return typeof event.source === "string" && event.source.trim() ? event.source.trim() : fallback;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function integerField(value: unknown, key: string): number | null {
  if (!isRecord(value)) return null;
  const next = value[key];
  return typeof next === "number" && Number.isInteger(next) ? next : null;
}

/** Normalize external input, apply deterministic controls, and admit semantic work to an App. */
export function attachCommandRouter(options: CommandRouterOptions): CommandRouter {
  const { bus, manager } = options;

  const accepted = (control: string, note = "input handled by an explicit runtime route"): DeliveryResult => ({
    accepted: true,
    by: `command-router:${control}`,
    route: "direct",
    note,
  });

  const eventRowId = (event: unknown): number | null => {
    if (!isRecord(event)) return null;
    const value = (event as Record<PropertyKey, unknown>)[EVENT_ROW_ID];
    return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
  };

  const inFlightReloads = new Set<number>();
  function finishReload(event: unknown): void {
    const rowId = eventRowId(event);
    if (rowId !== null) {
      if (inFlightReloads.has(rowId)) return;
      inFlightReloads.add(rowId);
    }
    const request = eventData(event);
    const emitResult = (result: RuntimeReloadResult): void => {
      bus.emit({
        type: "runtime.reload.finished",
        source: "runtime",
        owner: isRecord(event) ? String(event.owner ?? "agent:may") : "agent:may",
        data: {
          ...(nonEmptyString(request.requestId) ? { requestId: nonEmptyString(request.requestId) } : {}),
          ok: result.ok,
          summary: result.summary,
        },
        trace: childEventTrace(event),
      } as any);
    };
    void Promise.resolve()
      .then(() => options.reload())
      .catch((error) => ({
        ok: false,
        summary: `[reload] Failed: ${error instanceof Error ? error.message : String(error)}`,
      }))
      .then(emitResult)
      .catch((error) => log("warn", `[reload] Could not record result: ${String(error)}`))
      .finally(() => {
        if (rowId !== null) inFlightReloads.delete(rowId);
      });
  }

  function handleSteer(sessionId: unknown, message: unknown, source?: string, event?: unknown): boolean {
    const id = nonEmptyString(sessionId);
    const text = nonEmptyString(message);
    if (!id || !text) return false;
    try {
      if (manager.status().some((session) => session.sessionId === id)) {
        manager.send(id, text, { trace: childEventTrace(event) });
      } else {
        manager.resumeSession(id, text, {
          source: source ?? "human",
          suppressBenignRaceEvent: true,
          trace: childEventTrace(event),
        });
      }
    } catch (error) {
      log("warn", `[steer] ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
    return true;
  }

  function handleChatStart(event: unknown): DeliveryResult | void {
    const data = eventData(event);
    const message = nonEmptyString(data.message);
    if (!message) return;
    const agent = nonEmptyString(data.agent) ?? "may";
    const source = eventSource(event, nonEmptyString(data.channel) ?? "human");
    if (agent === "may") {
      admitMayInput(message, source, {
        requestId: nonEmptyString(data.requestId) ?? undefined,
        conversationId: nonEmptyString(data.conversationId) ?? undefined,
        channel: nonEmptyString(data.channel) ?? source,
        channelTargetId: nonEmptyString(data.channelTargetId) ?? undefined,
        channelThreadId: nonEmptyString(data.channelThreadId) ?? undefined,
        channelMessageId: integerField(data, "channelMessageId") ?? undefined,
        context: isRecord(data.context) ? data.context : undefined,
      });
      return accepted("may-input-admitted");
    }
    const openingEventId = eventRowId(event);
    const sessionPrefix = manager.getAgentDefinition?.(agent)?.sessionIdPrefix?.trim() || "s";
    const sessionId = openingEventId ? `${sessionPrefix}_event_${openingEventId}` : undefined;
    const existingSession = sessionId ? manager.getSessionSummary?.(sessionId) : undefined;
    if (sessionId && existingSession && existingSession.status !== "unknown") {
      return accepted(`agent:${agent}`, `direct chat already correlated to ${sessionId}`);
    }
    bus.emit({
      type: "message.created",
      source,
      owner: normalizeEventOwner(agent),
      data: { from: source, to: agent, content: message, intent: "chat.start", priority: "P0" },
    } as any);
    const startedSessionId = manager.run(agent, message, {
      ...(sessionId ? { sessionId } : {}),
      kind: "chat",
      autoClose: "never",
      source,
      requestId: nonEmptyString(data.requestId) ?? (openingEventId ? `event:${openingEventId}` : undefined),
      conversationId: nonEmptyString(data.conversationId) ?? undefined,
      channelMessageId: integerField(data, "channelMessageId") ?? undefined,
      trace: childEventTrace(event),
    });
    log("info", `[chat.start] Started ${agent} chat session: ${startedSessionId}`);
    return accepted(`agent:${agent}`);
  }

  function admitMayInput(
    message: string,
    source: string,
    metadata: {
      requestId?: string;
      conversationId?: string;
      channel?: string;
      channelTargetId?: string;
      channelThreadId?: string;
      channelMessageId?: number;
      context?: Record<string, unknown>;
    } = {},
  ): void {
    bus.emit({
      type: "app.input.requested",
      source,
      owner: "app:may",
      data: {
        appId: "may",
        input: {
          kind: "message",
          data: { message, ...(metadata.context ? { context: metadata.context } : {}) },
        },
        source: { kind: "human", id: metadata.requestId ?? source },
        conversationId: metadata.conversationId,
        conversationSequence: metadata.channelMessageId,
        channel: metadata.channel ?? source,
        channelTargetId: metadata.channelTargetId,
        channelThreadId: metadata.channelThreadId,
        channelMessageId: metadata.channelMessageId,
        idempotencyKey: metadata.requestId,
      },
    } as any);
  }

  function handleInput(message: string, source?: string): void {
    const text = message.trim();
    if (!text) return;
    const channel = source ?? "human";
    const lower = text.toLowerCase();
    if (lower === "/cancel all") {
      bus.emit({
        type: "session.cancel_all.requested",
        source: channel,
        owner: "agent:may",
        data: { reason: "human requested cancel all" },
      });
      return;
    }
    if (lower === "/reload" || lower === "/restart" || lower === "/close") {
      const type =
        lower === "/reload"
          ? "runtime.reload.requested"
          : lower === "/restart"
            ? "runtime.restart.requested"
            : "runtime.shutdown.requested";
      bus.emit({
        type,
        source: channel,
        owner: "agent:may",
        data: { reason: `human requested ${lower.slice(1)}` },
      } as any);
      return;
    }
    admitMayInput(text, channel);
  }

  const unsubscribeRequiredControls = bus.subscribeDurableRoute((event) => {
    switch (event.type) {
      case "chat.start.requested":
        return handleChatStart(event);
      case "session.steer.requested": {
        const data = eventData(event);
        const target: Record<string, unknown> = isRecord(event) && isRecord(event.target) ? event.target : {};
        return handleSteer(target.sessionId, data.message, eventSource(event), event)
          ? accepted("session-steer")
          : undefined;
      }
      case "session.cancel.requested": {
        const target: Record<string, unknown> = isRecord(event) && isRecord(event.target) ? event.target : {};
        const sessionId = nonEmptyString(target.sessionId);
        if (!sessionId) return;
        manager.cancel(sessionId);
        return accepted("session-cancel");
      }
      case "session.cancel_all.requested":
        for (const session of manager.status()) if (session.status === "running") manager.cancel(session.sessionId);
        return accepted("session-cancel-all");
      case "runtime.reload.requested":
        finishReload(event);
        return accepted("runtime-reload");
      case "runtime.restart.requested":
        options.restart();
        return accepted("runtime-restart");
      case "runtime.shutdown.requested":
        options.shutdown();
        return accepted("runtime-shutdown");
    }
  });

  return {
    handleInput,
    close: () => {
      unsubscribeRequiredControls();
    },
  };
}
