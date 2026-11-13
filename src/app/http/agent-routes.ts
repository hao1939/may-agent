/* eslint-disable @typescript-eslint/no-explicit-any */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { InterfaceBinding } from "@may-agent/control";
import { metricThresholdBreached } from "../../lib/metrics.js";
import { listRuntimeAgentDirectories, resolveRuntimeAgentDirectory } from "../loader/agent-discovery.js";
import { ChatPublicationConflict, readChatPublication } from "./read-model/chat-publication.js";
import type { SqliteDb } from "./read-model/state-db.js";

export function createAgentRouteHandlers(options: {
  stateDir: string;
  agentsRoot: string;
  sharedRoot: string;
  projectsRoot: string;
  humanInterface: InterfaceBinding;
  getDb: () => SqliteDb;
  json: (data: unknown, status?: number) => Response;
  readProjects: () => Array<{ project: { owner: string; field: (key: string) => string | null | undefined } }>;
  sendDaemonFrame: (frame: Record<string, unknown>) => Promise<{ ok: boolean; error?: string }>;
  buildPublishFrame: (
    type: string,
    data: Record<string, unknown>,
    options?: {
      target?: { appId?: string; taskId?: string; sessionId?: string };
      idempotencyKey?: string;
    },
  ) => Record<string, unknown>;
}) {
  const {
    stateDir: STATE_DIR,
    agentsRoot: AGENTS_ROOT,
    sharedRoot: SHARED_ROOT,
    projectsRoot: PROJECTS_ROOT,
    humanInterface,
    getDb: _db,
    json,
    readProjects,
    sendDaemonFrame,
    buildPublishFrame,
  } = options;

  /**
   * GET /api/agents — list all configured agents with rollups for the
   * Agents tab card grid. One row per agent.
   */
  function handleAgents(): Response {
    try {
      const db = _db();
      const fourHourAgo = Date.now() - 4 * 60 * 60 * 1000;
      const dayAgo = Date.now() - 24 * 60 * 60 * 1000;

      // 1. Discover agents from agents/ filesystem AND project-local agents (source of truth: agent.json).
      const agents: Array<Record<string, unknown>> = [];
      const seenAgentNames = new Set<string>();

      for (const entry of listRuntimeAgentDirectories(AGENTS_ROOT, PROJECTS_ROOT)) {
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

      // 2. Per-agent session/metric rollups (single query each, indexed on agent).
      for (const a of agents) {
        const name = a.name as string;

        // Sessions in 4h.
        const sess4h = db
          .prepare(
            `
          SELECT
            COUNT(*) as total,
            MAX(startedAt) as lastStart,
            SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors
          FROM sessions WHERE agent = ? AND startedAt >= ?
        `,
          )
          .get(name, fourHourAgo) as any;
        a.sessions4h = sess4h?.total ?? 0;
        a.lastSessionAt = sess4h?.lastStart ?? null;
        a.errors4h = sess4h?.errors ?? 0;

        // Sessions in 24h (for context).
        const sess24h =
          (db.prepare(`SELECT COUNT(*) as c FROM sessions WHERE agent = ? AND startedAt >= ?`).get(name, dayAgo) as any)
            ?.c ?? 0;
        a.sessions24h = sess24h;

        // Owned metrics + breaches.
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

      // 3. Count the same metadata records shown by the Projects page.
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

      // Sort: active first (recent session), then alphabetic.
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

  /**
   * GET /api/agents/:name/about — returns what's actually in the agent's
   * head: the system-prompt-loaded files, separated from supplementary files
   * that exist on disk but aren't auto-injected.
   */
  function handleAgentAbout(agentName: string): Response {
    if (!agentName) return json({ error: "agent required" }, 400);
    const agentDir =
      resolveRuntimeAgentDirectory(AGENTS_ROOT, agentName, PROJECTS_ROOT)?.dir ?? join(AGENTS_ROOT, agentName);
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
          path: path.replace(STATE_DIR + "/..", "").replace(/^\//, ""),
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

    // explicit systemPrompt overrides file-loading.
    if (agentJson && typeof agentJson.systemPrompt === "string") {
      promptFiles.push({
        name: "<inline systemPrompt>",
        path: `agents/${agentName}/agent.json#systemPrompt`,
        content: agentJson.systemPrompt,
        bytes: agentJson.systemPrompt.length,
        source: "agent.json",
      });
    } else {
      // Standard prompt assembly: shared defaults, then role-specific identity.
      const sharedPath = join(SHARED_ROOT, "common-sense.md");
      const sharedFile = readFile(sharedPath, "shared/common-sense.md", "manager.ts");
      if (sharedFile) promptFiles.push({ ...sharedFile, source: "shared (every agent)" });
      const agentsMd = readFile(join(agentDir, "AGENTS.md"), "AGENTS.md", "identity");
      if (agentsMd) promptFiles.push({ ...agentsMd, source: "agent identity (this agent)" });
    }

    // Other on-disk files (NOT in prompt). Useful for context but not auto-loaded.
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
      const db = _db();
      // Resolve the agent's chat session — only human-initiated conversations,
      // not workflows, heartbeats, or fork-spawned task sessions.
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

  /**
   * Interface-agent input always uses the installation's Conversation binding.
   * Other agents keep direct session chat.
   */
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

    // Recover the immutable publication before resolving a mutable default.
    // Accepted steering stays confirmed even if that session has since ended.
    if (requestId) {
      let saved;
      try {
        saved = readChatPublication(_db(), { agent: agentName, content, requestId, forceNew });
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
    // A session alone cannot reconstruct the original publication after its
    // event has disappeared. Report missing evidence instead of starting again.
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

    // No prior session — request a create-or-bind chat start from the daemon.
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
    handleAgents,
    handleAgentAbout,
    handleAgentDefaultSession,
    handleAgentMessage,
  };
}
