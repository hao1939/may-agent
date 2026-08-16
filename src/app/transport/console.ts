/**
 * Console UI — renders events to stdout.
 *
 * Two independent channels:
 *   1. EventBus  — domain events (sessions, tools, notifications, info)
 *   2. log.ts    — system log messages (warn, error, info from lib code)
 *
 * Quiet console: show primary session events bright, everything else hidden.
 * Daemon mode: show everything dimmed.
 */

import { eventData, isSessionEvent, type EventBus } from "../event-bus.js";
import { addLogSubscriber, type LogLevel } from "../../lib/log.js";

const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

function messageData(event: unknown): Record<string, unknown> {
  const record = event && typeof event === "object" && !Array.isArray(event) ? (event as Record<string, unknown>) : {};
  return record.data && typeof record.data === "object" && !Array.isArray(record.data)
    ? (record.data as Record<string, unknown>)
    : record;
}

function isHumanTarget(target: unknown): boolean {
  if (typeof target !== "string") return false;
  const normalized = target.trim().toLowerCase();
  return normalized === "human" || normalized === "human:operator";
}

export function attachConsoleUI(
  bus: EventBus,
  getPrimarySessionId?: () => string | null,
  quietConsole?: boolean,
  onResponseDelivered?: () => void,
): void {
  // ── Log channel (from log.ts — lib/infra messages) ────────────────────
  addLogSubscriber((level: LogLevel, message: string) => {
    // In quiet console mode, only show errors
    if (quietConsole && level !== "error") return;
    // In daemon mode, show errors dimmed
    if (level === "error") {
      console.log(`${DIM}[${level}] ${message}${RESET}`);
    }
    // info/warn from log() already go to console via the default subscriber
  });

  // ── Bus channel (domain events) ───────────────────────────────────────
  bus.subscribe((event) => {
    if (event.type === "app.response.delivery.requested") {
      const delivery = eventData(event);
      if (delivery.channel !== "console") return;
      console.log(String(delivery.text ?? ""));
      bus.emit({
        type: "channel.delivery.completed",
        source: "console",
        owner: "agent:may",
        target: { human: true },
        data: {
          channel: "console",
          sessionId: delivery.sessionId,
          resultEventType: event.type,
          operationId: delivery.operationId,
          appInboxItemId: delivery.appInboxItemId,
          appInboxRequestId: delivery.appInboxRequestId,
        },
      } as any);
      onResponseDelivered?.();
      return;
    }
    const primarySid = getPrimarySessionId?.() ?? null;

    // Quiet console: only show primary session + human-directed messages
    if (quietConsole) {
      if (event.type === "message.created" && isHumanTarget(messageData(event).to)) {
        const message = messageData(event);
        console.log(`\n📋 ${message.from}: ${message.content}`);
        return;
      }
      if (!primarySid) return; // no session yet, suppress all
      if (!isSessionEvent(event)) return; // drop system events
      const session = eventData(event);
      if (session.sessionId !== primarySid) return; // drop other sessions

      // Primary session — show everything
      switch (event.type) {
        case "text":
          process.stdout.write(event.text);
          break;
        case "tool_call":
          console.log(`${DIM}[${event.tool}] ${formatArgs(event.tool, event.args)}${RESET}`);
          break;
        case "tool_result":
          if (event.isError) {
            console.log(`${DIM}[${event.tool}] ERROR: ${event.preview.slice(0, 200)}${RESET}`);
          }
          break;
        case "session.end":
        case "session.idle":
          if (session.error) {
            console.log(`\n⚠️ ${session.error}`);
          }
          bus.emit({
            type: "channel.delivery.completed",
            source: "console",
            owner: "agent:may",
            target: { human: true },
            data: {
              channel: "console",
              sessionId: String(session.sessionId),
              resultEventType: event.type,
            },
          } as any);
          onResponseDelivered?.();
          break;
      }
      return;
    }

    // Daemon mode: show everything dimmed
    switch (event.type) {
      case "text":
        if (isSessionEvent(event)) process.stdout.write(`${DIM}${event.text}${RESET}`);
        break;
      case "tool_call":
        if (isSessionEvent(event))
          console.log(`${DIM}[${event.agent}:${event.tool}] ${JSON.stringify(event.args).slice(0, 200)}${RESET}`);
        break;
      case "tool_result":
        if (isSessionEvent(event) && event.isError) console.log(`${DIM}[${event.agent}:${event.tool}] ERROR${RESET}`);
        break;
      case "session.start":
        if (isSessionEvent(event)) {
          const session = eventData(event);
          if (session.parentSessionId)
            console.log(`${DIM}[${session.agent}] started: ${String(session.task ?? "").slice(0, 100)}${RESET}`);
        }
        break;
      case "session.end":
        if (isSessionEvent(event)) {
          const session = eventData(event);
          console.log(`${DIM}[${session.agent}] ${session.status}${RESET}`);
        }
        break;
      case "message.created":
        {
          const message = messageData(event);
          if (isHumanTarget(message.to)) {
            console.log(`📋 ${message.from}: ${message.content}`);
          }
        }
        break;
      case "info":
        console.log(`${DIM}${(event as { message: string }).message}${RESET}`);
        break;
    }
  });
}

function formatArgs(tool: string, args: unknown): string {
  if (!args || typeof args !== "object") return "";
  const a = args as Record<string, unknown>;
  switch (tool) {
    case "bash":
      return String(a.command ?? "").slice(0, 200);
    case "read":
      return String(a.path ?? "");
    case "write":
      return String(a.path ?? "");
    case "edit":
      return String(a.path ?? "");
    case "agents":
      return `${a.action ?? "?"} ${a.agent ?? ""} ${String(a.message ?? "").slice(0, 80)}`;
    case "workflow":
      return `${a.name ?? "?"} ${String(a.task ?? "").slice(0, 80)}`;
    case "finish":
      return `${a.status ?? "?"}: ${String(a.summary ?? "").slice(0, 100)}`;
    default:
      return JSON.stringify(args).slice(0, 200);
  }
}
