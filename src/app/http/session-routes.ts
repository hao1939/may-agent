/* eslint-disable @typescript-eslint/no-explicit-any */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { SqliteDb } from "./read-model/state-db.js";

export function createSessionRouteHandlers(options: {
  stateDir: string;
  getDb: () => SqliteDb;
  json: (data: unknown, status?: number) => Response;
}) {
  const { stateDir: STATE_DIR, getDb: _db, json } = options;

  function handleSession(sessionId: string): Response {
    const session = _db().prepare("SELECT * FROM sessions WHERE sessionId = ?").get(sessionId);
    if (!session) return json({ error: "Session not found" }, 404);
    const children = _db()
      .prepare(
        `
      WITH RECURSIVE tree AS (
        SELECT sessionId, agent, task, status, kind, parentSessionId, outcome, startedAt, endedAt, opCount, error, 0 as depth
        FROM sessions WHERE parentSessionId = ?
        UNION ALL
        SELECT s.sessionId, s.agent, s.task, s.status, s.kind, s.parentSessionId, s.outcome, s.startedAt, s.endedAt, s.opCount, s.error, t.depth + 1
        FROM sessions s JOIN tree t ON s.parentSessionId = t.sessionId WHERE t.depth < 10
      ) SELECT * FROM tree ORDER BY startedAt ASC
    `,
      )
      .all(sessionId);
    return json({ session, children });
  }

  function resolveSessionJsonl(sessionId: string): { path: string; source: string } | null {
    const path = join(STATE_DIR, "sessions", sessionId, "session.jsonl");
    if (existsSync(path)) return { path, source: ".state/sessions/" + sessionId + "/session.jsonl" };
    return null;
  }

  function readSessionTranscript(sessionId: string): Record<string, unknown> | null {
    const resolved = resolveSessionJsonl(sessionId);
    if (!resolved) return null;
    const rawLines = readFileSync(resolved.path, "utf-8").split("\n");
    const messages: unknown[] = [];
    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      if (!line) continue;
      const rawLine = i + 1;
      try {
        const entry = JSON.parse(line);
        const role = String(entry.role || "").toLowerCase();
        if (role === "user") {
          const text = Array.isArray(entry.content)
            ? entry.content.map((b: any) => b.text || "").join("")
            : typeof entry.content === "string"
              ? entry.content
              : "";
          // Skip session context injection (buildSessionContext output)
          if (text && !text.startsWith("# Session Context"))
            messages.push({ role: "user", text, rawLine, rawSource: resolved.source });
        } else if (role === "assistant") {
          const blocks = Array.isArray(entry.content) ? entry.content : [];
          const text = blocks
            .filter((b: any) => b.type === "text")
            .map((b: any) => b.text || "")
            .join("");
          const toolCalls = blocks
            .map((b: any, blockIndex: number) => ({ block: b, blockIndex }))
            .filter(({ block }: any) => block.type === "tool_use" || block.type === "toolCall")
            .map(({ block, blockIndex }: any) => ({
              id: block.id,
              tool: block.name,
              args: block.input ?? block.arguments ?? {},
              rawLine,
              rawSource: resolved.source,
              rawBlockIndex: blockIndex,
            }));
          if (text || toolCalls.length) {
            const msg: Record<string, unknown> = {
              role: "assistant",
              text,
              toolCalls,
              rawLine,
              rawSource: resolved.source,
            };
            if (entry.api) msg.api = entry.api;
            if (entry.model) msg.model = entry.model;
            if (entry.provider) msg.provider = entry.provider;
            if (entry.usage) msg.usage = entry.usage;
            if (entry.stopReason) msg.stopReason = entry.stopReason;
            if (entry.timestamp) msg.timestamp = entry.timestamp;
            if (entry.responseId) msg.responseId = entry.responseId;
            messages.push(msg);
          }
        } else if (role === "tool_result" || role === "toolresult") {
          const content = Array.isArray(entry.content)
            ? entry.content
                .map((b: any) => b.text || "")
                .join("")
                .slice(0, 2000)
            : typeof entry.content === "string"
              ? entry.content.slice(0, 2000)
              : "";
          messages.push({
            role: "tool_result",
            toolCallId: entry.toolCallId,
            toolName: entry.toolName,
            content,
            isError: entry.isError,
            timestamp: entry.timestamp,
            rawLine,
            rawSource: resolved.source,
          });
        }
      } catch {}
    }
    return { sessionId, source: resolved.source, messageCount: messages.length, messages };
  }

  function handleTranscript(sessionId: string): Response {
    const transcript = readSessionTranscript(sessionId);
    return transcript ? json(transcript) : json({ error: "Transcript not found" }, 404);
  }

  function handleRawLog(sessionId: string, url: URL): Response {
    const resolved = resolveSessionJsonl(sessionId);
    if (!resolved) return json({ error: "Transcript not found" }, 404);
    const lineNo = Number(url.searchParams.get("line") || "");
    if (!Number.isInteger(lineNo) || lineNo < 1) return json({ error: "line must be a positive integer" }, 400);
    const rawLines = readFileSync(resolved.path, "utf-8").split("\n");
    const raw = rawLines[lineNo - 1];
    if (!raw) return json({ error: "line not found" }, 404);
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(raw);
    } catch {}
    return json({ sessionId, source: resolved.source, line: lineNo, raw, parsed });
  }

  return {
    handleSession,
    handleTranscript,
    handleRawLog,
  };
}
