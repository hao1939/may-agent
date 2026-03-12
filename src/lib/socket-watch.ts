/**
 * Socket watch tool — multi-socket I/O with followUp injection.
 *
 * Connects to Unix domain sockets as a client, receives newline-delimited
 * JSON events, debounces and injects them into the agent's session via
 * manager.followUp(). Source-agnostic: the remote end can be another
 * may-agent process, a human interface, a Telegram bridge, etc.
 *
 * Used by the coach agent to observe and steer coachee processes.
 */

import { Type, StringEnum } from "@mariozechner/pi-ai";
import type { TSchema } from "@mariozechner/pi-ai";
import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Socket } from "node:net";
import type { SubagentManager } from "./manager.js";

function textResult(text: string): AgentToolResult<string> {
  return {
    content: [{ type: "text", text }],
    details: text,
  };
}

// ── Default event filter ────────────────────────────────────────────────

const DEFAULT_FILTER = new Set([
  "text",
  "tool_call",
  "tool_result",
  "info",
  "session_start",
  "session_end",
  "connected",
]);

// ── Event formatting ────────────────────────────────────────────────────

interface ParsedEvent {
  type: string;
  raw: Record<string, unknown>;
}

function formatEventBatch(label: string, events: ParsedEvent[]): string {
  if (events.length === 0) return "";

  const lines: string[] = [`[socket_watch: ${label}] Event batch (${events.length} events):\n`];

  // Collapse consecutive text events into a single block
  let textAccum = "";

  const flushText = () => {
    if (textAccum) {
      // Truncate long text blocks
      const display = textAccum.length > 2000 ? textAccum.slice(0, 2000) + "..." : textAccum;
      lines.push(`[text] ${display}`);
      textAccum = "";
    }
  };

  for (const event of events) {
    if (event.type === "text") {
      const text = (event.raw as { text?: string }).text ?? "";
      textAccum += text;
      continue;
    }

    flushText();

    switch (event.type) {
      case "tool_call": {
        const raw = event.raw as { tool?: string; args?: unknown };
        const argsStr = JSON.stringify(raw.args ?? {}).slice(0, 200);
        lines.push(`[tool_call] ${raw.tool ?? "?"}: ${argsStr}`);
        break;
      }
      case "tool_result": {
        const raw = event.raw as { tool?: string; preview?: string; isError?: boolean };
        const prefix = raw.isError ? "ERROR: " : "";
        lines.push(`[tool_result] ${raw.tool ?? "?"}: ${prefix}${(raw.preview ?? "").slice(0, 200)}`);
        break;
      }
      case "info": {
        const raw = event.raw as { message?: string };
        lines.push(`[info] ${(raw.message ?? "").slice(0, 200)}`);
        break;
      }
      case "connected": {
        const raw = event.raw as { maySession?: string; activeAgents?: unknown[] };
        lines.push(
          `[connected] session: ${raw.maySession ?? "?"}, active agents: ${JSON.stringify(raw.activeAgents ?? [])}`,
        );
        break;
      }
      case "session_start": {
        const raw = event.raw as { agent?: string; sessionId?: string; task?: string };
        lines.push(`[session_start] ${raw.agent ?? "?"} (${raw.sessionId ?? "?"}): ${(raw.task ?? "").slice(0, 100)}`);
        break;
      }
      case "session_end": {
        const raw = event.raw as { agent?: string; sessionId?: string; status?: string; error?: string };
        const errorSuffix = raw.error ? ` — ${raw.error.slice(0, 100)}` : "";
        lines.push(`[session_end] ${raw.agent ?? "?"} (${raw.sessionId ?? "?"}): ${raw.status ?? "?"}${errorSuffix}`);
        break;
      }
      default: {
        lines.push(`[${event.type}] ${JSON.stringify(event.raw).slice(0, 200)}`);
        break;
      }
    }
  }

  flushText();
  return lines.join("\n");
}

// ── Watch entry ─────────────────────────────────────────────────────────

interface WatchEntry {
  watchId: string;
  label: string;
  socketPath: string;
  socket: Socket;
  connected: boolean;
  interrupt: boolean;
  filter: Set<string>;
  debounceMs: number;
  eventBuffer: ParsedEvent[];
  debounceTimer: ReturnType<typeof setTimeout> | null;
  eventsReceived: number;
}

let nextWatchId = 0;

// ── Options ─────────────────────────────────────────────────────────────

/** Options for the socket watch tool. */
export interface SocketWatchToolOptions {
  /** SubagentManager instance — used for followUp/steer injection. */
  manager: SubagentManager;
  /** Returns the session ID of the agent using this tool (for injection target). */
  getSessionId: () => string;
}

// ── Tool params ─────────────────────────────────────────────────────────

const SocketWatchParams: TSchema = Type.Object({
  action: StringEnum(["connect", "send", "disconnect", "list"] as const, {
    description: "Action to perform on socket connections.",
  }),
  socketPath: Type.Optional(Type.String({ description: "Path to Unix domain socket (required for 'connect')" })),
  watchId: Type.Optional(
    Type.String({ description: "Watch ID returned by connect (required for 'send', 'disconnect')" }),
  ),
  data: Type.Optional(
    Type.Unknown({
      description:
        "JSON data to send to the socket (required for 'send'). Must be a valid socket protocol command object.",
    }),
  ),
  label: Type.Optional(
    Type.String({ description: "Human-readable label for this connection (optional for 'connect')" }),
  ),
  debounceMs: Type.Optional(
    Type.Number({
      description: "Debounce interval in ms — events are batched and delivered after this much silence (default: 3000)",
    }),
  ),
  interrupt: Type.Optional(
    Type.Boolean({
      description:
        "If true, use steer (interrupting) instead of followUp (non-interrupting) for event injection (default: false)",
    }),
  ),
  filter: Type.Optional(
    Type.Array(Type.String(), {
      description:
        "Event types to forward. Default: text, tool_call, tool_result, info, session_start, session_end, connected. Use ['*'] for all.",
    }),
  ),
});
interface SocketWatchInput {
  action: "connect" | "send" | "disconnect" | "list";
  socketPath?: string;
  watchId?: string;
  data?: unknown;
  label?: string;
  debounceMs?: number;
  interrupt?: boolean;
  filter?: string[];
}

/**
 * Create a socket watch tool for connecting to Unix domain sockets.
 *
 * Returns the tool and a cleanup function. The cleanup function disconnects
 * all active socket connections — call it when the agent's session ends.
 */
export function createSocketWatchTool(opts: SocketWatchToolOptions): { tool: AgentTool; cleanup: () => void } {
  const { manager } = opts;
  const watches = new Map<string, WatchEntry>();

  function flushEvents(entry: WatchEntry): void {
    if (entry.eventBuffer.length === 0) return;

    const batch = formatEventBatch(entry.label, entry.eventBuffer);
    entry.eventBuffer = [];

    if (!batch) return;

    try {
      const sessionId = opts.getSessionId();
      if (entry.interrupt) {
        manager.steer(sessionId, batch);
      } else {
        manager.followUp(sessionId, batch);
      }
    } catch {
      // Session may be gone — silently drop
    }
  }

  function scheduleFlush(entry: WatchEntry): void {
    if (entry.debounceTimer) {
      clearTimeout(entry.debounceTimer);
    }
    entry.debounceTimer = setTimeout(() => {
      entry.debounceTimer = null;
      flushEvents(entry);
    }, entry.debounceMs);
  }

  function cleanup(): void {
    for (const entry of watches.values()) {
      if (entry.debounceTimer) clearTimeout(entry.debounceTimer);
      // Flush remaining events before disconnecting
      flushEvents(entry);
      try {
        entry.socket.destroy();
      } catch {
        /* ignore */
      }
    }
    watches.clear();
  }

  function getWatch(watchId: string): WatchEntry {
    const entry = watches.get(watchId);
    if (!entry) throw new Error(`No socket watch with ID "${watchId}"`);
    return entry;
  }

  const tool: AgentTool = {
    name: "socket_watch",
    label: "Socket Watch",
    description:
      "Connect to Unix domain sockets to receive events and send commands. " +
      "Events are debounced and delivered as follow-up messages between turns. " +
      "Use for coaching (watch coachee processes), receiving external input, or inter-agent communication.",
    parameters: SocketWatchParams,
    execute: async (_toolCallId, _params) => {
      const params = _params as SocketWatchInput;
      try {
        switch (params.action) {
          case "connect": {
            if (!params.socketPath) {
              return textResult(JSON.stringify({ error: "action 'connect' requires 'socketPath'" }));
            }

            const watchId = `w_${Date.now()}_${nextWatchId++}`;
            const label = params.label ?? params.socketPath;
            const debounceMs = params.debounceMs ?? 3000;
            const interrupt = params.interrupt ?? false;
            const filterArray = params.filter;
            const filter = filterArray?.includes("*") ? new Set(["*"]) : new Set(filterArray ?? [...DEFAULT_FILTER]);

            const socket = new Socket();

            const entry: WatchEntry = {
              watchId,
              label,
              socketPath: params.socketPath,
              socket,
              connected: false,
              interrupt,
              filter,
              debounceMs,
              eventBuffer: [],
              debounceTimer: null,
              eventsReceived: 0,
            };

            // Set up data handler (newline-delimited JSON)
            let buffer = "";
            socket.on("data", (data) => {
              buffer += data.toString();
              const lines = buffer.split("\n");
              buffer = lines.pop()!;

              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;

                try {
                  const parsed = JSON.parse(trimmed) as Record<string, unknown>;
                  const eventType = (parsed.type as string) ?? "unknown";

                  // Apply filter
                  if (!filter.has("*") && !filter.has(eventType)) continue;

                  entry.eventsReceived++;
                  entry.eventBuffer.push({ type: eventType, raw: parsed });
                  scheduleFlush(entry);
                } catch {
                  // Ignore non-JSON lines
                }
              }
            });

            socket.on("close", () => {
              entry.connected = false;
              // Flush remaining events
              if (entry.debounceTimer) clearTimeout(entry.debounceTimer);
              flushEvents(entry);
            });

            socket.on("error", (err) => {
              entry.connected = false;
              // Buffer the error as an event
              entry.eventBuffer.push({
                type: "error",
                raw: { type: "error", message: err.message },
              });
              if (entry.debounceTimer) clearTimeout(entry.debounceTimer);
              flushEvents(entry);
            });

            // Connect (async, but we return the watchId immediately)
            return new Promise<AgentToolResult<string>>((resolve) => {
              socket.on("connect", () => {
                entry.connected = true;
                watches.set(watchId, entry);
                resolve(textResult(JSON.stringify({ watchId, label, socketPath: params.socketPath })));
              });

              socket.on("error", (err) => {
                // If connection failed before we resolved, resolve with error
                if (!entry.connected) {
                  resolve(
                    textResult(JSON.stringify({ error: `Failed to connect to ${params.socketPath}: ${err.message}` })),
                  );
                }
              });

              // Timeout for connection
              const connectTimeout = setTimeout(() => {
                if (!entry.connected) {
                  socket.destroy();
                  resolve(textResult(JSON.stringify({ error: `Connection to ${params.socketPath} timed out (5s)` })));
                }
              }, 5000);

              socket.on("connect", () => clearTimeout(connectTimeout));

              socket.connect(params.socketPath!);
            });
          }

          case "send": {
            if (!params.watchId) {
              return textResult(JSON.stringify({ error: "action 'send' requires 'watchId'" }));
            }
            if (params.data === undefined) {
              return textResult(JSON.stringify({ error: "action 'send' requires 'data'" }));
            }
            const entry = getWatch(params.watchId);
            if (!entry.connected) {
              return textResult(JSON.stringify({ error: `Socket "${params.watchId}" is not connected` }));
            }
            const payload = JSON.stringify(params.data) + "\n";
            entry.socket.write(payload);
            return textResult(JSON.stringify({ sent: true, watchId: params.watchId }));
          }

          case "disconnect": {
            if (!params.watchId) {
              return textResult(JSON.stringify({ error: "action 'disconnect' requires 'watchId'" }));
            }
            const entry = getWatch(params.watchId);
            if (entry.debounceTimer) clearTimeout(entry.debounceTimer);
            flushEvents(entry);
            entry.socket.destroy();
            watches.delete(params.watchId);
            return textResult(JSON.stringify({ disconnected: true, watchId: params.watchId }));
          }

          case "list": {
            const entries = Array.from(watches.values()).map((e) => ({
              watchId: e.watchId,
              label: e.label,
              socketPath: e.socketPath,
              connected: e.connected,
              eventsReceived: e.eventsReceived,
            }));
            return textResult(JSON.stringify(entries));
          }

          default:
            return textResult(JSON.stringify({ error: `Unknown action: ${params.action}` }));
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return textResult(JSON.stringify({ error: msg }));
      }
    },
  };

  return { tool, cleanup };
}
