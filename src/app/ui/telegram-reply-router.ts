import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface TelegramNotificationContext {
  event_type?: string | null;
  agent?: string | null;
  session_id?: string | null;
  project_id?: string | null;
  data?: string | null;
}

export function normalizeProjectPath(value: unknown, projectRoot: string): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  let path = value.trim()
    .replace(/^\/app\//, "")
    .replace(new RegExp(`^${escapeRegExp(projectRoot)}/`), "")
    .replace(/^\.?\//, "")
    .replace(/\/project\.md$/, "")
    .replace(/[),.;:]+$/, "")
    .replace(/\/$/, "");
  if (!path.startsWith("agents/")) path = `agents/${path}`;
  if (!/^agents\/(shared\/projects\/|[^/]+\/workspace\/projects\/)[^/\s]+/.test(path)) return null;
  return path;
}

export function extractProjectPath(text: string, projectRoot: string): string | null {
  const candidates = text.match(/(?:\/app\/)?(?:agents\/)?(?:shared\/projects\/|[^/\s]+\/workspace\/projects\/)[A-Za-z0-9._-]+(?:\/project\.md)?/g) ?? [];
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

  parts.push(`[User replying to notification${ctx.agent ? ` from ${ctx.agent}` : ""}${ctx.project_id ? ` about project "${ctx.project_id}"` : ""}]`);
  if (ctx.data) {
    try {
      const data = JSON.parse(ctx.data);
      if (data.summary) parts.push(`Context: ${data.summary}`);
      if (data.text) parts.push(`Original notification: ${data.text}`);
    } catch {
      /* ignore malformed notification context */
    }
  }
  if (ctx.event_type) parts.push(`Event type: ${ctx.event_type}`);
  if (opts.sessionContext?.length) parts.push(...opts.sessionContext);
  parts.push("");
  parts.push(`User says: ${opts.text}`);

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
