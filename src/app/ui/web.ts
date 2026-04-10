/**
 * may-agent Web UI — HTTP server for dashboard + chat.
 *
 * Can run standalone: bun src/app/ui/web.ts --state-dir .state --port 8080
 * Can be imported:    import { startWebUI } from "./ui/web.js"
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

declare const Bun: {
  serve(opts: {
    port: number;
    hostname?: string;
    fetch(req: Request, server: any): Response | undefined;
    websocket: { open(ws: any): void; message(ws: any, msg: any): void; close(ws: any): void };
  }): { port: number };
};
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { connect } from "node:net";
import { getDb } from "../../lib/requests.js";
import type { SqliteDb } from "../../lib/db.js";
import type { Socket } from "node:net";

// ── Public API ────────────────────────────────────────────────────────

export interface WebUIOptions {
  stateDir: string;
  port: number;
}

export function startWebUI(opts: WebUIOptions): { port: number } {
  const STATE_DIR = opts.stateDir;
  const PORT = opts.port;

  function _db(): SqliteDb {
    return getDb(STATE_DIR);
  }

  function findSocketPath(): string | null {
    const instancesDir = join(STATE_DIR, "instances");
    if (!existsSync(instancesDir)) return null;
    const candidates: Array<{ path: string; running: boolean }> = [];
    for (const name of readdirSync(instancesDir)) {
      const dir = join(instancesDir, name);
      try {
        for (const file of readdirSync(dir)) {
          if (file.endsWith(".sock")) {
            const sockPath = join(dir, file);
            if (!existsSync(sockPath)) continue;
            let running = false;
            try {
              const identity = JSON.parse(readFileSync(join(dir, "identity.json"), "utf-8"));
              running = identity.status === "running";
            } catch {}
            candidates.push({ path: sockPath, running });
          }
        }
      } catch {}
    }
    return candidates.find((c) => c.running)?.path ?? candidates[0]?.path ?? null;
  }

  // ── API handlers ──────────────────────────────────────────────────

  function handleRequests(url: URL): Response {
    const from = url.searchParams.get("from") || undefined;
    const status = url.searchParams.get("status") || undefined;
    const agent = url.searchParams.get("agent") || undefined;
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 200);
    const offset = parseInt(url.searchParams.get("offset") || "0", 10);
    let where = "1=1";
    const params: unknown[] = [];
    if (from) {
      where += " AND fromEntity = ?";
      params.push(from);
    }
    if (status) {
      where += " AND status = ?";
      params.push(status);
    }
    if (agent) {
      where += " AND toAgent = ?";
      params.push(agent);
    }
    const total = (
      _db()
        .prepare(`SELECT COUNT(*) as cnt FROM requests WHERE ${where}`)
        .get(...params) as any
    ).cnt;
    const rows = _db()
      .prepare(
        `SELECT r.*, s.outcome, s.agent as sessAgent FROM requests r
       LEFT JOIN sessions s ON r.sessionId = s.sessionId
       WHERE ${where} ORDER BY r.createdAt DESC LIMIT ? OFFSET ?`,
      )
      .all(...params, limit, offset);
    return json({ requests: rows, total, limit, offset });
  }

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

  function handleTranscript(sessionId: string): Response {
    let jsonlPath = join(STATE_DIR, "sessions", sessionId, "session.jsonl");
    if (!existsSync(jsonlPath)) jsonlPath = join(STATE_DIR, "sessions", "history", sessionId, "session.jsonl");
    if (!existsSync(jsonlPath)) return json({ error: "Transcript not found" }, 404);
    const lines = readFileSync(jsonlPath, "utf-8").split("\n").filter(Boolean);
    const messages: unknown[] = [];
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.role === "user") {
          const text = Array.isArray(entry.content)
            ? entry.content.map((b: any) => b.text || "").join("")
            : typeof entry.content === "string"
              ? entry.content
              : "";
          // Skip session context injection (buildSessionContext output)
          if (text && !text.startsWith("# Session Context")) messages.push({ role: "user", text });
        } else if (entry.role === "assistant") {
          const blocks = Array.isArray(entry.content) ? entry.content : [];
          const text = blocks
            .filter((b: any) => b.type === "text")
            .map((b: any) => b.text)
            .join("");
          const toolCalls = blocks
            .filter((b: any) => b.type === "tool_use")
            .map((b: any) => ({ id: b.id, tool: b.name, args: b.input }));
          if (text || toolCalls.length) messages.push({ role: "assistant", text, toolCalls });
        } else if (entry.role === "tool_result") {
          const content = Array.isArray(entry.content)
            ? entry.content
                .map((b: any) => b.text || "")
                .join("")
                .slice(0, 2000)
            : typeof entry.content === "string"
              ? entry.content.slice(0, 2000)
              : "";
          messages.push({ role: "tool_result", toolCallId: entry.toolCallId, content, isError: entry.isError });
        }
      } catch {}
    }
    return json({ sessionId, messageCount: messages.length, messages });
  }

  function handleDigest(url: URL): Response {
    const digestDir = join(STATE_DIR, "..", "agents", "shared", "daily-digests");
    if (!existsSync(digestDir)) return json({ digest: null, date: null, available: [] });
    const files = readdirSync(digestDir)
      .filter((f) => f.endsWith(".md"))
      .sort()
      .reverse();
    if (files.length === 0) return json({ digest: null, date: null, available: [] });
    const available = files.map((f) => f.replace(".md", ""));
    const reqDate = url.searchParams.get("date");
    const target = reqDate && available.includes(reqDate) ? reqDate + ".md" : files[0];
    const content = readFileSync(join(digestDir, target), "utf-8");
    return json({ digest: content, date: target.replace(".md", ""), available });
  }

  function handleBenchmarks(url: URL): Response {
    try {
      const agentFilter = url.searchParams.get("agent") || undefined;
      const batchId = url.searchParams.get("batch") || undefined;

      // Detailed batch view
      if (batchId) {
        const runs = _db()
          .prepare(
            `SELECT r.id, r.scenario, r.passed, r.duration_ms, r.timestamp, r.categories, r.tags, r.tier, r.prompt_hash, r.model FROM gym_runs r WHERE r.batch_id = ? ORDER BY r.scenario`,
          )
          .all(batchId) as any[];
        const checks: Record<number, any[]> = {};
        for (const run of runs) {
          checks[run.id] = _db()
            .prepare("SELECT check_name, passed, detail FROM gym_checks WHERE run_id = ?")
            .all(run.id) as any[];
        }
        return json({ batch_id: batchId, runs, checks });
      }

      const where = agentFilter ? "WHERE r.agent_name = ?" : "";
      const params = agentFilter ? [agentFilter] : [];

      // Batch listing
      const batchWhere = agentFilter
        ? "WHERE r.agent_name = ? AND r.batch_id IS NOT NULL"
        : "WHERE r.batch_id IS NOT NULL";
      const batches = _db()
        .prepare(
          `SELECT r.batch_id, r.agent_name, r.run_tag, r.prompt_hash, r.model, r.framework_sha, COUNT(*) as total, SUM(r.passed) as passed, MIN(r.timestamp) as started_at FROM gym_runs r ${batchWhere} GROUP BY r.batch_id ORDER BY started_at DESC LIMIT 50`,
        )
        .all(...params) as any[];

      // Per-agent per-scenario summary
      const summary = _db()
        .prepare(
          `
        SELECT r.agent_name as agent, r.scenario, COUNT(*) as runs, SUM(r.passed) as passes,
          MAX(r.timestamp) as lastRun, AVG(r.duration_ms) as avgMs, r.categories, r.tags, r.tier
        FROM gym_runs r ${where} GROUP BY r.agent_name, r.scenario ORDER BY r.agent_name, r.scenario
      `,
        )
        .all(...params) as any[];
      const agents: Record<string, any[]> = {};
      for (const row of summary) {
        if (!agents[row.agent]) agents[row.agent] = [];
        agents[row.agent].push({
          scenario: row.scenario,
          runs: row.runs,
          passes: row.passes,
          passRate: row.runs > 0 ? row.passes / row.runs : 0,
          lastRun: row.lastRun,
          avgMs: row.avgMs ? Math.round(row.avgMs) : null,
          categories: row.categories ? JSON.parse(row.categories) : [],
          tags: row.tags ? JSON.parse(row.tags) : [],
          tier: row.tier,
        });
      }
      const checkDetails: Record<string, any[]> = {};
      if (agentFilter) {
        const latestRuns = _db()
          .prepare(
            `SELECT r.id, r.scenario FROM gym_runs r WHERE r.agent_name = ? AND r.id = (SELECT MAX(r2.id) FROM gym_runs r2 WHERE r2.agent_name = r.agent_name AND r2.scenario = r.scenario) ORDER BY r.scenario`,
          )
          .all(agentFilter) as any[];
        for (const run of latestRuns) {
          checkDetails[run.scenario] = _db()
            .prepare("SELECT check_name, passed, detail FROM gym_checks WHERE run_id = ?")
            .all(run.id) as any[];
        }
      }
      const totalRuns = _db().prepare("SELECT COUNT(*) as cnt FROM gym_runs").get() as any;
      return json({
        agents,
        scenarios: [...new Set(summary.map((r) => r.scenario))].sort(),
        runs: totalRuns?.cnt || 0,
        checkDetails,
        batches,
      });
    } catch (err) {
      return json({ error: String(err), agents: {}, scenarios: [], runs: 0, batches: [] });
    }
  }

  function handleBenchmarkPrompts(url: URL): Response {
    try {
      const hash = url.searchParams.get("hash");
      const diffWith = url.searchParams.get("diff");
      if (hash && diffWith) {
        const a = _db()
          .prepare("SELECT prompt_text, agent_name, model FROM gym_prompts WHERE prompt_hash = ?")
          .get(hash) as any;
        const b = _db()
          .prepare("SELECT prompt_text, agent_name, model FROM gym_prompts WHERE prompt_hash = ?")
          .get(diffWith) as any;
        if (!a || !b) return json({ error: "Prompt not found" }, 404);
        return json({
          a: { hash, text: a.prompt_text, agent: a.agent_name, model: a.model },
          b: { hash: diffWith, text: b.prompt_text, agent: b.agent_name, model: b.model },
        });
      }
      if (hash) {
        const row = _db().prepare("SELECT * FROM gym_prompts WHERE prompt_hash = ?").get(hash) as any;
        if (!row) return json({ error: "Prompt not found" }, 404);
        return json(row);
      }
      const rows = _db()
        .prepare(
          `SELECT p.prompt_hash, p.agent_name, p.model, p.framework_sha, p.created_at, (SELECT COUNT(*) FROM gym_runs r WHERE r.prompt_hash = p.prompt_hash) as run_count FROM gym_prompts p ORDER BY p.created_at DESC`,
        )
        .all() as any[];
      return json({ prompts: rows });
    } catch (err) {
      return json({ error: String(err) });
    }
  }

  function handleBenchmarkCompare(url: URL): Response {
    try {
      const batchA = url.searchParams.get("a");
      const batchB = url.searchParams.get("b");
      if (!batchA || !batchB) return json({ error: "Need ?a=<batch_id>&b=<batch_id>" }, 400);
      const runsA = _db()
        .prepare("SELECT scenario, passed, duration_ms, prompt_hash FROM gym_runs WHERE batch_id = ?")
        .all(batchA) as any[];
      const runsB = _db()
        .prepare("SELECT scenario, passed, duration_ms, prompt_hash FROM gym_runs WHERE batch_id = ?")
        .all(batchB) as any[];
      const mapA: Record<string, any> = {};
      for (const r of runsA) mapA[r.scenario] = r;
      const mapB: Record<string, any> = {};
      for (const r of runsB) mapB[r.scenario] = r;
      const allScenarios = [...new Set([...Object.keys(mapA), ...Object.keys(mapB)])].sort();
      const regressions: any[] = [],
        improvements: any[] = [],
        unchanged: any[] = [];
      for (const s of allScenarios) {
        const a = mapA[s],
          b = mapB[s];
        const passedA = a ? !!a.passed : null,
          passedB = b ? !!b.passed : null;
        const entry = { scenario: s, a: passedA, b: passedB };
        if (passedA === true && passedB === false) regressions.push(entry);
        else if (passedA === false && passedB === true) improvements.push(entry);
        else unchanged.push(entry);
      }
      return json({
        batchA,
        batchB,
        regressions,
        improvements,
        unchanged,
        promptHashA: runsA[0]?.prompt_hash || null,
        promptHashB: runsB[0]?.prompt_hash || null,
      });
    } catch (err) {
      return json({ error: String(err) });
    }
  }

  function handleStats(): Response {
    const now = Date.now();
    const day = now - 86400000;
    const week = now - 7 * 86400000;
    const sess24h = _db()
      .prepare(
        `SELECT agent, COUNT(*) as cnt, SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done, SUM(CASE WHEN status='error' THEN 1 ELSE 0 END) as errors, AVG(endedAt - startedAt) as avgMs FROM sessions WHERE startedAt > ? GROUP BY agent ORDER BY cnt DESC`,
      )
      .all(day);
    const req24h = _db()
      .prepare(
        `SELECT fromEntity, COUNT(*) as cnt, SUM(CASE WHEN status='COMPLETED' THEN 1 ELSE 0 END) as completed FROM requests WHERE createdAt > ? GROUP BY fromEntity ORDER BY cnt DESC`,
      )
      .all(day);
    const totalSess7d = (_db().prepare("SELECT COUNT(*) as cnt FROM sessions WHERE startedAt > ?").get(week) as any)
      .cnt;
    const humanReq7d = (
      _db().prepare("SELECT COUNT(*) as cnt FROM requests WHERE fromEntity='human' AND createdAt > ?").get(week) as any
    ).cnt;
    return json({
      last24h: { sessions: sess24h, requests: req24h },
      last7d: { totalSessions: totalSess7d, humanRequests: humanReq7d },
      socketAvailable: !!findSocketPath(),
    });
  }

  // ── Agent Activity API ──────────────────────────────────────────────

  function handleAgentActivity(): Response {
    const now = Date.now();
    const dayStart = now - 86400000;
    const rows = _db()
      .prepare(
        `SELECT agent,
                MAX(startedAt) as lastSession,
                COUNT(*) as sessionsToday,
                SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as doneCount,
                SUM(CASE WHEN status='error' THEN 1 ELSE 0 END) as errorCount
         FROM sessions
         WHERE startedAt > ?
         GROUP BY agent
         ORDER BY lastSession DESC`,
      )
      .all(dayStart) as Array<{
      agent: string;
      lastSession: number;
      sessionsToday: number;
      doneCount: number;
      errorCount: number;
    }>;

    const agents = rows.map((r) => {
      const elapsed = now - r.lastSession;
      let status: "active" | "idle" | "inactive";
      if (elapsed < 30 * 60 * 1000) status = "active";
      else if (elapsed < 2 * 60 * 60 * 1000) status = "idle";
      else status = "inactive";

      return {
        name: r.agent,
        lastSession: r.lastSession,
        sessionsToday: r.sessionsToday,
        successRate: r.sessionsToday > 0 ? Math.round((r.doneCount / r.sessionsToday) * 100) : 0,
        status,
      };
    });

    return json({ agents });
  }

  function handleAgentTimeline(url: URL): Response {
    const hours = Math.min(parseInt(url.searchParams.get("hours") || "24", 10), 168);
    const since = Date.now() - hours * 60 * 60 * 1000;

    const rows = _db()
      .prepare(
        `SELECT sessionId, agent, startedAt, endedAt, status
         FROM sessions
         WHERE startedAt > ?
         ORDER BY agent, startedAt ASC`,
      )
      .all(since) as Array<{
      sessionId: string;
      agent: string;
      startedAt: number;
      endedAt: number | null;
      status: string;
    }>;

    const agentMap: Record<string, Array<{ id: string; start: number; end: number | null; status: string }>> = {};
    for (const r of rows) {
      if (!agentMap[r.agent]) agentMap[r.agent] = [];
      agentMap[r.agent].push({
        id: r.sessionId,
        start: r.startedAt,
        end: r.endedAt,
        status: r.status,
      });
    }

    const agents = Object.entries(agentMap).map(([name, sessions]) => ({ name, sessions }));
    return json({ agents, since, now: Date.now() });
  }

  function handleSystemHealth(): Response {
    const now = Date.now();
    const todayStart = now - 86400000;
    const yesterdayStart = todayStart - 86400000;

    const todayStats = _db()
      .prepare(
        `SELECT COUNT(*) as total,
                SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done,
                SUM(CASE WHEN status='error' THEN 1 ELSE 0 END) as errors,
                AVG(CASE WHEN endedAt IS NOT NULL THEN endedAt - startedAt END) as avgDuration
         FROM sessions WHERE startedAt > ?`,
      )
      .get(todayStart) as { total: number; done: number; errors: number; avgDuration: number | null };

    const yesterdayStats = _db()
      .prepare(
        `SELECT COUNT(*) as total,
                SUM(CASE WHEN status='error' THEN 1 ELSE 0 END) as errors
         FROM sessions WHERE startedAt > ? AND startedAt <= ?`,
      )
      .get(yesterdayStart, todayStart) as { total: number; errors: number };

    const activeAgents = _db()
      .prepare(
        `SELECT COUNT(DISTINCT agent) as cnt FROM sessions WHERE startedAt > ?`,
      )
      .get(now - 2 * 60 * 60 * 1000) as { cnt: number };

    const todayErrorRate = todayStats.total > 0 ? Math.round((todayStats.errors / todayStats.total) * 100) : 0;
    const yesterdayErrorRate = yesterdayStats.total > 0 ? Math.round((yesterdayStats.errors / yesterdayStats.total) * 100) : 0;

    return json({
      sessionsToday: todayStats.total,
      successRate: todayStats.total > 0 ? Math.round((todayStats.done / todayStats.total) * 100) : 0,
      activeAgents: activeAgents.cnt,
      avgDurationMs: todayStats.avgDuration ? Math.round(todayStats.avgDuration) : null,
      errorRateToday: todayErrorRate,
      errorRateYesterday: yesterdayErrorRate,
      errorTrend: todayErrorRate - yesterdayErrorRate,
    });
  }

  // ── Knowledge API ──────────────────────────────────────────────────

  // ── Browse API: generic file/directory browser for knowledge base ──
  function handleBrowse(url: URL): Response {
    const relPath = url.searchParams.get("path") ?? "";
    const sharedDir = join(STATE_DIR, "..", "agents", "shared");

    // Security: only allow browsing under agents/shared/
    const absPath = join(sharedDir, relPath);
    if (!absPath.startsWith(sharedDir)) return json({ error: "Access denied" }, 403);

    if (!existsSync(absPath)) return json({ error: "Not found" }, 404);

    const stat = statSync(absPath);
    if (stat.isDirectory()) {
      // List directory contents
      const entries: Array<{ name: string; type: "dir" | "file"; size?: number }> = [];
      for (const name of readdirSync(absPath).sort()) {
        const childPath = join(absPath, name);
        try {
          const childStat = statSync(childPath);
          if (childStat.isDirectory()) {
            entries.push({ name, type: "dir" });
          } else if (name.endsWith(".md") || name.endsWith(".ts") || name.endsWith(".json")) {
            entries.push({ name, type: "file", size: childStat.size });
          }
        } catch {
          /* skip unreadable */
        }
      }
      return json({ path: relPath, type: "dir", entries });
    } else {
      // Serve file content
      const content = readFileSync(absPath, "utf-8");
      return json({ path: relPath, type: "file", content });
    }
  }

  function serveIndex(): Response {
    const candidates = [
      join(dirname(new URL(import.meta.url).pathname), "web-static", "index.html"),
      "/usr/local/share/may-agent-web/web-static/index.html",
      join(STATE_DIR, "..", "src", "app", "ui", "web-static", "index.html"),
    ];
    for (const p of candidates) {
      if (existsSync(p))
        return new Response(readFileSync(p, "utf-8"), { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }
    return new Response("index.html not found", { status: 404 });
  }

  function json(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  // ── WebSocket proxy ─────────────────────────────────────────────────

  const wsToUnix = new Map<any, Socket>();

  function proxyWebSocket(ws: any): void {
    const socketPath = findSocketPath();
    if (!socketPath) {
      ws.send(JSON.stringify({ type: "error", message: "Agent socket not found" }));
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
          // Skip subscribe ack responses
          if (event.type === "ok" && event.command === "subscribe") continue;
          ws.send(line);
        } catch {
          try {
            ws.send(line);
          } catch {}
        }
      }
    });
    unix.on("error", (err: Error) => {
      try {
        ws.send(JSON.stringify({ type: "error", message: `Socket error: ${err.message}` }));
      } catch {}
      try {
        ws.close();
      } catch {}
    });
    unix.on("close", () => {
      try {
        ws.send(JSON.stringify({ type: "info", message: "Agent disconnected" }));
      } catch {}
      try {
        ws.close();
      } catch {}
    });
  }

  // ── Server ──────────────────────────────────────────────────────────

  const server = Bun.serve({
    port: PORT,
    hostname: "0.0.0.0",
    fetch(req, server) {
      const url = new URL(req.url);
      if (url.pathname === "/ws") {
        if (server.upgrade(req)) return undefined;
        return new Response("WebSocket upgrade failed", { status: 400 });
      }
      if (url.pathname === "/api/requests") return handleRequests(url);
      if (url.pathname === "/api/stats") return handleStats();
      if (url.pathname === "/api/agents/activity") return handleAgentActivity();
      if (url.pathname === "/api/agents/timeline") return handleAgentTimeline(url);
      if (url.pathname === "/api/agents/health") return handleSystemHealth();
      if (url.pathname === "/api/digest") return handleDigest(url);
      if (url.pathname === "/api/benchmarks") return handleBenchmarks(url);
      if (url.pathname === "/api/benchmarks/prompts") return handleBenchmarkPrompts(url);
      if (url.pathname === "/api/benchmarks/compare") return handleBenchmarkCompare(url);
      if (url.pathname === "/api/browse") return handleBrowse(url);
      const sessionMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)$/);
      if (sessionMatch) return handleSession(sessionMatch[1]);
      const transcriptMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/transcript$/);
      if (transcriptMatch) return handleTranscript(transcriptMatch[1]);
      if (url.pathname === "/" || url.pathname === "/index.html") return serveIndex();
      return new Response("Not found", { status: 404 });
    },
    websocket: {
      open(ws: any) {
        proxyWebSocket(ws);
      },
      message(ws: any, msg: any) {
        const unix = wsToUnix.get(ws);
        if (unix && typeof msg === "string" && msg.trim()) unix.write(msg.trim() + "\n");
      },
      close(ws: any) {
        const unix = wsToUnix.get(ws);
        if (unix) {
          unix.destroy();
          wsToUnix.delete(ws);
        }
      },
    },
  });

  return { port: server.port };
}

// ── Standalone mode ───────────────────────────────────────────────────

if (process.argv.includes("--state-dir")) {
  const args = process.argv.slice(2);
  // When run as compiled binary, argv is [binary, --state-dir, path, ...]
  // When run via bun, argv is [bun, web.ts, --state-dir, path, ...]
  // getArg works for both since it searches the full argv.
  const getArg = (name: string, fallback: string) => {
    const idx = args.indexOf(name);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
  };
  const stateDir = resolve(getArg("--state-dir", ".state"));
  const port = parseInt(getArg("--port", "8080"), 10);
  if (!existsSync(stateDir)) {
    console.error(`State directory not found: ${stateDir}`);
    process.exit(1);
  }
  console.log(`may-agent web UI\n  state: ${stateDir}\n  port:  ${port}`);
  const { port: actualPort } = startWebUI({ stateDir, port });
  console.log(`  url:   http://localhost:${actualPort}`);
}
