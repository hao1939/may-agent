/* eslint-disable @typescript-eslint/no-explicit-any */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { InterfaceBinding } from "@may-agent/control";
import { listRuntimeAgentDirectories, resolveRuntimeAgentDirectory } from "../loader/agent-discovery.js";
import { metricThresholdBreached } from "../../lib/metrics.js";
import { ChatPublicationConflict, readChatPublication } from "./read-model/chat-publication.js";
import type { SqliteDb } from "./read-model/state-db.js";

export const DASHBOARD_SESSION_ROW_LIMIT = 2_000;
// New heartbeat sessions carry source='heartbeat'. The remaining clauses are
// read-only compatibility for sessions persisted before typed classification.
export const HEARTBEAT_SESSION_PREDICATE = `(
  source = 'heartbeat'
  OR source LIKE 'workflow:%heartbeat%'
  OR task LIKE '[heartbeat]%'
  OR task LIKE 'You are %waking up for your heartbeat.%'
)`;

export type DaemonFrameSender = (frame: Record<string, unknown>) => Promise<{
  ok: boolean;
  error?: string;
  eventId?: number;
  eventType?: string;
  delivery?: "recorded" | "accepted";
  links?: unknown[];
}>;

export function createSessionAndAgentHandlers(options: {
  stateDir: string;
  agentsRoot: string;
  sharedRoot: string;
  projectsRoot: string;
  humanInterface: InterfaceBinding;
  getDb: () => SqliteDb;
  readProjects: () => Array<{
    path: string;
    project: { owner: string; field: (key: string) => string | null | undefined };
    updatedAt: number;
  }>;
  sendDaemonFrame: DaemonFrameSender;
  buildPublishFrame: (
    type: string,
    data: Record<string, unknown>,
    options?: {
      target?: { appId?: string; taskId?: string; sessionId?: string };
      idempotencyKey?: string;
    },
  ) => Record<string, unknown>;
  json: (data: unknown, status?: number) => Response;
}) {
  const {
    stateDir,
    agentsRoot,
    sharedRoot,
    projectsRoot,
    humanInterface,
    getDb,
    readProjects,
    sendDaemonFrame,
    buildPublishFrame,
    json,
  } = options;

  function handleSession(sessionId: string): Response {
    const session = getDb().prepare("SELECT * FROM sessions WHERE sessionId = ?").get(sessionId);
    if (!session) return json({ error: "Session not found" }, 404);
    const children = getDb()
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
    const path = join(stateDir, "sessions", sessionId, "session.jsonl");
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

  function handleAgentActivity(): Response {
    const now = Date.now();
    const dayStart = now - 86400000;
    const rows = getDb()
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
        sessionCompletionRate: r.sessionsToday > 0 ? Math.round((r.doneCount / r.sessionsToday) * 100) : 0,
        status,
      };
    });

    return json({ agents });
  }

  function handleAgentTimeline(url: URL): Response {
    const requestedHours = parseInt(url.searchParams.get("hours") || "24", 10);
    const hours = Number.isFinite(requestedHours) ? Math.max(1, Math.min(requestedHours, 168)) : 24;
    const since = Date.now() - hours * 60 * 60 * 1000;

    const candidates = getDb()
      .prepare(
        `SELECT sessionId, agent, startedAt, endedAt, status
         FROM sessions
         WHERE startedAt > ?
         ORDER BY startedAt DESC
         LIMIT ?`,
      )
      .all(since, DASHBOARD_SESSION_ROW_LIMIT + 1) as Array<{
      sessionId: string;
      agent: string;
      startedAt: number;
      endedAt: number | null;
      status: string;
    }>;
    const truncated = candidates.length > DASHBOARD_SESSION_ROW_LIMIT;
    const rows = candidates
      .slice(0, DASHBOARD_SESSION_ROW_LIMIT)
      .sort((a, b) => a.agent.localeCompare(b.agent) || a.startedAt - b.startedAt);

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
    return json({
      agents,
      since,
      now: Date.now(),
      rowsReturned: rows.length,
      rowLimit: DASHBOARD_SESSION_ROW_LIMIT,
      truncated,
    });
  }

  function handleSystemHealth(): Response {
    const now = Date.now();
    const todayStart = now - 86400000;
    const yesterdayStart = todayStart - 86400000;
    const db = getDb();

    const todayStats = db
      .prepare(
        `SELECT COUNT(*) as total,
                SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done,
                SUM(CASE WHEN status='error' THEN 1 ELSE 0 END) as errors,
                AVG(CASE WHEN endedAt IS NOT NULL THEN endedAt - startedAt END) as avgDuration
         FROM sessions WHERE startedAt > ?`,
      )
      .get(todayStart) as { total: number; done: number; errors: number; avgDuration: number | null };

    const yesterdayStats = db
      .prepare(
        `SELECT COUNT(*) as total,
                SUM(CASE WHEN status='error' THEN 1 ELSE 0 END) as errors
         FROM sessions WHERE startedAt > ? AND startedAt <= ?`,
      )
      .get(yesterdayStart, todayStart) as { total: number; errors: number };

    const activeAgents = db
      .prepare(`SELECT COUNT(DISTINCT agent) as cnt FROM sessions WHERE startedAt > ?`)
      .get(now - 2 * 60 * 60 * 1000) as { cnt: number };

    const todayErrorRate = todayStats.total > 0 ? Math.round((todayStats.errors / todayStats.total) * 100) : 0;
    const yesterdayErrorRate =
      yesterdayStats.total > 0 ? Math.round((yesterdayStats.errors / yesterdayStats.total) * 100) : 0;

    return json({
      sessionsToday: todayStats.total,
      sessionCompletionRate: todayStats.total > 0 ? Math.round((todayStats.done / todayStats.total) * 100) : 0,
      activeAgents: activeAgents.cnt,
      avgDurationMs: todayStats.avgDuration ? Math.round(todayStats.avgDuration) : null,
      errorRateToday: todayErrorRate,
      errorRateYesterday: yesterdayErrorRate,
      errorTrend: todayErrorRate - yesterdayErrorRate,
    });
  }

  function handleAgentDetail(agentName: string): Response {
    const db = getDb();
    const recentSessions = (
      db
        .prepare(
          `SELECT sessionId, task, status, startedAt, endedAt, opCount, outcome
         FROM sessions WHERE agent = ? ORDER BY startedAt DESC LIMIT 50`,
        )
        .all(agentName) as Array<{
        sessionId: string;
        task: string | null;
        status: string;
        startedAt: number;
        endedAt: number | null;
        opCount: number | null;
        outcome: string | null;
      }>
    ).map((row) => ({
      id: row.sessionId,
      task: row.task?.slice(0, 120),
      status: row.status,
      startedAt: row.startedAt,
      duration: row.endedAt ? Math.round((row.endedAt - row.startedAt) / 1000) : null,
      opCount: row.opCount,
      outcome: row.outcome?.slice(0, 100),
    }));

    const since = Date.now() - 7 * 86400000;

    const delegatesTo = db
      .prepare(
        `SELECT c.agent, COUNT(*) as count
         FROM sessions p JOIN sessions c ON c.parentSessionId = p.sessionId
         WHERE p.agent = ? AND p.startedAt > ?
         GROUP BY c.agent ORDER BY count DESC`,
      )
      .all(agentName, since) as Array<{ agent: string; count: number }>;

    const delegatedFrom = db
      .prepare(
        `SELECT p.agent, COUNT(*) as count
         FROM sessions c JOIN sessions p ON c.parentSessionId = p.sessionId
         WHERE c.agent = ? AND c.startedAt > ?
         GROUP BY p.agent ORDER BY count DESC`,
      )
      .all(agentName, since) as Array<{ agent: string; count: number }>;

    const wsDir = join(stateDir, "..", "agents", agentName, "workspace");
    let workspaceFiles: string[] = [];
    if (existsSync(wsDir)) {
      workspaceFiles = readdirSync(wsDir)
        .filter((f) => !f.startsWith("."))
        .slice(0, 50);
    }

    return json({
      recentSessions,
      delegationMap: { delegatesTo, delegatedFrom },
      workspaceFiles,
    });
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
    const result = await sendDaemonFrame(
      buildPublishFrame("session.steer.requested", { message: content, channel: "web-ui" }, { target: { sessionId } }),
    );
    if (!result.ok) return json({ error: result.error }, 503);
    return json({ ok: true, sessionId, deliveredAt: Date.now() });
  }

  function handleAgents(): Response {
    try {
      const db = getDb();
      const fourHourAgo = Date.now() - 4 * 60 * 60 * 1000;
      const dayAgo = Date.now() - 24 * 60 * 60 * 1000;

      const agents: Array<Record<string, unknown>> = [];
      const seenAgentNames = new Set<string>();

      for (const entry of listRuntimeAgentDirectories(agentsRoot, projectsRoot)) {
        let cfg: Record<string, any>;
        try {
          cfg = JSON.parse(readFileSync(join(entry.dir, "agent.json"), "utf8"));
        } catch {
          continue;
        }
        if (cfg.disabled) continue;
        const name = cfg.name || entry.name;
        if (seenAgentNames.has(name)) continue;
        seenAgentNames.add(name);
        agents.push({
          name,
          description: cfg.description || "",
          domain: cfg.domain || "",
          model: cfg.model || "",
          toolCount: Array.isArray(cfg.tools) ? cfg.tools.length : 0,
        });
      }

      for (const a of agents) {
        const name = a.name as string;

        const sess4h = db
          .prepare(
            `
          SELECT
            COUNT(*) as total,
            SUM(CASE WHEN ${HEARTBEAT_SESSION_PREDICATE} THEN 1 ELSE 0 END) as heartbeats,
            MAX(startedAt) as lastStart,
            SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors
          FROM sessions WHERE agent = ? AND startedAt >= ?
        `,
          )
          .get(name, fourHourAgo) as any;
        a.sessions4h = sess4h?.total ?? 0;
        a.heartbeats4h = sess4h?.heartbeats ?? 0;
        a.lastSessionAt = sess4h?.lastStart ?? null;
        a.errors4h = sess4h?.errors ?? 0;

        const sess24h =
          (db.prepare(`SELECT COUNT(*) as c FROM sessions WHERE agent = ? AND startedAt >= ?`).get(name, dayAgo) as any)
            ?.c ?? 0;
        a.sessions24h = sess24h;

        const mets = db
          .prepare(
            `
          SELECT id, current, threshold, alert_op FROM metrics WHERE owner = ?
        `,
          )
          .all(name) as Array<{
          id: string;
          current: number | null;
          threshold: number | null;
          alert_op: string | null;
        }>;
        a.metricCount = mets.length;
        a.metricBreached = mets.filter((m) => {
          if (m.threshold == null || m.current == null) return false;
          return metricThresholdBreached({ current: m.current, threshold: m.threshold, alert_op: m.alert_op });
        }).length;
      }

      const projByOwner: Record<string, { active: number; total: number }> = {};
      const hidden = new Set(["done", "complete", "closed", "waiting", "blocked", "paused"]);
      for (const { project } of readProjects()) {
        const owner = project.owner.replace(/^agent:/, "");
        const counts = (projByOwner[owner] ??= { active: 0, total: 0 });
        counts.total += 1;
        if (!hidden.has(project.field("status") ?? "unknown")) counts.active += 1;
      }
      for (const a of agents) {
        const counts = projByOwner[a.name as string] || { active: 0, total: 0 };
        a.projectsActive = counts.active;
        a.projectsTotal = counts.total;
      }

      agents.sort((a: any, b: any) => {
        const aTime = a.lastSessionAt || 0;
        const bTime = b.lastSessionAt || 0;
        return bTime - aTime || String(a.name).localeCompare(String(b.name));
      });
      return json(agents);
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  }

  function handleAgentAbout(agentName: string): Response {
    if (!agentName) return json({ error: "agent required" }, 400);
    const agentDir =
      resolveRuntimeAgentDirectory(agentsRoot, agentName, projectsRoot)?.dir ?? join(agentsRoot, agentName);
    if (!existsSync(agentDir)) return json({ error: "agent not found" }, 404);
    let agentJson: Record<string, any> | null = null;
    try {
      const cfgPath = join(agentDir, "agent.json");
      if (existsSync(cfgPath)) agentJson = JSON.parse(readFileSync(cfgPath, "utf-8"));
    } catch {
      /* skip */
    }

    const readFile = (path: string, displayName: string, source: string) => {
      if (!existsSync(path)) return null;
      try {
        const content = readFileSync(path, "utf-8");
        return {
          name: displayName,
          path: path.replace(stateDir + "/..", "").replace(/^\//, ""),
          content,
          bytes: content.length,
          source,
        };
      } catch {
        return null;
      }
    };

    const promptFiles: Array<Record<string, unknown>> = [];
    const otherFiles: Array<Record<string, unknown>> = [];

    if (agentJson && typeof agentJson.systemPrompt === "string") {
      promptFiles.push({
        name: "<inline systemPrompt>",
        path: `agents/${agentName}/agent.json#systemPrompt`,
        content: agentJson.systemPrompt,
        bytes: agentJson.systemPrompt.length,
        source: "agent.json",
      });
    } else {
      const sharedPath = join(sharedRoot, "common-sense.md");
      const sharedFile = readFile(sharedPath, "shared/common-sense.md", "manager.ts");
      if (sharedFile) promptFiles.push({ ...sharedFile, source: "shared (every agent)" });
      const agentsMd = readFile(join(agentDir, "AGENTS.md"), "AGENTS.md", "identity");
      if (agentsMd) promptFiles.push({ ...agentsMd, source: "agent identity (this agent)" });
    }

    const otherCandidates = ["DOMAIN.md", "heartbeat.md", "context.md", "TOOLS.md", "LESSONS.md"];
    for (const f of otherCandidates) {
      const file = readFile(join(agentDir, f), f, "on-disk only");
      if (file) otherFiles.push(file);
    }

    return json({ name: agentName, agentJson, promptFiles, otherFiles });
  }

  function handleAgentDefaultSession(agentName: string, requestId?: string): Response {
    if (!agentName) return json({ error: "agent required" }, 400);
    if (requestId !== undefined && (!requestId || requestId.length > 256))
      return json({ error: "invalid requestId" }, 400);
    try {
      const db = getDb();
      const row = db
        .prepare(
          `
        SELECT sessionId, status, startedAt, kind, requestId, substr(task, 1, 200) as task
        FROM sessions
        WHERE agent = ?
          AND (kind = 'chat' OR (? IS NULL AND source IN ('telegram', 'web-ui', 'web', 'cli')))
          AND (? IS NULL OR requestId = ?)
        ORDER BY startedAt DESC
        LIMIT 1
      `,
        )
        .get(agentName, requestId ?? null, requestId ?? null, requestId ?? null) as
        | {
            sessionId: string;
            status: string;
            startedAt: number;
            kind: string | null;
            requestId: string | null;
            task: string;
          }
        | undefined;
      if (!row) return json({ agent: agentName, sessionId: null });
      return json({
        agent: agentName,
        sessionId: row.sessionId,
        status: row.status,
        startedAt: row.startedAt,
        kind: row.kind,
        requestId: row.requestId,
        task: row.task,
      });
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  }

  async function handleAgentMessage(req: Request, agentName: string, url?: URL): Promise<Response> {
    if (!agentName) return json({ error: "agent required" }, 400);
    let body: { content?: string; requestId?: string };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return json({ error: "invalid json" }, 400);
    }
    const content = (body.content ?? "").trim();
    if (!content) return json({ error: "content required" }, 400);
    if (
      body.requestId !== undefined &&
      (typeof body.requestId !== "string" || !body.requestId.trim() || body.requestId.length > 256)
    ) {
      return json({ error: "invalid requestId" }, 400);
    }
    const requestId = body.requestId?.trim();
    const forceNew = url?.searchParams.get("new") === "true";

    if (agentName === humanInterface.agent) {
      if (!humanInterface.appId) return json({ error: "No Conversation App is configured" }, 503);
      const result = await sendDaemonFrame(
        buildPublishFrame(
          "app.input.requested",
          {
            input: { kind: "message", data: { message: content, context: { forceNew } } },
            channel: "web-ui",
            conversationId: humanInterface.conversationId,
          },
          { target: { appId: humanInterface.appId } },
        ),
      );
      if (!result.ok) return json({ error: result.error }, 503);
      return json({ ok: true, agent: agentName, sessionId: null, deliveredAt: Date.now(), spawned: true });
    }

    if (requestId) {
      let saved;
      try {
        saved = readChatPublication(getDb(), { agent: agentName, content, requestId, forceNew });
      } catch (error) {
        return json(
          { error: error instanceof Error ? error.message : String(error) },
          error instanceof ChatPublicationConflict ? 409 : 500,
        );
      }
      if (saved) {
        if (!saved.accepted) {
          const result = await sendDaemonFrame({ type: "publish", event: saved.input });
          if (!result.ok) return json({ error: result.error }, 503);
        }
        return json({
          ok: true,
          agent: agentName,
          sessionId: saved.input.target?.sessionId ?? null,
          deliveredAt: Date.now(),
          spawned: saved.input.type === "chat.start.requested",
          requestId,
        });
      }
    }
    if (requestId) {
      const correlated = handleAgentDefaultSession(agentName, requestId);
      if (!correlated.ok) return correlated;
      if ((await correlated.json()).sessionId) return json({ error: "Original chat publication unavailable" }, 500);
    }
    if (!forceNew) {
      const resolveResp = handleAgentDefaultSession(agentName);
      if (!resolveResp.ok) return resolveResp;
      const resolved = (await resolveResp.json()) as { agent: string; sessionId: string | null };
      if (resolved.sessionId) {
        const result = await sendDaemonFrame(
          buildPublishFrame(
            "session.steer.requested",
            { message: content, channel: "web-ui" },
            { target: { sessionId: resolved.sessionId }, idempotencyKey: requestId },
          ),
        );
        if (!result.ok) return json({ error: result.error }, 503);
        return json({
          ok: true,
          agent: agentName,
          sessionId: resolved.sessionId,
          deliveredAt: Date.now(),
          spawned: false,
        });
      }
    }

    const result = await sendDaemonFrame(
      buildPublishFrame(
        "chat.start.requested",
        {
          agent: agentName,
          message: content,
          channel: "web-ui",
          forceNew,
          ...(requestId ? { requestId } : {}),
        },
        { idempotencyKey: requestId },
      ),
    );
    if (!result.ok) return json({ error: result.error }, 503);
    return json({
      ok: true,
      agent: agentName,
      sessionId: null,
      deliveredAt: Date.now(),
      spawned: true,
      ...(requestId ? { requestId } : {}),
    });
  }

  return {
    readSessionTranscript,
    handleSession,
    handleSessionEval,
    handleTranscript,
    handleRawLog,
    handleSessionCancel,
    handleSessionMessage,
    handleAgents,
    handleAgentActivity,
    handleAgentTimeline,
    handleSystemHealth,
    handleAgentDetail,
    handleAgentAbout,
    handleAgentDefaultSession,
    handleAgentMessage,
  };
}
