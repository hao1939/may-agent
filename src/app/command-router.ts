import type { SubagentManager } from "../lib/index.js";
import { log } from "../lib/log.js";
import type { ChatSession } from "./chat-session.js";
import type { EventBus } from "./event-bus.js";

export interface CommandRouterOptions {
  bus: EventBus;
  manager: SubagentManager;
  getChatSession: () => ChatSession | undefined;
  clearCancelLatch: () => void;
  reload: () => void | Promise<void>;
  restart: () => void;
  shutdown: () => void;
}

export interface CommandRouter {
  handleInput: (message: string, source?: string) => void;
  close: () => void;
}

/**
 * Routes human/control input from console, socket, Telegram, and the event bus.
 *
 * Chat sessions own free-form input. Non-chat daemon modes only accept built-in
 * control commands so task/cron processes do not accidentally become routers.
 */
export function attachCommandRouter(options: CommandRouterOptions): CommandRouter {
  const { bus, manager } = options;

  function handleInput(message: string, source?: string): void {
    options.clearCancelLatch();
    const chatSession = options.getChatSession();
    if (chatSession) {
      chatSession.handleInput(message, source);
      return;
    }

    const lower = message.trim().toLowerCase();
    if (lower === "status") {
      const sessions = manager.status();
      if (sessions.length === 0) {
        bus.emit({ type: "info", message: "[status] No active sessions" });
      } else {
        const lines = sessions.map(
          (s) => `  ${s.agent} (${s.sessionId}): ${s.status} - "${s.task.slice(0, 80)}" [${s.runtime}]`,
        );
        bus.emit({ type: "info", message: `[status] ${sessions.length} active session(s):\n${lines.join("\n")}` });
      }
      return;
    }
    if (lower === "cancel" || lower === "cancel all") {
      for (const s of manager.status()) {
        if (s.status === "running") manager.cancel(s.sessionId);
      }
      bus.emit({ type: "info", message: "[cmd] Cancelled all running sessions" });
      return;
    }
    if (lower === "reload") {
      void options.reload();
      return;
    }
    if (lower === "restart") {
      options.restart();
      return;
    }
    if (lower === "close") {
      options.shutdown();
      return;
    }

    bus.emit({ type: "info", message: "[cmd] Input ignored (no chat session). Use --chat for interactive mode." });
  }

  const unsubscribe = bus.subscribe((event) => {
    switch (event.type) {
      case "input":
        handleInput(event.message ?? event.text ?? "", event.source);
        break;
      case "steer": {
        const targetSid = event.sessionId;
        const steerText = event.message ?? event.text ?? "";
        if (!targetSid) break;
        try {
          const sessions = manager.status();
          const target = sessions.find((s) => s.sessionId === targetSid);
          if (target?.status === "idle") {
            void manager.input(targetSid, steerText);
          } else if (target) {
            manager.steer(targetSid, steerText, "human");
          } else {
            try {
              manager.resumeSession(targetSid, steerText, { source: event.source ?? "human" });
              log("info", `[steer] Resumed cold session ${targetSid}`);
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              log("error", `[steer] ${msg}`);
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          log("error", `[steer] ${msg}`);
        }
        break;
      }
      case "cancel":
        if (event.sessionId) manager.cancel(event.sessionId);
        break;
      case "cancel_all":
        handleInput("cancel all");
        break;
      case "fork":
        if ("agent" in event && "task" in event) {
          bus.emit({
            type: "message.created",
            from: (event as any).opts?.source || "socket",
            to: (event as any).agent,
            content: (event as any).task,
            intent: "fork",
            priority: "P0",
          } as any);
          const chatSession = options.getChatSession();
          if (chatSession && event.agent === "may") {
            chatSession.handleInput(event.task, "socket");
          } else {
            const sessionId = manager.run(event.agent, event.task, {
              kind: (event.opts?.kind as "chat" | "job" | "call" | undefined) ?? "job",
              requestId: event.opts?.requestId,
            });
            log("info", `[fork] Started ${event.agent} session: ${sessionId}`);
          }
        }
        break;
      case "reload":
        void options.reload();
        break;
      case "message":
        if ("from" in event && "to" in event && "task" in event) {
          try {
            bus.emit({
              type: "message.created",
              from: (event as any).from ?? "human",
              to: (event as any).to,
              content: (event as any).task,
              priority: (event as any).priority,
            } as any);
            log("info", `[message] ${(event as any).from ?? "human"} -> ${(event as any).to}: ${((event as any).task as string).slice(0, 80)}`);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            log("error", `[message] Failed: ${msg}`);
          }
        }
        break;
      case "resume":
        if ("sessionId" in event && event.sessionId) {
          const ok = manager.resumeInterrupted(event.sessionId);
          if (ok) {
            log("info", `[resume] Resumed session ${event.sessionId}`);
          } else {
            log("warn", `[resume] Failed to resume session ${event.sessionId}`);
          }
        }
        break;
      case "restart":
        options.restart();
        break;
      case "shutdown":
        options.shutdown();
        break;
    }
  });

  return { handleInput, close: unsubscribe };
}
