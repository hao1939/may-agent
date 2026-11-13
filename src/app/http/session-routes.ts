/* eslint-disable @typescript-eslint/no-explicit-any */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { SqliteDb } from "./read-model/state-db.js";

export type SessionDaemonFrameResult = {
  ok: boolean;
  error?: string;
};

export function createSessionRouteHandlers(options: {
  stateDir: string;
  getDb: () => SqliteDb;
  json: (data: unknown, status?: number) => Response;
  sendDaemonFrame: (frame: Record<string, unknown>) => Promise<SessionDaemonFrameResult>;
  buildPublishFrame: (
    type: string,
    data: Record<string, unknown>,
    options?: {
      target?: { appId?: string; taskId?: string; sessionId?: string };
      idempotencyKey?: string;
    },
  ) => Record<string, unknown>;
}) {
  const { stateDir: STATE_DIR, getDb: _db, json, sendDaemonFrame, buildPublishFrame } = options;

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

  function resolveSessionEval(
    sessionId: string,
  ): { path: string; source: string; session: { path: string; source: string } } | null {
    const session = resolveSessionJsonl(sessionId);
    if (!session) return null;
    return {
      path: session.path.replace(/session\.jsonl$/, "session.eval.jsonl"),
      source: session.source.replace(/session\.jsonl$/, "session.eval.jsonl"),
      session,
    };
  }

  function readEvalRows(evalPath: string): unknown[] {
    if (!existsSync(evalPath)) return [];
    return readFileSync(evalPath, "utf-8")
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return { parseError: true, raw: line };
        }
      });
  }

  function handleSessionEval(sessionId: string): Response {
    const resolved = resolveSessionEval(sessionId);
    if (!resolved) return json({ error: "Session not found" }, 404);
    return json({
      sessionId,
      source: resolved.source,
      exists: existsSync(resolved.path),
      rows: readEvalRows(resolved.path),
    });
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

  async function handleSessionCancel(sessionId: string): Promise<Response> {
    if (!sessionId) return json({ error: "sessionId required" }, 400);
    const result = await sendDaemonFrame(buildPublishFrame("session.cancel.requested", {}, { target: { sessionId } }));
    if (!result.ok) return json({ error: result.error }, 503);
    return json({ ok: true, sessionId });
  }

  async function handleSessionMessage(req: Request, sessionId: string): Promise<Response> {
    if (!sessionId) return json({ error: "sessionId required" }, 400);
    let body: { content?: string };
    try {
      body = (await req.json()) as { content?: string };
    } catch {
      return json({ error: "invalid json" }, 400);
    }
    const content = (body.content ?? "").trim();
    if (!content) return json({ error: "content required" }, 400);
    // The daemon validates ownership and steers only live sessions.
    // New work for an ended execution must go through its owning Task.
    const result = await sendDaemonFrame(
      buildPublishFrame("session.steer.requested", { message: content, channel: "web-ui" }, { target: { sessionId } }),
    );
    if (!result.ok) return json({ error: result.error }, 503);
    return json({ ok: true, sessionId, deliveredAt: Date.now() });
  }

  return {
    handleSession,
    handleSessionEval,
    handleTranscript,
    handleRawLog,
    handleSessionCancel,
    handleSessionMessage,
  };
}
