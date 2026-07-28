import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface TelegramNotificationContext {
  event_type?: string | null;
  agent?: string | null;
  session_id?: string | null;
  project_id?: string | null;
  data?: string | null;
}

export interface TelegramReplyContext {
  replyToMsgId: number;
  eventType?: string;
  agent?: string;
  projectId?: string;
  sessionId?: string;
  conversationId?: string;
  originalIssue?: Record<string, unknown>;
  expectedClosure?: unknown[];
  actionHints?: unknown[];
  notification?: {
    text?: string;
    summary?: string;
    reason?: string;
    requestedAction?: string;
    requestedHumanAction?: string;
  };
}

export type TelegramReplyRoute =
  | {
      kind: "notification";
      owner: string;
      projectPath: string | null;
      sessionId: string | null;
      enrichedText: string;
      hasSessionCtx: boolean;
      context: TelegramReplyContext;
      infoMessage: string;
    }
  | {
      kind: "quote";
      enrichedText: string;
      infoMessage: string;
    }
  | {
      kind: "missing-context";
      infoMessage: string;
    };

export function buildTelegramReplyRoute(opts: {
  text: string;
  replyToMsgId: number;
  ctx: TelegramNotificationContext | null;
  quotedText: string;
  projectRoot: string;
  persistDir: string;
  interfaceAgent: string;
}): TelegramReplyRoute {
  if (opts.ctx) {
    const sessionId = opts.ctx.session_id ? String(opts.ctx.session_id) : null;
    const sessionContext = sessionId ? readSessionReplyContext(opts.persistDir, sessionId) : [];
    const owner = opts.ctx.agent || opts.interfaceAgent || "unknown";
    const context = buildTelegramReplyContext(opts.ctx, opts.replyToMsgId);
    return {
      kind: "notification",
      owner,
      projectPath: normalizeProjectPath(opts.ctx.project_id, opts.projectRoot),
      sessionId,
      enrichedText: buildNotificationReplyText({ ctx: opts.ctx, text: opts.text, sessionContext }),
      hasSessionCtx: Boolean(sessionId),
      context,
      infoMessage: `[telegram] Enriched reply (ctx: ${opts.ctx.event_type}/${owner}${sessionId ? "/session" : ""})`,
    };
  }

  if (opts.quotedText) {
    return {
      kind: "quote",
      enrichedText: buildTelegramQuoteReplyText(opts.text, opts.quotedText),
      infoMessage: `[telegram] Enriched reply from Telegram quote (msg ${opts.replyToMsgId})`,
    };
  }

  return {
    kind: "missing-context",
    infoMessage: `[telegram] Reply context missing for msg ${opts.replyToMsgId}`,
  };
}

function readStoredConversation(data: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!data) return null;
  const conversation = objectOrNull(data.conversation);
  const conversationId =
    stringOrNull(data.conversationId) ?? stringOrNull(conversation?.conversationId) ?? stringOrNull(conversation?.id);
  if (!conversationId) return null;
  return {
    conversationId,
    originalIssue: objectOrNull(conversation?.originalIssue) ?? objectOrNull(data.originalIssue) ?? undefined,
    lastHandledBy: objectOrNull(conversation?.lastHandledBy) ?? objectOrNull(data.lastHandledBy) ?? undefined,
  };
}

function buildTelegramReplyContext(ctx: TelegramNotificationContext, replyToMsgId: number): TelegramReplyContext {
  const data = parseNotificationData(ctx.data);
  const conversation = readStoredConversation(data);
  const expectedClosure = Array.isArray(data?.expectedClosure) ? data.expectedClosure : undefined;
  const actionHints = Array.isArray(data?.actionHints) ? data.actionHints : undefined;
  const notification: TelegramReplyContext["notification"] = {};
  for (const key of ["text", "summary", "reason", "requestedAction", "requestedHumanAction"] as const) {
    const value = stringOrNull(data?.[key]);
    if (value) notification[key] = value;
  }
  return {
    replyToMsgId,
    eventType: ctx.event_type ?? undefined,
    agent: ctx.agent ?? undefined,
    projectId: ctx.project_id ?? undefined,
    sessionId: ctx.session_id ?? undefined,
    conversationId: stringOrNull(conversation?.conversationId) ?? undefined,
    originalIssue: objectOrNull(conversation?.originalIssue) ?? undefined,
    expectedClosure,
    actionHints,
    ...(Object.keys(notification).length ? { notification } : {}),
  };
}

function parseNotificationData(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    return objectOrNull(JSON.parse(raw));
  } catch {
    return null;
  }
}

function objectOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function normalizeProjectPath(value: unknown, projectRoot: string): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  let path = value
    .trim()
    .replace(/^\/app\//, "")
    .replace(new RegExp(`^${escapeRegExp(projectRoot)}/`), "")
    .replace(/^\.?\//, "")
    .replace(/\/project\.md$/, "")
    .replace(/[),.;:]+$/, "")
    .replace(/\/$/, "");
  path = path.replace(/^agents\/shared\/projects\//, "projects/").replace(/^shared\/projects\//, "projects/");
  if (/^projects\/[^/\s]+/.test(path)) return path;
  if (!path.startsWith("agents/")) path = `agents/${path}`;
  if (!/^agents\/[^/]+\/workspace\/projects\/[^/\s]+/.test(path)) return null;
  return path;
}

export function extractProjectPath(text: string, projectRoot: string): string | null {
  const candidates =
    text.match(
      /(?:\/app\/)?(?:(?:agents\/)?shared\/projects\/|projects\/|(?:agents\/)?[^/\s]+\/workspace\/projects\/)[A-Za-z0-9._-]+(?:\/project\.md)?/g,
    ) ?? [];
  for (const candidate of candidates) {
    const normalized = normalizeProjectPath(candidate, projectRoot);
    if (normalized) return normalized;
  }
  return null;
}

export function buildNotificationReplyText(opts: {
  ctx: TelegramNotificationContext;
  text: string;
  sessionContext?: string[];
}): string {
  const parts: string[] = [];
  const { ctx } = opts;

  parts.push(
    `[User replying to notification${ctx.agent ? ` from ${ctx.agent}` : ""}${ctx.project_id ? ` about project "${ctx.project_id}"` : ""}]`,
  );
  parts.push("");
  parts.push("Human reply");
  parts.push(opts.text);

  const data = parseNotificationData(ctx.data);
  const situation = stringOrNull(data?.reason) ?? stringOrNull(data?.summary) ?? stringOrNull(data?.verdict);
  const requestedAction = stringOrNull(data?.requestedAction) ?? stringOrNull(data?.requestedHumanAction);
  const visibleNotification = stringOrNull(data?.text) ?? stringOrNull(data?.message);

  if (situation || requestedAction || visibleNotification || ctx.project_id) {
    parts.push("");
    parts.push("Notification context");
    if (ctx.project_id) parts.push(`Project: ${ctx.project_id}`);
    if (situation) parts.push(`Situation: ${situation}`);
    if (requestedAction) parts.push(`Original ask: ${requestedAction}`);
    if (visibleNotification) parts.push(`Visible notification: ${visibleNotification.slice(0, 800)}`);
  }

  if (opts.sessionContext?.length) parts.push(...opts.sessionContext);
  if (readStoredConversation(data)?.conversationId || data?.expectedClosure || data?.actionHints) {
    parts.push("");
    parts.push("System note");
    parts.push(
      "This reply was matched to the original Telegram notification. Routing metadata is stored with that notification record; do not ask the human for internal ids.",
    );
  }
  parts.push("");
  parts.push("First understand the human's intention. A question or request for advice is not a decision.");
  parts.push("If the intended next action is uncertain, state the likely interpretation and ask one focused question.");
  parts.push("Keep consequential state pending until the intention is clear, then continue the tracked work.");

  return parts.join("\n");
}

export function buildTelegramQuoteReplyText(text: string, quoted: string): string {
  return [
    "[User replying to Telegram message]",
    `Original Telegram message: ${quoted.slice(0, 1000)}`,
    "",
    `User says: ${text}`,
  ].join("\n");
}

export function readSessionReplyContext(persistDir: string, sessionId: string): string[] {
  const paths = [
    join(persistDir, "sessions", sessionId, "session-compact.jsonl"),
    join(persistDir, "sessions", "history", sessionId, "session-compact.jsonl"),
  ];

  for (const p of paths) {
    try {
      if (!existsSync(p)) continue;

      const lines = readFileSync(p, "utf-8").split("\n").filter(Boolean);
      if (lines.length === 0) return [];

      const first = JSON.parse(lines[0]);
      const summary = first.content?.[0]?.text?.slice(0, 500) || "";
      const lastAssistant = findLastAssistantText(lines);
      const context = [`\nSession context (${lines.length} messages):`];
      if (summary) context.push(`  Summary: ${summary.slice(0, 300)}`);
      if (lastAssistant) context.push(`  Last action: ${lastAssistant}`);
      return context;
    } catch {
      return [];
    }
  }

  return [];
}

function findLastAssistantText(lines: string[]): string {
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const msg = JSON.parse(lines[i]);
      if (msg.role !== "assistant" || !msg.content) continue;
      for (const c of msg.content) {
        if (c.type === "text" && c.text?.trim()) return c.text.slice(0, 200);
      }
    } catch {
      /* ignore malformed transcript lines */
    }
  }
  return "";
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
