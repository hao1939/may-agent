import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { SubagentManager } from "../lib/index.js";
import { log } from "../lib/log.js";
import type { ChatSession } from "./chat-session.js";
import type { EventBus } from "./event-bus.js";
import { isRecord, normalizeEventOwner } from "../../packages/control/src/event-envelope.js";

export interface CommandRouterOptions {
  bus: EventBus;
  manager: SubagentManager;
  getChatSession: () => ChatSession | undefined;
  clearCancelLatch: () => void;
  projectRoot: string;
  reload: () => void | Promise<void>;
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

/**
 * Routes human/control input from console, socket, Telegram, and the event bus.
 *
 * Chat sessions own free-form input. Non-chat daemon modes only accept built-in
 * control commands so task/cron processes do not accidentally become routers.
 */
export function attachCommandRouter(options: CommandRouterOptions): CommandRouter {
  const { bus, manager } = options;

  function normalizeProjectPath(value: unknown): string | null {
    if (typeof value !== "string" || !value.trim()) return null;
    let path = value.trim()
      .replace(/^\/app\//, "")
      .replace(new RegExp(`^${escapeRegExp(options.projectRoot)}/`), "")
      .replace(/^\.?\//, "")
      .replace(/\/project\.md$/, "")
      .replace(/[),.;:]+$/, "")
      .replace(/\/$/, "");
    path = path
      .replace(/^agents\/shared\/projects\//, "projects/")
      .replace(/^shared\/projects\//, "projects/");
    if (/^projects\/[^/\s]+$/.test(path)) return path;
    if (!path.startsWith("agents/")) path = `agents/${path}`;
    if (!/^agents\/[^/]+\/workspace\/projects\/[^/\s]+$/.test(path)) return null;
    return path;
  }

  function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function projectOwner(projectPath: string): string {
    const projectFile = join(options.projectRoot, projectPath, "project.md");
    try {
      const content = readFileSync(projectFile, "utf-8");
      const match = content.match(/^---\s*\n[\s\S]*?\nowner:\s*([^\n]+)\n[\s\S]*?\n---/m);
      if (match?.[1]) return match[1].trim().replace(/^["']|["']$/g, "");
    } catch {
      /* best-effort owner lookup */
    }
    return "may";
  }

  function appendProjectDiscussionEntry(projectPath: unknown, comment: unknown, source?: string, author?: string): boolean {
    const normalized = normalizeProjectPath(projectPath);
    const trimmed = typeof comment === "string" ? comment.trim() : "";
    if (!normalized || !trimmed) {
      bus.emit({ type: "info", message: `[project.comment] Invalid project comment event from ${source ?? "unknown"}` });
      return false;
    }

    const projectDir = join(options.projectRoot, normalized);
    const projectFile = join(projectDir, "project.md");
    if (!existsSync(projectFile)) {
      bus.emit({ type: "info", message: `[project.comment] Project target not found: ${normalized}` });
      return false;
    }

    const date = new Date().toISOString().slice(0, 10);
    const discussionFile = join(projectDir, "discussion.md");
    const entry = `\n### ${author?.trim() || "hao"} - ${date}\n${trimmed}\n`;
    if (existsSync(discussionFile)) appendFileSync(discussionFile, entry, "utf-8");
    // Seed with `---read @iter0---` so a freshly created discussion.md does
    // not look fully unread to the project workflow.
    else writeFileSync(discussionFile, `# Discussion\n\n---read @iter0---\n${entry}`, "utf-8");

    // Flip status to `active` so downstream watchers see the project as
    // pushable immediately, not on the next handler tick.
    let resumed = false;
    let content = readFileSync(projectFile, "utf-8");
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (fmMatch) {
      const statusLine = fmMatch[1].match(/^status:\s*(.+)$/m);
      const current = statusLine ? statusLine[1].trim().toLowerCase() : "";
      if (["blocked", "waiting", "paused", "pending-review"].includes(current)) {
        const newFrontmatter = fmMatch[1].replace(/^status:\s*.+$/m, "status: active");
        content = content.replace(fmMatch[0], `---\n${newFrontmatter}\n---`);
        writeFileSync(projectFile, content, "utf-8");
        resumed = true;
      }
    }

    bus.emit({
      type: "project.nudge",
      source: source ?? "command-router",
      owner: normalizeEventOwner(projectOwner(normalized)),
      data: {
        projectPath: normalized,
        comment: true,
        commentText: trimmed,
      },
    } as any);
    bus.emit({
      type: "info",
      message: `[project.comment] Appended comment and nudged ${normalized}${resumed ? " (status → active)" : ""}`,
    });
    return true;
  }

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

  function handleSteer(sessionId: unknown, message: unknown, source?: string): void {
    const targetSid = nonEmptyString(sessionId);
    const steerText = nonEmptyString(message);
    if (!targetSid || !steerText) return;
    try {
      const sessions = manager.status();
      const target = sessions.find((s) => s.sessionId === targetSid);
      if (target) {
        // Idle or running — send() handles both: it enqueues the user
        // turn for the next agent loop iteration (idle: wakes up;
        // running: queued for mid-flight delivery).
        manager.send(targetSid, steerText);
      } else {
        try {
          manager.resumeSession(targetSid, steerText, { source: source ?? "human" });
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
  }

  function cancelAllRunningSessions(): void {
    for (const s of manager.status()) {
      if (s.status === "running") manager.cancel(s.sessionId);
    }
    bus.emit({ type: "info", message: "[cmd] Cancelled all running sessions" });
  }

  function handleChatStart(event: unknown): void {
    const data = eventData(event);
    const message = nonEmptyString(data.message);
    if (!message) return;
    const agent = nonEmptyString(data.agent) ?? "may";
    const source = eventSource(event, nonEmptyString(data.channel) ?? "human");
    const forceNew = data.forceNew === true;
    const chatSession = options.getChatSession();
    if (chatSession && agent === "may" && !forceNew) {
      chatSession.handleInput(message, source);
      return;
    }

    bus.emit({
      type: "message.created",
      source,
      owner: normalizeEventOwner(agent),
      urgency: "immediate",
      data: {
        from: source,
        to: agent,
        content: message,
        intent: "chat.start",
        priority: "P0",
      },
    } as any);
    const sessionId = manager.run(agent, message, {
      kind: "chat",
      requestId: nonEmptyString(data.requestId) ?? undefined,
    });
    log("info", `[chat.start] Started ${agent} chat session: ${sessionId}`);
  }

  function handleFork(event: any): void {
    if (!("agent" in event) || !("task" in event)) return;
    bus.emit({
      type: "message.created",
      source: event.opts?.source || "socket",
      owner: normalizeEventOwner(event.agent),
      urgency: "immediate",
      data: {
        from: event.opts?.source || "socket",
        to: event.agent,
        content: event.task,
        intent: "fork",
        priority: "P0",
      },
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

  const unsubscribe = bus.subscribe((event) => {
    switch (event.type) {
      case "input":
        if (typeof event.message !== "string") break;
        handleInput(event.message, event.source);
        break;
      case "steer": {
        handleSteer(event.sessionId, event.message, event.source);
        break;
      }
      case "session.steer.requested": {
        const data = eventData(event);
        handleSteer(data.sessionId, data.message, eventSource(event));
        break;
      }
      case "chat.start.requested":
        handleChatStart(event);
        break;
      case "cancel":
        if (event.sessionId) manager.cancel(event.sessionId);
        break;
      case "session.cancel.requested": {
        const data = eventData(event);
        const sessionId = nonEmptyString(data.sessionId);
        if (sessionId) manager.cancel(sessionId);
        break;
      }
      case "cancel_all":
      case "session.cancel_all.requested":
        cancelAllRunningSessions();
        break;
      case "project.comment.created":
        {
          const data = eventData(event);
          appendProjectDiscussionEntry(
            data.projectPath,
            data.comment,
            typeof event.source === "string" ? event.source : undefined,
            typeof data.author === "string" ? data.author : undefined,
          );
        }
        break;
      case "fork":
        handleFork(event);
        break;
      case "reload":
      case "runtime.reload.requested":
        void options.reload();
        break;
      case "restart":
      case "runtime.restart.requested":
        options.restart();
        break;
      case "shutdown":
      case "runtime.shutdown.requested":
        options.shutdown();
        break;
    }
  });

  return { handleInput, close: unsubscribe };
}
