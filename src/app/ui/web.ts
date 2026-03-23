/**
 * may-agent Web UI — standalone HTTP server for dashboard + chat.
 *
 * Reads the agent's state directory (SQLite + session JSONL files).
 * Optionally proxies WebSocket to the agent's Unix socket for chat.
 *
 * Usage: bun src/app/ui/web.ts [--state-dir .state] [--port 8080]
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// Bun-specific types (this file runs under Bun only, not compiled into the binary)
declare const Bun: {
  serve(opts: {
    port: number;
    fetch(req: Request, server: any): Response | undefined;
    websocket: { open(ws: any): void; message(ws: any, msg: any): void; close(ws: any): void };
  }): { port: number };
};
declare interface ImportMeta { url: string; }

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { connect } from "node:net";
import { getDb } from "../../lib/requests.js";
import type { SqliteDb } from "../../lib/db.js";

// ── CLI args ──────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function getArg(name: string, fallback: string): string {
  const idx = args.indexOf(name);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
}

const STATE_DIR = resolve(getArg("--state-dir", ".state"));
const PORT = parseInt(getArg("--port", "8080"), 10);

if (!existsSync(STATE_DIR)) {
  console.error(`State directory not found: ${STATE_DIR}`);
  process.exit(1);
}

console.log(`may-agent web UI`);
console.log(`  state: ${STATE_DIR}`);
console.log(`  port:  ${PORT}`);

// ── DB ────────────────────────────────────────────────────────────────

function db(): SqliteDb {
  return getDb(STATE_DIR);
}

// ── Socket discovery ──────────────────────────────────────────────────

function findSocketPath(): string | null {
  const instancesDir = join(STATE_DIR, "instances");
  if (!existsSync(instancesDir)) return null;
  // Prefer instances whose identity.json says "running"
  const candidates: Array<{ path: string; running: boolean }> = [];
  for (const name of readdirSync(instancesDir)) {
    const dir = join(instancesDir, name);
    for (const file of readdirSync(dir)) {
      if (file.endsWith(".sock")) {
        const sockPath = join(dir, file);
        if (!existsSync(sockPath)) continue;
        let running = false;
        try {
          const identity = JSON.parse(readFileSync(join(dir, "identity.json"), "utf-8"));
          running = identity.status === "running";
        } catch { /* no identity — treat as maybe-alive */ }
        candidates.push({ path: sockPath, running });
      }
    }
  }
  // Return the first running instance, or fall back to any socket
  return candidates.find(c => c.running)?.path ?? candidates[0]?.path ?? null;
}

// ── API handlers ──────────────────────────────────────────────────────

function handleRequests(url: URL): Response {
  const from = url.searchParams.get("from") || undefined;
  const status = url.searchParams.get("status") || undefined;
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 200);
  const offset = parseInt(url.searchParams.get("offset") || "0", 10);

  let where = "1=1";
  const params: unknown[] = [];

  if (from) { where += " AND fromEntity = ?"; params.push(from); }
  if (status) { where += " AND status = ?"; params.push(status); }

  const total = (db().prepare(`SELECT COUNT(*) as cnt FROM requests WHERE ${where}`).get(...params) as any).cnt;
  const rows = db().prepare(
    `SELECT r.*, s.outcome, s.agent as sessAgent
     FROM requests r
     LEFT JOIN sessions s ON r.sessionId = s.sessionId
     WHERE ${where}
     ORDER BY r.createdAt DESC LIMIT ? OFFSET ?`
  ).all(...params, limit, offset);

  return json({ requests: rows, total, limit, offset });
}

function handleSession(sessionId: string): Response {
  const session = db().prepare("SELECT * FROM sessions WHERE sessionId = ?").get(sessionId);
  if (!session) return json({ error: "Session not found" }, 404);

  // Recursive children
  const children = db().prepare(`
    WITH RECURSIVE tree AS (
      SELECT sessionId, agent, task, status, kind, parentSessionId, outcome, startedAt, endedAt, opCount, error, 0 as depth
      FROM sessions WHERE parentSessionId = ?
      UNION ALL
      SELECT s.sessionId, s.agent, s.task, s.status, s.kind, s.parentSessionId, s.outcome, s.startedAt, s.endedAt, s.opCount, s.error, t.depth + 1
      FROM sessions s JOIN tree t ON s.parentSessionId = t.sessionId
      WHERE t.depth < 10
    )
    SELECT * FROM tree ORDER BY startedAt ASC
  `).all(sessionId);

  return json({ session, children });
}

function handleTranscript(sessionId: string): Response {
  // Try active, then history
  let jsonlPath = join(STATE_DIR, "sessions", sessionId, "session.jsonl");
  if (!existsSync(jsonlPath)) {
    jsonlPath = join(STATE_DIR, "sessions", "history", sessionId, "session.jsonl");
  }
  if (!existsSync(jsonlPath)) return json({ error: "Transcript not found" }, 404);

  const lines = readFileSync(jsonlPath, "utf-8").split("\n").filter(Boolean);
  const messages: unknown[] = [];

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      // Simplify the JSONL entries for the UI
      if (entry.role === "user") {
        const text = Array.isArray(entry.content)
          ? entry.content.map((b: any) => b.text || "").join("")
          : typeof entry.content === "string" ? entry.content : "";
        if (text) messages.push({ role: "user", text });
      } else if (entry.role === "assistant") {
        const blocks = Array.isArray(entry.content) ? entry.content : [];
        const text = blocks.filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
        const toolCalls = blocks.filter((b: any) => b.type === "tool_use").map((b: any) => ({
          id: b.id, tool: b.name, args: b.input,
        }));
        if (text || toolCalls.length) messages.push({ role: "assistant", text, toolCalls });
      } else if (entry.role === "tool_result") {
        const content = Array.isArray(entry.content)
          ? entry.content.map((b: any) => b.text || "").join("").slice(0, 2000)
          : typeof entry.content === "string" ? entry.content.slice(0, 2000) : "";
        messages.push({ role: "tool_result", toolCallId: entry.toolCallId, content, isError: entry.isError });
      }
    } catch { /* skip malformed lines */ }
  }

  return json({ sessionId, messageCount: messages.length, messages });
}

function handleStats(): Response {
  const now = Date.now();
  const day = now - 86400000;
  const week = now - 7 * 86400000;

  const sess24h = db().prepare(
    `SELECT agent, COUNT(*) as cnt,
       SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done,
       SUM(CASE WHEN status='error' THEN 1 ELSE 0 END) as errors,
       AVG(endedAt - startedAt) as avgMs
     FROM sessions WHERE startedAt > ? GROUP BY agent ORDER BY cnt DESC`
  ).all(day);

  const req24h = db().prepare(
    `SELECT fromEntity, COUNT(*) as cnt,
       SUM(CASE WHEN status='COMPLETED' THEN 1 ELSE 0 END) as completed
     FROM requests WHERE createdAt > ? GROUP BY fromEntity ORDER BY cnt DESC`
  ).all(day);

  const totalSess7d = (db().prepare("SELECT COUNT(*) as cnt FROM sessions WHERE startedAt > ?").get(week) as any).cnt;
  const humanReq7d = (db().prepare("SELECT COUNT(*) as cnt FROM requests WHERE fromEntity='human' AND createdAt > ?").get(week) as any).cnt;

  return json({
    last24h: { sessions: sess24h, requests: req24h },
    last7d: { totalSessions: totalSess7d, humanRequests: humanReq7d },
    socketAvailable: !!findSocketPath(),
  });
}

// ── Static HTML ───────────────────────────────────────────────────────

function serveIndex(): Response {
  const htmlPath = join(dirname(new URL(import.meta.url).pathname), "web-static", "index.html");
  if (existsSync(htmlPath)) {
    return new Response(readFileSync(htmlPath, "utf-8"), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
  return new Response("index.html not found", { status: 404 });
}

// ── Helpers ───────────────────────────────────────────────────────────

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}

// ── WebSocket → Unix socket proxy ─────────────────────────────────────

import type { Socket } from "node:net";

const wsToUnix = new Map<any, Socket>();

function proxyWebSocket(ws: any): void {
  const socketPath = findSocketPath();
  if (!socketPath) {
    ws.send(JSON.stringify({ type: "error", message: "Agent socket not found — chat unavailable" }));
    ws.close();
    return;
  }

  const unix = connect(socketPath);
  wsToUnix.set(ws, unix);
  let buffer = "";

  unix.on("data", (chunk: Buffer) => {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line);
        // When we receive the welcome message, subscribe to the chat session
        if (event.type === "connected" && event.sessionId) {
          unix.write(JSON.stringify({ type: "subscribe", sessions: [event.sessionId] }) + "\n");
        }
        // Forward everything to the browser (socket server already filters via subscribe)
        // Skip subscribe "ok" responses — they're internal
        if (event.type === "ok" && event.command === "subscribe") continue;
        ws.send(line);
      } catch {
        try { ws.send(line); } catch { /* client gone */ }
      }
    }
  });

  unix.on("error", (err: Error) => {
    try { ws.send(JSON.stringify({ type: "error", message: `Socket error: ${err.message}` })); } catch {}
    try { ws.close(); } catch {}
  });

  unix.on("close", () => {
    try { ws.send(JSON.stringify({ type: "info", message: "Agent disconnected" })); } catch {}
    try { ws.close(); } catch {}
  });
}

// ── Server ────────────────────────────────────────────────────────────

const server = Bun.serve({
  port: PORT,
  fetch(req, server) {
    const url = new URL(req.url);

    // WebSocket upgrade
    if (url.pathname === "/ws") {
      if (server.upgrade(req)) return undefined;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    // API routes
    if (url.pathname === "/api/requests") return handleRequests(url);
    if (url.pathname === "/api/stats") return handleStats();

    const sessionMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)$/);
    if (sessionMatch) return handleSession(sessionMatch[1]);

    const transcriptMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/transcript$/);
    if (transcriptMatch) return handleTranscript(transcriptMatch[1]);

    // Static
    if (url.pathname === "/" || url.pathname === "/index.html") return serveIndex();

    return new Response("Not found", { status: 404 });
  },
  websocket: {
    open(ws: any) { proxyWebSocket(ws); },
    message(ws: any, msg: any) {
      const unix = wsToUnix.get(ws);
      if (unix && typeof msg === "string" && msg.trim()) {
        unix.write(msg.trim() + "\n");
      }
    },
    close(ws: any) {
      const unix = wsToUnix.get(ws);
      if (unix) { unix.destroy(); wsToUnix.delete(ws); }
    },
  },
});

console.log(`  url:   http://localhost:${server.port}`);
const sock = findSocketPath();
console.log(`  chat:  ${sock ? "available (" + sock + ")" : "unavailable (no agent socket found)"}`);
