#!/usr/bin/env bun
/**
 * may-agent HTTP adapter — API, static WebUI, and dashboard websocket.
 *
 * Can run standalone: bun src/app/http/server.ts --state-dir .state --port 8080
 * Imported by app modes; serves project UI from PROJECTS_ROOT.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

declare const Bun: {
  serve(opts: {
    port: number;
    hostname?: string;
    fetch(req: Request, server: any): Response | Promise<Response> | undefined;
    websocket: { open(ws: any): void; message(ws: any, msg: any): void; close(ws: any): void };
  }): { port: number };
};
import { appendFileSync, mkdirSync, readFileSync, existsSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, extname, join, relative, resolve } from "node:path";
import type { Duplex } from "node:stream";
import { connectSocketEndpoint, daemonSocketPath, sendDaemonEvent } from "../../../packages/control/src/client.js";
import { normalizeEventOwner } from "../../../packages/control/src/event-envelope.js";
import { createTerminalManager } from "@may-agent/terminal";
import { ensureTaskTreeState, loadProjectReadModel } from "@may-agent/sdk";
import { openStateDb, type SqliteDb } from "./read-model/state-db.js";
import { buildLoopTrace, type LoopTraceTarget } from "./read-model/loop-trace.js";
import { resolveRuntimeAgentDirectory } from "../loader/agent-discovery.js";

// ── Public API ────────────────────────────────────────────────────────

const LIVE_VITAL_METRIC_IDS = [
  "runtime.daemon-heartbeat-stale",
  "runtime.project-app-schedule-orphan-count-1h",
  "agent.heartbeat-dark-count-2h",
  "agent.config-invalid-count-1h",
  "handler.success-rate",
  "session.error-rate-6h",
  "session.first-turn-error-count-1h",
  "session.empty-assistant-stop-count-1h",
  "session.planner-timeout-rate-6h",
  "message.delivery-failed-count-1h",
  "escalation.pending-count",
  "capability.zombie-session-count",
  "runtime.stale-running-session-count",
  "eval.llm-coverage-lag-h",
  "project.iterations-24h",
];

export interface WebUIOptions {
  stateDir: string;
  port: number;
}

function platformUiContentTypeFor(path: string): string {
  switch (extname(path).toLowerCase()) {
    case ".html": return "text/html; charset=utf-8";
    case ".css": return "text/css; charset=utf-8";
    case ".js": return "application/javascript; charset=utf-8";
    case ".map": return "application/json; charset=utf-8";
    case ".json": return "application/json; charset=utf-8";
    case ".md": return "text/markdown; charset=utf-8";
    case ".txt": return "text/plain; charset=utf-8";
    case ".svg": return "image/svg+xml";
    case ".png": return "image/png";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".gif": return "image/gif";
    case ".webp": return "image/webp";
    case ".ico": return "image/x-icon";
    default: return "application/octet-stream";
  }
}

function servePlatformUiFile(path: string): Response {
  return new Response(readFileSync(path), {
    headers: {
      "Content-Type": platformUiContentTypeFor(path),
      "Cache-Control": "no-cache",
    },
  });
}

function isPlatformUiAppRoute(pathname: string): boolean {
  if (pathname === "/" || pathname === "/index.html") return true;
  if (/^\/(events|agents|metrics|learning|knowledge|terminal|sessions)(?:\/.*)?$/.test(pathname)) return true;
  if (pathname === "/projects") return true;
  if (!pathname.startsWith("/projects/")) return false;
  const parts = pathname.split("/").filter(Boolean).slice(1);
  const last = parts[parts.length - 1];
  const hasSurface = last === "tasks" || last === "functions";
  const idParts = hasSurface ? parts.slice(0, -1) : parts;
  if (!hasSurface && idParts.length === 2) {
    if (["ui", "kanban"].includes(idParts[1])) return false;
    if (/\.[a-z0-9]+$/i.test(idParts[1])) return false;
  }
  return idParts.length === 1 || idParts.length === 2;
}

export function servePlatformUiRequest(req: Request, projectsRoot: string): Response | null {
  const url = new URL(req.url);
  if (req.method !== "GET") return null;

  const platformUiDir = resolve(projectsRoot, "platform", "ui");
  if (isPlatformUiAppRoute(url.pathname)) {
    const indexPath = resolve(platformUiDir, "index.html");
    return existsSync(indexPath) && statSync(indexPath).isFile() ? servePlatformUiFile(indexPath) : null;
  }

  // Top-level platform UI assets: index.html uses relative paths like
  // `styles.css`, `app.js`, `pages/projects.js`. Map those to
  // <PROJECTS_ROOT>/platform/ui/<path>. Restricted to known static
  // extensions so /api/foo never falls through to this branch.
  if (!/^\/([\w\-.]+\/)*[\w\-.]+\.(css|js|map|svg|png|jpg|jpeg|gif|webp|ico)$/.test(url.pathname)) {
    return null;
  }

  const assetPath = resolve(platformUiDir, url.pathname.replace(/^\//, ""));
  const rel = relative(platformUiDir, assetPath);
  const inside = rel === "" || (!rel.startsWith("..") && !rel.startsWith("/"));
  if (inside && existsSync(assetPath) && statSync(assetPath).isFile()) return servePlatformUiFile(assetPath);
  return null;
}

export function extractMarkdownSection(body: string, headings: string | string[]): string | null {
  const wanted = new Set((Array.isArray(headings) ? headings : [headings]).map((h) => h.trim().toLowerCase()));
  const lines = body.split(/\r?\n/);
  let start = -1;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^##\s+(.+?)\s*$/);
    if (!match) continue;
    const heading = match[1].trim().toLowerCase();
    const matched = [...wanted].some((name) => heading === name || heading.startsWith(`${name} `) || heading.startsWith(`${name} (`));
    if (matched) {
      start = i + 1;
      break;
    }
  }

  if (start === -1) return null;

  let end = lines.length;
  for (let i = start; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) {
      end = i;
      break;
    }
  }

  const section = lines.slice(start, end).join("\n").trim();
  return section || null;
}

export function normalizeProjectPathForCompare(path: string): string {
  const normalized = path
    .trim()
    .replace(/^\/app\/agents\/shared\/projects\//, "projects/")
    .replace(/^\/app\/shared\/projects\//, "projects/")
    .replace(/^agents\/shared\/projects\//, "projects/")
    .replace(/^shared\/projects\//, "projects/")
    .replace(/^\/app\/projects\//, "projects/")
    .replace(/^\.?\//, "")
    .replace(/^agents\//, "")
    .replace(/\/project\.md$/, "")
    .replace(/\/$/, "");
  const projectsIdx = normalized.indexOf("projects/");
  if (projectsIdx >= 0) return normalized.slice(projectsIdx);
  return normalized;
}

export function projectPathsMatch(left: string | null | undefined, right: string | null | undefined): boolean {
  if (!left || !right) return false;
  return normalizeProjectPathForCompare(left) === normalizeProjectPathForCompare(right);
}

type ProjectTaskRecord = {
  id?: string;
  parent_id?: string | null;
  state?: string;
  status?: string;
  kind?: string;
  priority?: string;
  owner?: string;
  goal?: string;
  children?: string[];
  outputs?: string[];
  gates?: string[];
  gate_status?: string;
  blocker?: unknown;
  conflict_scope?: string[] | string;
  verification?: { verdict?: string; ts?: string };
  attempts?: unknown[];
  [key: string]: unknown;
};

type ProjectTaskTreeRecord = {
  updated_at?: string;
  active_task_id?: string | null;
  active_task_ids?: string[];
  max_concurrent?: number;
  root_task_id?: string;
  tasks?: Record<string, ProjectTaskRecord>;
};

const CANONICAL_TASK_STATES = new Set(["backlog", "active", "review", "done", "blocked"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function normalizeProjectTaskState(task: { state?: unknown; status?: unknown }): string {
  const raw = String(task.state ?? task.status ?? "backlog");
  if (raw === "accepted" || raw === "superseded" || raw === "cancelled") return "done";
  if (raw === "ready" || raw === "proposed" || raw === "decomposed") return "backlog";
  if (raw === "claimed_done" || raw === "rejected") return "review";
  if (CANONICAL_TASK_STATES.has(raw)) return raw;
  return "unknown";
}

export function buildProjectTasksReadModel(rawTree: unknown, opts: { path: string; treePath: string }) {
  const errors: string[] = [];
  if (!isRecord(rawTree)) {
    return {
      available: false,
      path: opts.path,
      treePath: opts.treePath,
      reason: "Task tree JSON must be an object.",
      errors: ["root: expected object"],
    };
  }

  const tree = rawTree as ProjectTaskTreeRecord;
  if (tree.tasks !== undefined && !isRecord(tree.tasks)) {
    errors.push("tasks: expected object keyed by task id");
  }
  const rawTasks = isRecord(tree.tasks) ? tree.tasks : {};
  if (tree.tasks === undefined) errors.push("tasks: missing task map");

  const tasks: Record<string, ProjectTaskRecord & { id: string; state: string; status: string }> = {};
  for (const [taskId, value] of Object.entries(rawTasks)) {
    if (!isRecord(value)) {
      errors.push(`tasks.${taskId}: expected object`);
      continue;
    }
    const task = value as ProjectTaskRecord;
    const id = typeof task.id === "string" && task.id ? task.id : taskId;
    if (task.id !== undefined && task.id !== taskId) {
      errors.push(`tasks.${taskId}.id: expected "${taskId}", got "${String(task.id)}"`);
    }
    if (task.parent_id !== undefined && task.parent_id !== null && typeof task.parent_id !== "string") {
      errors.push(`tasks.${taskId}.parent_id: expected string or null`);
    }
    if (task.children !== undefined && (!Array.isArray(task.children) || task.children.some((child) => typeof child !== "string"))) {
      errors.push(`tasks.${taskId}.children: expected string[]`);
    }
    const state = normalizeProjectTaskState(task);
    const children =
      Array.isArray(task.children) && task.children.every((child) => typeof child === "string")
        ? task.children
        : [];
    tasks[taskId] = {
      ...task,
      id,
      state,
      status: state,
      raw_state: task.state,
      raw_status: task.status,
      children,
    };
  }

  const rootTaskId = typeof tree.root_task_id === "string" && tree.root_task_id ? tree.root_task_id : "project";
  if (Object.keys(tasks).length > 0 && !tasks[rootTaskId]) {
    errors.push(`root_task_id: "${rootTaskId}" is not present in tasks`);
  }
  for (const task of Object.values(tasks)) {
    for (const childId of task.children ?? []) {
      if (!tasks[childId]) errors.push(`tasks.${task.id}.children: missing child "${childId}"`);
    }
  }

  if (errors.length > 0) {
    return {
      available: false,
      path: opts.path,
      treePath: opts.treePath,
      reason: "Task tree is malformed.",
      errors,
    };
  }

  const statusCounts: Record<string, number> = {};
  const kindCounts: Record<string, number> = {};
  for (const task of Object.values(tasks)) {
    const state = task.state ?? "unknown";
    const kind = task.kind ?? "work";
    statusCounts[state] = (statusCounts[state] ?? 0) + 1;
    kindCounts[kind] = (kindCounts[kind] ?? 0) + 1;
  }

  return {
    available: true,
    path: opts.path,
    treePath: opts.treePath,
    updated_at: tree.updated_at ?? null,
    root_task_id: rootTaskId,
    active_task_id: tree.active_task_id ?? null,
    active_task_ids: Array.isArray(tree.active_task_ids) ? tree.active_task_ids : [],
    max_concurrent: tree.max_concurrent ?? null,
    statusCounts,
    kindCounts,
    tasks,
  };
}

export function startWebUI(opts: WebUIOptions): { port: number } {
  const STATE_DIR = opts.stateDir;
  const PORT = opts.port;
  const PROJECT_ROOT = process.env.PROJECT_ROOT || resolve(STATE_DIR, "..");
  const AGENTS_ROOT = process.env.AGENTS_ROOT || resolve(PROJECT_ROOT, "agents");
  const SHARED_ROOT = process.env.SHARED_ROOT || resolve(PROJECT_ROOT, "shared");
  const PROJECTS_ROOT = process.env.PROJECTS_ROOT || resolve(PROJECT_ROOT, "projects");
  const DAEMON_INSTANCE = process.env.DAEMON_INSTANCE || process.env.INSTANCE || "default";
  const DAEMON_AGENT = process.env.DAEMON_AGENT || process.env.AGENT || "may";
  const terminalManager = createTerminalManager({ projectRoot: PROJECT_ROOT });

  function _db(): SqliteDb {
    return openStateDb(join(STATE_DIR, "may.db"));
  }

  function listConfiguredAgents(): string[] {
    try {
      return readdirSync(AGENTS_ROOT, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith(".") && !entry.name.startsWith("_") && entry.name !== "shared" && entry.name !== "gym")
        .map((entry) => {
          const configPath = join(AGENTS_ROOT, entry.name, "agent.json");
          if (!existsSync(configPath)) return null;
          try {
            const config = JSON.parse(readFileSync(configPath, "utf-8")) as { name?: string; disabled?: boolean; heartbeat?: boolean };
            if (config.disabled || config.heartbeat === false) return null;
            return config.name ?? entry.name;
          } catch {
            return entry.name;
          }
        })
        .filter((name): name is string => Boolean(name))
        .sort();
    } catch {
      return [];
    }
  }

  function listScheduledHeartbeatAgents(configuredAgents: string[]): string[] {
    const configured = new Set(configuredAgents);
    const agents = new Set<string>();
    const cronPath = join(AGENTS_ROOT, "may", "cron.json");
    try {
      const cron = JSON.parse(readFileSync(cronPath, "utf-8")) as Array<{
        name?: string;
        enabled?: boolean;
        agent?: string;
        handler?: string | { workflow?: string; agent?: string };
        handlerConfig?: { agent?: string; workflow?: string };
      }>;
      for (const entry of cron) {
        if (entry.enabled === false) continue;
        const workflowHandler = entry.handler && typeof entry.handler === "object" ? entry.handler : undefined;
        const isHeartbeat = entry.name === "heartbeat"
          || entry.name?.startsWith("heartbeat-")
          || entry.handler === "heartbeat"
          || entry.handlerConfig?.workflow?.includes("heartbeat")
          || workflowHandler?.workflow?.includes("heartbeat");
        if (!isHeartbeat) continue;
        const agent = (workflowHandler?.agent || entry.handlerConfig?.agent || entry.agent || "").trim();
        if (agent && configured.has(agent)) agents.add(agent);
      }
    } catch {
      // If cron metadata is unavailable, fall back to all configured agents.
      for (const agent of configuredAgents) agents.add(agent);
    }
    return [...agents].sort();
  }

  function parseEventData(data: unknown): Record<string, unknown> {
    if (!data || typeof data !== "string") return {};
    try {
      const parsed = JSON.parse(data);
      return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }

  function latestAlertJudgment(db: SqliteDb, alert: { alertId?: number; metricId?: string; createdAt?: number }): Record<string, unknown> | null {
    const row = db.prepare(
      `SELECT id, owner, timestamp, data
       FROM events
       WHERE event_type = 'metric.alert_judged'
         AND timestamp >= ?
         AND (
           json_extract(data, '$.alertId') = ?
           OR (
             json_extract(data, '$.alertId') IS NULL
             AND json_extract(data, '$.metricId') = ?
           )
         )
       ORDER BY timestamp DESC, id DESC
       LIMIT 1`,
    ).get(alert.createdAt ?? 0, alert.alertId ?? null, alert.metricId ?? null) as {
      id?: number;
      owner?: string | null;
      timestamp?: number;
      data?: string | null;
    } | null;
    if (!row) return null;
    return {
      eventId: row.id ?? null,
      owner: row.owner ?? null,
      timestamp: row.timestamp ?? null,
      ...parseEventData(row.data),
    };
  }

  function enrichOpenAlerts(db: SqliteDb, alerts: any[]): any[] {
    return alerts.map((alert) => ({
      ...alert,
      latestJudgment: latestAlertJudgment(db, alert),
    }));
  }

  function parseProjectIdentity(path: string, content?: string): { owner: string; name: string; projectId: string } {
    const normalized = normalizeProjectPathForCompare(path);
    const parts = normalized.split("/");
    const name = parts[0] === "projects"
      ? parts[1]?.replace(/\.md$/, "") ?? ""
      : parts[parts.length - 1]?.replace(/\.md$/, "") ?? "";
    let owner = parts[0] === "projects" ? "shared" : parts[1] ?? "";
    if (content?.trim().startsWith("{")) {
      try {
        const parsed = JSON.parse(content) as { owner?: unknown; id?: unknown };
        if (typeof parsed.owner === "string" && parsed.owner.trim()) owner = parsed.owner.trim();
        const jsonName = typeof parsed.id === "string" && parsed.id.trim() ? parsed.id.trim() : name;
        return { owner, name: jsonName, projectId: `${owner}/${jsonName}` };
      } catch {
        // Fall through to frontmatter/path parsing.
      }
    }
    const ownerMatch = content?.match(/^---\s*\n[\s\S]*?\nowner:\s*([^\n]+)\n[\s\S]*?\n---/m);
    if (ownerMatch?.[1]) owner = ownerMatch[1].trim().replace(/^["']|["']$/g, "");
    return { owner, name, projectId: `${owner}/${name}` };
  }

  function projectNameFromPath(path: string): string {
    return parseProjectIdentity(path).name;
  }

  function isAllowedProjectPath(path: string): boolean {
    const normalized = normalizeProjectPathForCompare(path);
    return /^projects\/[^/]+(?:\/.*)?$/.test(normalized)
      || /^[^/]+\/workspace\/projects\/[^/]+(?:\/.*)?$/.test(normalized);
  }

  function projectPathCandidates(path: string): string[] {
    const normalized = normalizeProjectPathForCompare(path);
    const clean = normalized.replace(/\/project\.md$/, "").replace(/\/$/, "");
    const name = projectNameFromPath(clean);
    const candidates = [
      resolve(PROJECT_ROOT, clean),
      resolve(PROJECT_ROOT, path),
    ];
    if (name) {
      candidates.push(resolve(PROJECTS_ROOT, name));
    }
    return [...new Set(candidates)];
  }

  function resolveProjectDir(path: string): string {
    const candidates = projectPathCandidates(path);
    return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
  }

  function projectAppDirForName(name: string): string | null {
    if (!name) return null;
    const appDir = resolve(PROJECTS_ROOT, `${name.replace(/\.app$/, "")}.app`);
    return existsSync(appDir) ? appDir : null;
  }

  function projectAppDirForPath(path: string): string | null {
    return projectAppDirForName(projectNameFromPath(path));
  }

  function extractProjectAppActions(appDir: string | null): Array<Record<string, unknown>> {
    if (!appDir) return [];
    const appPath = resolve(appDir, "app.ts");
    if (!existsSync(appPath)) return [];
    try {
      const content = readFileSync(appPath, "utf-8");
      const marker = content.indexOf("actions:");
      if (marker === -1) return [];
      const start = content.indexOf("{", marker);
      if (start === -1) return [];
      let depth = 0;
      let end = -1;
      for (let i = start; i < content.length; i++) {
        const ch = content[i];
        if (ch === "{") depth++;
        if (ch === "}") {
          depth--;
          if (depth === 0) {
            end = i;
            break;
          }
        }
      }
      if (end === -1) return [];
      const body = content.slice(start + 1, end);
      const actions: Array<Record<string, unknown>> = [];
      const re = /["']?([A-Za-z0-9_.-]+)["']?\s*:\s*\{([\s\S]*?)(?=\n\s*["']?[A-Za-z0-9_.-]+["']?\s*:\s*\{|$)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(body)) !== null) {
        const id = m[1];
        const block = m[2] || "";
        const type = block.match(/type:\s*["']([^"']+)["']/)?.[1] ?? "async";
        const description = block.match(/description:\s*["']([\s\S]*?)["']/)?.[1]?.replace(/\s+/g, " ").trim() ?? "";
        actions.push({ id, type, description });
      }
      return actions;
    } catch {
      return [];
    }
  }

  function resolveProjectFile(path: string): string {
    if (path.endsWith(".md")) {
      const dir = resolveProjectDir(path.replace(/\/project\.md$/, ""));
      const projectFile = resolve(dir, "project.md");
      if (existsSync(projectFile)) return projectFile;
      const appDir = projectAppDirForPath(path);
      if (appDir) {
        const appProjectFile = resolve(appDir, "project.md");
        if (existsSync(appProjectFile)) return appProjectFile;
        return resolve(appDir, "project.json");
      }
      return projectFile;
    }
    const projectDir = resolveProjectDir(path);
    const projectFile = resolve(projectDir, "project.md");
    if (existsSync(projectFile)) return projectFile;
    const projectJson = resolve(projectDir, "project.json");
    if (existsSync(projectJson)) return projectJson;
    const appDir = projectAppDirForPath(path);
    if (appDir) {
      const appProjectFile = resolve(appDir, "project.md");
      if (existsSync(appProjectFile)) return appProjectFile;
      return resolve(appDir, "project.json");
    }
    return projectFile;
  }

  function conventionSocketPath(): string {
    return daemonSocketPath(STATE_DIR, {
      instance: DAEMON_INSTANCE,
      interfaceAgent: DAEMON_AGENT,
    });
  }

  // ── API handlers ──────────────────────────────────────────────────

  function handleLiveness(url?: URL): Response {
    const db = _db();
    const now = Date.now();
    // Window for the activity timeline. Default 4h. Operator-selectable
    // from the WebUI via ?hours=N (clamped 1..72).
    const rawHours = Number(url?.searchParams.get("hours"));
    const hours = Number.isFinite(rawHours) && rawHours > 0
      ? Math.min(72, Math.max(1, rawHours))
      : 4;
    const since = now - hours * 60 * 60 * 1000;
    const oneHour = now - 60 * 60 * 1000;
    const agents = listConfiguredAgents();
    const scheduledHeartbeatAgents = new Set(listScheduledHeartbeatAgents(agents));

    const heartbeatRows = db.prepare(
      // Heartbeat detection covers all dispatch styles in production:
      //   1. Cron-driven sessions whose task starts with "[heartbeat]".
      //   2. Per-agent workflow sessions whose task is rebuilt internally
      //      to start with "You are **<agent>** waking up for your heartbeat."
      //      (Source is just "workflow"; only the task body identifies it.
      //      We anchor at the start of task to avoid matching aftermath
      //      reviews that embed a heartbeat session's JSON inside their task.)
      //   3. Future workflows that adopt source="workflow:<agent>-heartbeat"
      //      or source="heartbeat" once we standardize trigger typing.
      // TODO: replace string matching once heartbeat workflows set a typed
      // source / trigger field (see webui.md "Data model gaps to close" §2).
      `SELECT sessionId, agent, status, kind, source, startedAt, endedAt
       FROM sessions
       WHERE startedAt > ?
         AND (
           source LIKE 'workflow:%heartbeat%'
           OR source = 'heartbeat'
           OR task LIKE '[heartbeat]%'
           OR task LIKE 'You are %waking up for your heartbeat.%'
         )
       ORDER BY startedAt ASC`
    ).all(since) as any[];

    // All sessions in the selected window (not just heartbeats). The
    // timeline shows everything an agent did so the operator sees real
    // activity distribution, not only the cron tick. Each session is
    // classified into a 'category' bucket which maps to a color in the
    // frontend.
    const allRows = db.prepare(
      `SELECT sessionId, agent, status, kind, source, projectId, parentSessionId,
              startedAt, endedAt
       FROM sessions
       WHERE startedAt > ? AND agent IS NOT NULL AND agent != ''
       ORDER BY startedAt ASC`
    ).all(since) as any[];

    // Heartbeat detection mirrors heartbeatRows above (same predicates).
    // Pre-build a Set of heartbeat sessionIds for O(1) classification.
    const heartbeatIds = new Set(heartbeatRows.map((r) => r.sessionId));

    function classifyKind(row: any): string {
      if (heartbeatIds.has(row.sessionId)) return "heartbeat";
      const src = String(row.source || "").toLowerCase();
      // Project work: explicit projectId tag or source mentions a project
      // workflow. (`workflow:project` is the generic project worker.)
      if (row.projectId && String(row.projectId).trim() !== "") return "project";
      if (src === "workflow:project" || src.startsWith("workflow:project-")) return "project";
      // Chat: human-initiated turns (telegram, web UI, CLI, explicit chat kind)
      if (row.kind === "chat") return "chat";
      if (src === "telegram" || src === "web" || src === "human" || src === "cli") return "chat";
      if (src.includes("chat") || src.includes("message")) return "chat";
      // Workflow: any workflow-dispatched session that isn't a heartbeat or
      // project. Catches aftermath, triage, orchestrator, goal-driver,
      // closed-loop-steward, etc. — the bulk of background agent activity.
      if (src.startsWith("workflow:") || src === "closed-loop-steward") return "workflow";
      return "other";
    }

    const byAgent = new Map<string, any[]>();
    for (const agent of agents) byAgent.set(agent, []);
    for (const row of allRows) {
      if (!byAgent.has(row.agent)) byAgent.set(row.agent, []);
      // 'category' is the timeline bucket (heartbeat / project / chat /
      // workflow / other). Distinct from row.kind which is the DB-level
      // session kind (call / chat / etc).
      byAgent.get(row.agent)!.push({ ...row, category: classifyKind(row) });
    }

    const agentRows = [...byAgent.entries()].map(([name, sessions]) => {
      const heartbeatsForAgent = sessions.filter((s) => s.category === "heartbeat");
      const lastHb = heartbeatsForAgent[heartbeatsForAgent.length - 1] ?? null;
      const categoryCounts: Record<string, number> = { heartbeat: 0, project: 0, chat: 0, workflow: 0, other: 0 };
      for (const s of sessions) categoryCounts[s.category] = (categoryCounts[s.category] || 0) + 1;
      return {
        name,
        heartbeatCount: heartbeatsForAgent.length,
        sessionCount: sessions.length,
        categoryCounts,
        lastHeartbeat: lastHb?.startedAt ?? null,
        lastStatus: lastHb?.status ?? null,
        sessions,
      };
    }).sort((a, b) => (b.lastHeartbeat ?? 0) - (a.lastHeartbeat ?? 0));

    const activeSessions = (db.prepare("SELECT COUNT(*) as c FROM sessions WHERE status IN ('running', 'idle')").get() as any)?.c ?? 0;
    const openAlerts = enrichOpenAlerts(db, db.prepare(
      `SELECT ma.id as alertId, ma.metric_id as metricId, ma.message, ma.created_at as createdAt,
              COALESCE(NULLIF(trim(m.owner), ''), NULLIF(trim(p.owner), ''), 'may') as owner,
              m.project, m.priority, m.current, m.threshold, m.target
       FROM metric_alerts ma
       LEFT JOIN metrics m ON m.id = ma.metric_id
       LEFT JOIN projects p ON m.project IS NOT NULL AND trim(m.project) != ''
         AND (p.id = m.project OR p.path = m.project OR p.name = m.project)
       WHERE ma.resolved_at IS NULL
       ORDER BY ma.created_at DESC
       LIMIT 20`
    ).all() as any[]);

    const metricOrder = new Map(LIVE_VITAL_METRIC_IDS.map((id, idx) => [id, idx]));
    const vitalPlaceholders = LIVE_VITAL_METRIC_IDS.map(() => "?").join(", ");
    const openAlertMetricIds = new Set(openAlerts.map((alert) => alert.metricId));
    const vitals = db.prepare(
      `SELECT id, name, owner, current, target, threshold, unit, priority, alert_op, updated_at as updatedAt
       FROM metrics
       WHERE id IN (${vitalPlaceholders}) AND status = 'active'`
    ).all(...LIVE_VITAL_METRIC_IDS) as any[];
    const vitalMetrics = vitals
      .map((m) => {
        const current = typeof m.current === "number" ? m.current : null;
        const threshold = typeof m.threshold === "number" ? m.threshold : null;
        const breached = current != null && threshold != null
          ? (m.alert_op === ">" || m.alert_op === "above" ? current > threshold : current < threshold)
          : false;
        return {
          ...m,
          owner: m.owner || "may",
          breached,
          alertOpen: openAlertMetricIds.has(m.id),
        };
      })
      .sort((a, b) => (metricOrder.get(a.id) ?? 999) - (metricOrder.get(b.id) ?? 999));

    const messages = (db.prepare(
      `SELECT event_type, source, owner, data, timestamp
       FROM events
       WHERE event_type = 'message.created' AND timestamp > ?
       ORDER BY timestamp DESC
       LIMIT 20`
    ).all(oneHour) as any[]).map((row) => {
      const data = parseEventData(row.data);
      return {
        timestamp: row.timestamp,
        from: data.from ?? row.source ?? "unknown",
        to: data.to ?? row.owner ?? "unknown",
        priority: data.priority ?? null,
        intent: data.intent ?? null,
        content: data.content ?? "",
      };
    });

    const recentDecisions = (db.prepare(
      `SELECT sessionId, agent, task, status, startedAt, outcome
       FROM sessions
       WHERE startedAt > ?
         AND (
           source LIKE 'workflow:%heartbeat%'
           OR source = 'heartbeat'
           OR task LIKE '[heartbeat]%'
           OR task LIKE 'You are %waking up for your heartbeat.%'
         )
       ORDER BY startedAt DESC
       LIMIT 8`
    ).all(since) as any[])
      .map((row) => ({
        sessionId: row.sessionId,
        agent: row.agent,
        timestamp: row.startedAt,
        status: row.status,
        text: (row.outcome || row.task || "").replace(/^\[heartbeat\]\s*/i, "").slice(0, 220),
      }));

    const scheduledAgentRows = agentRows.filter((agent) => scheduledHeartbeatAgents.has(agent.name));
    const scheduledHeartbeatRows = scheduledAgentRows.filter((agent) => agent.lastHeartbeat);
    const staleAgents = scheduledAgentRows.filter((agent) => !agent.lastHeartbeat).map((agent) => agent.name);

    return json({
      summary: {
        agentsConfigured: scheduledHeartbeatAgents.size || agents.length,
        agentsTotal: agents.length,
        expectedHeartbeatAgents: scheduledHeartbeatAgents.size || agents.length,
        // NOTE: keep `*4h` field names even though the window is now
        // operator-selectable — they're consumed elsewhere as the
        // "heartbeat coverage in window" signal, and the window default
        // is still 4h. Use `windowHours` for accurate labeling.
        heartbeatAgents4h: scheduledHeartbeatRows.length,
        heartbeats4h: heartbeatRows.length,
        windowHours: hours,
        windowSince: since,
        activeSessions,
        openAlerts: openAlerts.length,
        staleAgents: staleAgents.length,
      },
      agents: agentRows,
      heartbeats: heartbeatRows,
      recentDecisions,
      messages,
      alerts: openAlerts,
      vitals: vitalMetrics,
    });
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
    const evaluation = _db().prepare("SELECT * FROM evaluations WHERE sessionId = ?").get(sessionId) || null;
    return json({ session, children, evaluation });
  }

  function resolveSessionJsonl(sessionId: string): { path: string; source: string } | null {
    const livePath = join(STATE_DIR, "sessions", sessionId, "session.jsonl");
    if (existsSync(livePath)) return { path: livePath, source: ".state/sessions/" + sessionId + "/session.jsonl" };
    const historyPath = join(STATE_DIR, "sessions", "history", sessionId, "session.jsonl");
    if (existsSync(historyPath)) return { path: historyPath, source: ".state/sessions/history/" + sessionId + "/session.jsonl" };
    return null;
  }

  function resolveSessionEval(sessionId: string): { path: string; source: string; session: { path: string; source: string } } | null {
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
        try { return JSON.parse(line); } catch { return { parseError: true, raw: line }; }
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


  function firstSummaryRow(rows: unknown[]): Record<string, any> | null {
    for (let i = rows.length - 1; i >= 0; i--) {
      const row = rows[i] as Record<string, any>;
      if (row && row.type === "summary") return row;
    }
    return null;
  }

  function readSessionEvalSummary(sessionId: string): { source: string | null; rows: unknown[]; summary: Record<string, any> | null } {
    const resolved = resolveSessionEval(sessionId);
    if (!resolved || !existsSync(resolved.path)) return { source: resolved?.source ?? null, rows: [], summary: null };
    const rows = readEvalRows(resolved.path);
    return { source: resolved.source, rows, summary: firstSummaryRow(rows) };
  }

  function incrementCount(map: Record<string, number>, key: unknown): void {
    const name = String(key || "unknown");
    map[name] = (map[name] || 0) + 1;
  }

  function handleLearning(url: URL): Response {
    const db = _db();
    const days = Math.max(1, Math.min(90, parseInt(url.searchParams.get("days") || "7", 10) || 7));
    const limit = Math.max(20, Math.min(500, parseInt(url.searchParams.get("limit") || "200", 10) || 200));
    const projectId = url.searchParams.get("projectId") || "";
    const ownerFilter = url.searchParams.get("owner") || "";
    const scopeFilter = url.searchParams.get("scope") || "";
    const severityFilter = url.searchParams.get("severity") || "";
    const now = Date.now();
    const since = now - days * 86400000;

    const sessionWhere = ["status IN ('done','error','interrupted')", "agent NOT IN ('evaluator','judge')", "COALESCE(endedAt, startedAt) >= ?"];
    const sessionParams: unknown[] = [since];
    if (projectId) {
      sessionWhere.push("projectId = ?");
      sessionParams.push(projectId);
    }

    let sessions: Array<Record<string, any>> = [];
    try {
      sessions = db.prepare(
        `SELECT sessionId, agent, status, source, projectId, workflowRunId, startedAt, endedAt, opCount, substr(task, 1, 220) AS task
         FROM sessions
         WHERE ${sessionWhere.join(" AND ")}
         ORDER BY COALESCE(endedAt, startedAt) DESC
         LIMIT 1200`,
      ).all(...sessionParams) as Array<Record<string, any>>;
    } catch {
      sessions = [];
    }

    const evaluatedIds = new Set<string>();
    const verdicts: Record<string, number> = {};
    try {
      const rows = db.prepare("SELECT sessionId, verdict FROM evaluations").all() as Array<{ sessionId?: string; verdict?: string }>;
      for (const row of rows) {
        if (!row.sessionId) continue;
        evaluatedIds.add(row.sessionId);
        incrementCount(verdicts, row.verdict || "unknown");
      }
    } catch { /* tolerate missing table */ }

    const notifiedKeys = new Set<string>();
    let immediateEventCount = 0;
    try {
      const eventRows = db.prepare(
        `SELECT data FROM events WHERE event_type = 'learning.feedback' AND timestamp >= ? ORDER BY timestamp DESC LIMIT 1000`,
      ).all(since) as Array<{ data?: string }>;
      for (const event of eventRows) {
        const data = parseEventData(event.data);
        const finding = (data.finding || {}) as Record<string, unknown>;
        const sid = String(data.sessionId || "");
        const fid = String(finding.id || "");
        if (sid && fid) notifiedKeys.add(`${sid}:${fid}`);
        if (!projectId || data.projectId === projectId) immediateEventCount += 1;
      }
    } catch { /* events are best-effort */ }

    const findings: Array<Record<string, any>> = [];
    const recentEvaluations: Array<Record<string, any>> = [];
    const byScope: Record<string, number> = {};
    const byOwner: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const byAgent: Record<string, number> = {};
    const buckets: Record<string, { sessions: number; evaluated: number; findings: number; high: number; guards: number; guardBlocks: number }> = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now - i * 86400000).toISOString().slice(0, 10);
      buckets[d] = { sessions: 0, evaluated: 0, findings: 0, high: 0, guards: 0, guardBlocks: 0 };
    }

    const guardSignals: Array<Record<string, any>> = [];
    const byGuard: Record<string, number> = {};
    const byGuardAction: Record<string, number> = {};
    let guardBlockCount = 0;
    try {
      const guardRows = db.prepare(
        `SELECT owner, data, timestamp FROM events WHERE event_type = 'guard.triggered' AND timestamp >= ? ORDER BY timestamp DESC LIMIT 1000`,
      ).all(since) as Array<{ owner?: string; data?: string; timestamp?: number }>;
      for (const event of guardRows) {
        const data = parseEventData(event.data);
        if (projectId && data.projectId !== projectId) continue;
        const action = String(data.action || data.demandType || "triggered");
        const demandType = String(data.demandType || "");
        const guard = String(data.guard || data.name || "unknown");
        const owner = String(event.owner || "unknown");
        const createdAt = Number(event.timestamp || now);
        const blocked = action === "blocked" || demandType === "block";
        incrementCount(byGuard, guard);
        incrementCount(byGuardAction, action);
        if (blocked) guardBlockCount += 1;
        const day = new Date(createdAt).toISOString().slice(0, 10);
        if (buckets[day]) {
          buckets[day].guards += 1;
          if (blocked) buckets[day].guardBlocks += 1;
        }
        guardSignals.push({
          guard,
          action,
          demandType: demandType || null,
          owner,
          sessionId: data.sessionId || null,
          workflowRunId: data.workflowRunId || null,
          projectId: data.projectId || null,
          reason: data.reason || "",
          sourceEventType: data.sourceEventType || null,
          reviewStatus: "unreviewed",
          learningRole: "signal",
          createdAt,
        });
      }
    } catch { /* guard events are best-effort */ }

    const backlogSessions: Array<Record<string, any>> = [];
    for (const session of sessions) {
      const sid = String(session.sessionId || "");
      const day = new Date(Number(session.endedAt || session.startedAt || now)).toISOString().slice(0, 10);
      if (buckets[day]) buckets[day].sessions += 1;
      const evalData = readSessionEvalSummary(sid);
      const hasEvalFile = evalData.rows.length > 0;
      if (hasEvalFile) evaluatedIds.add(sid);
      const evaluated = evaluatedIds.has(sid);
      if (evaluated && buckets[day]) buckets[day].evaluated += 1;
      if (!evaluated) {
        backlogSessions.push(session);
        continue;
      }

      const summary = evalData.summary;
      if (summary) {
        recentEvaluations.push({
          sessionId: sid,
          agent: session.agent,
          projectId: session.projectId || null,
          status: session.status,
          verdict: summary.verdict || "unknown",
          lane: summary.lane || null,
          quality: summary.quality ?? null,
          efficiency: summary.efficiency ?? null,
          createdAt: summary.createdAt || session.endedAt || session.startedAt,
          source: evalData.source,
          comment: summary.comment || "",
        });
        incrementCount(verdicts, summary.verdict || "unknown");
      }

      const ownerFindings = summary?.repairDecision?.ownerFindings;
      const immediateIds = new Set((summary?.repairDecision?.notificationDecision?.immediateFindingIds || []).map(String));
      if (!Array.isArray(ownerFindings)) continue;
      for (const finding of ownerFindings) {
        const fid = String(finding?.id || "finding");
        const owner = String(finding?.owner || "unknown");
        const scope = String(finding?.scope || "unknown");
        const severity = String(finding?.severity || "medium");
        if (ownerFilter && owner !== ownerFilter) continue;
        if (scopeFilter && scope !== scopeFilter) continue;
        if (severityFilter && severity !== severityFilter) continue;
        const notified = immediateIds.has(fid) || notifiedKeys.has(`${sid}:${fid}`);
        const createdAt = Number(summary?.createdAt || session.endedAt || session.startedAt || now);
        const item = {
          key: `${sid}:${fid}`,
          id: fid,
          repeatKey: `${owner}:${scope}:${fid}`,
          sessionId: sid,
          agent: session.agent,
          projectId: session.projectId || null,
          workflowRunId: session.workflowRunId || null,
          owner,
          scope,
          severity,
          finding: finding.finding || "",
          impact: finding.impact || "",
          ownerReason: finding.ownerReason || "",
          suggestedActions: Array.isArray(finding.suggestedActions) ? finding.suggestedActions : [],
          evidence: Array.isArray(finding.evidence) ? finding.evidence : [],
          notified,
          createdAt,
          evalTrailPath: evalData.source,
          sessionStatus: session.status,
          task: session.task || "",
        };
        findings.push(item);
        incrementCount(byScope, scope);
        incrementCount(byOwner, owner);
        incrementCount(bySeverity, severity);
        incrementCount(byAgent, session.agent || "unknown");
        if (buckets[day]) {
          buckets[day].findings += 1;
          if (severity === "high") buckets[day].high += 1;
        }
      }
    }

    findings.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
    recentEvaluations.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));

    let evaluatorFailures: Array<Record<string, any>> = [];
    let evaluatorReviewCount = 0;
    try {
      const evalRows = db.prepare(
        `SELECT sessionId, agent, status, source, startedAt, endedAt, error, substr(task, 1, 180) AS task
         FROM sessions
         WHERE agent = 'evaluator'
           AND COALESCE(endedAt, startedAt) >= ?
           AND (source LIKE 'workflow:evaluator-aftermath%' OR source = 'cli' OR task LIKE 'Review session aftermath%')
         ORDER BY COALESCE(endedAt, startedAt) DESC
         LIMIT 500`,
      ).all(since) as Array<Record<string, any>>;
      evaluatorReviewCount = evalRows.length;
      evaluatorFailures = evalRows.filter((row) => row.status === "error").slice(0, 50);
    } catch { /* ignore */ }

    const terminalSessions = sessions.length;
    const evaluatedSessions = sessions.filter((s) => evaluatedIds.has(String(s.sessionId || ""))).length;
    const highFindings = findings.filter((f) => f.severity === "high").length;
    const immediateFindings = findings.filter((f) => f.notified).length || immediateEventCount;
    const staleBlockerLoops = findings.filter((f) => f.id === "stale-blocker-loop").length;
    const repeatCounts: Record<string, number> = {};
    for (const finding of findings) incrementCount(repeatCounts, finding.repeatKey);
    const recurring = Object.entries(repeatCounts)
      .filter(([, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([key, count]) => ({ key, count }));

    return json({
      window: { days, since, now, projectId: projectId || null },
      summary: {
        terminalSessions,
        evaluatedSessions,
        coveragePct: terminalSessions ? Math.round((evaluatedSessions / terminalSessions) * 100) : 0,
        backlog: Math.max(0, terminalSessions - evaluatedSessions),
        findings: findings.length,
        highFindings,
        immediateFindings,
        staleBlockerLoops,
        evaluatorReviewCount,
        evaluatorFailures: evaluatorFailures.length,
        evaluatorFailureRatePct: evaluatorReviewCount ? Math.round((evaluatorFailures.length / evaluatorReviewCount) * 100) : 0,
        guardSignals: guardSignals.length,
        guardBlocks: guardBlockCount,
        guardSignalsReviewed: 0,
        guardSignalNote: "Guard signals are unreviewed detector output, not proof of agent fault.",
      },
      breakdowns: { byScope, byOwner, bySeverity, byAgent, byVerdict: verdicts, byGuard, byGuardAction },
      timeline: Object.entries(buckets).map(([date, value]) => ({ date, ...value })),
      findings: findings.slice(0, limit),
      recentEvaluations: recentEvaluations.slice(0, 50),
      backlogSessions: backlogSessions.slice(0, 50),
      evaluatorFailures,
      guardSignals: guardSignals.slice(0, 50),
      recurring,
    });
  }

  async function handleSessionEvalGenerate(req: Request, sessionId: string): Promise<Response> {
    const resolved = resolveSessionEval(sessionId);
    if (!resolved) return json({ error: "Session not found" }, 404);

    let body: { line?: number } = {};
    try { body = await req.json() as typeof body; } catch {}
    const focusLine = Number(body.line || 0);
    const hasFocusLine = Number.isInteger(focusLine) && focusLine > 0;
    const rows = readEvalRows(resolved.path);

    if (existsSync(resolved.path) && !hasFocusLine) {
      return json({ sessionId, source: resolved.source, exists: true, requested: false, rows });
    }

    const rawLines = readFileSync(resolved.session.path, "utf-8").split("\n");
    const focusRaw = hasFocusLine ? rawLines[focusLine - 1] || "" : "";
    const task = [
      `Generate the session evaluation trail for ${sessionId}.`,
      ``,
      `Raw session log: ${resolved.session.source}`,
      `Session eval trail to append: ${resolved.source}`,
      hasFocusLine ? `Focus line: session.jsonl:${focusLine}` : `Focus: whole session`,
      hasFocusLine ? `Raw focus record: ${focusRaw}` : ``,
      ``,
      `Append JSONL rows to session.eval.jsonl. Do not rewrite existing rows.`,
      `Think deeply. Do not merely summarize the transcript. Judge whether each actor did well: user request quality, assistant reasoning/action quality, tool-call necessity, evidence quality, recovery, verification, and finish honesty.`,
      `Use free-form JSON fields when useful. The only required mapping fields are: type, sessionId, source, author, createdAt, and line/rawSource/rawRole for line-level rows.`,
      `For user lines, critique whether the request clearly expressed purpose, provided necessary context, stayed clean/integral, could be simpler, or contained misleading/stale information.`,
      `For assistant/tool lines, explain what was good or bad, why it mattered, and how the agent should do better next time.`,
      `Use existing human-feedback rows in the eval trail as correction signal when present.`,
    ].filter(Boolean).join("\n");
    const evaluator = await sendDaemonFrame({ type: "fork", agent: "evaluator", task, opts: { kind: "job", source: "session-eval" } });

    return json({
      sessionId,
      source: resolved.source,
      exists: existsSync(resolved.path),
      requested: evaluator.ok,
      evaluatorError: evaluator.error,
      rows,
    });
  }

  async function handleSessionEvalComment(req: Request, sessionId: string): Promise<Response> {
    const resolved = resolveSessionEval(sessionId);
    if (!resolved) return json({ error: "Session not found" }, 404);
    let body: { line?: number; comment?: string; author?: string; originalEval?: unknown };
    try { body = await req.json() as typeof body; } catch { return json({ error: "invalid json" }, 400); }
    const line = Number(body.line || 0);
    const comment = String(body.comment || "").trim();
    if (!Number.isInteger(line) || line < 1) return json({ error: "line must be a positive integer" }, 400);
    if (!comment) return json({ error: "comment required" }, 400);
    const raw = readFileSync(resolved.session.path, "utf-8").split("\n")[line - 1] || "";
    const row = {
      type: "line",
      sessionId,
      line,
      source: "human-feedback",
      author: body.author || "human",
      createdAt: Date.now(),
      comment,
      originalEval: body.originalEval || null,
      rawRole: "human-feedback",
      rawSource: resolved.session.source,
      rawContext: { source: resolved.session.source, line, raw },
    };
    appendFileSync(resolved.path, JSON.stringify(row) + "\n");
    return json({ ok: true, row, rows: readEvalRows(resolved.path) });
  }

  function handleTranscript(sessionId: string): Response {
    const resolved = resolveSessionJsonl(sessionId);
    if (!resolved) return json({ error: "Transcript not found" }, 404);
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
          if (text && !text.startsWith("# Session Context")) messages.push({ role: "user", text, rawLine, rawSource: resolved.source });
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
            const msg: Record<string, unknown> = { role: "assistant", text, toolCalls, rawLine, rawSource: resolved.source };
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
    return json({ sessionId, source: resolved.source, messageCount: messages.length, messages });
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
    try { parsed = JSON.parse(raw); } catch {}
    return json({ sessionId, source: resolved.source, line: lineNo, raw, parsed });
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
    const req24h: unknown[] = [];
    const totalSess7d = (_db().prepare("SELECT COUNT(*) as cnt FROM sessions WHERE startedAt > ?").get(week) as any)
      .cnt;
    const humanReq7d = 0;
    return json({
      last24h: { sessions: sess24h, requests: req24h },
      last7d: { totalSessions: totalSess7d, humanRequests: humanReq7d },
      socketAvailable: existsSync(conventionSocketPath()),
      socketPath: conventionSocketPath(),
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

  // ── Agent Detail API ─────────────────────────────────────────────

  function handleAgentDetail(agentName: string): Response {
    // 1. Recent sessions
    const recentSessions = (_db()
      .prepare(
        `SELECT sessionId, task, status, startedAt, endedAt, opCount, outcome
         FROM sessions WHERE agent = ? ORDER BY startedAt DESC LIMIT 50`,
      )
      .all(agentName) as Array<{ sessionId: string; task: string | null; status: string; startedAt: number; endedAt: number | null; opCount: number | null; outcome: string | null }>)
      .map((row) => ({
        id: row.sessionId,
        task: row.task?.slice(0, 120),
        status: row.status,
        startedAt: row.startedAt,
        duration: row.endedAt ? Math.round((row.endedAt - row.startedAt) / 1000) : null,
        opCount: row.opCount,
        outcome: row.outcome?.slice(0, 100),
      }));

    // 2. Eval trend
    const evalTrend = _db()
      .prepare(
        `SELECT quality, efficiency, verdict, createdAt
         FROM evaluations WHERE agent = ? ORDER BY createdAt DESC LIMIT 20`,
      )
      .all(agentName) as Array<{ quality: number; efficiency: number; verdict: string; createdAt: number }>;

    // 3. Delegation map
    const since = Date.now() - 7 * 86400000;

    const delegatesTo = _db()
      .prepare(
        `SELECT c.agent, COUNT(*) as count
         FROM sessions p JOIN sessions c ON c.parentSessionId = p.sessionId
         WHERE p.agent = ? AND p.startedAt > ?
         GROUP BY c.agent ORDER BY count DESC`,
      )
      .all(agentName, since) as Array<{ agent: string; count: number }>;

    const delegatedFrom = _db()
      .prepare(
        `SELECT p.agent, COUNT(*) as count
         FROM sessions c JOIN sessions p ON c.parentSessionId = p.sessionId
         WHERE c.agent = ? AND c.startedAt > ?
         GROUP BY p.agent ORDER BY count DESC`,
      )
      .all(agentName, since) as Array<{ agent: string; count: number }>;

    // 4. Workspace files
    const wsDir = join(STATE_DIR, "..", "agents", agentName, "workspace");
    let workspaceFiles: string[] = [];
    if (existsSync(wsDir)) {
      workspaceFiles = readdirSync(wsDir)
        .filter((f) => !f.startsWith("."))
        .slice(0, 50);
    }

    return json({
      recentSessions,
      evalTrend,
      delegationMap: { delegatesTo, delegatedFrom },
      workspaceFiles,
    });
  }

  // ── Knowledge API ──────────────────────────────────────────────────

  // ── Browse API: generic file/directory browser for knowledge base ──
  function handleMetrics(_url: URL): Response {
    const db = _db();
    const metrics = db.prepare(`
      SELECT m.id, m.name, m.type,
             COALESCE(NULLIF(trim(m.owner), ''), NULLIF(trim(p.owner), ''), 'may') as owner,
             m.owner as explicitOwner, m.project, m.current, m.target, m.threshold,
             m.unit, m.priority, m.status, m.speed, m.alert_op,
             m.source, m.updated_at
      FROM metrics m
      LEFT JOIN projects p ON m.project IS NOT NULL AND trim(m.project) != ''
        AND (p.id = m.project OR p.path = m.project OR p.name = m.project)
      WHERE m.status = 'active'
      ORDER BY owner, m.priority, m.name
    `).all() as any[];

    const openAlerts = enrichOpenAlerts(db, db.prepare(`
      SELECT ma.id as alertId, ma.metric_id as metricId, ma.alert_type as alertType,
             ma.message, ma.created_at as createdAt,
             m.name, m.type,
             COALESCE(NULLIF(trim(m.owner), ''), NULLIF(trim(p.owner), ''), 'may') as owner,
             m.owner as explicitOwner, m.project, m.current, m.target, m.threshold,
             m.unit, m.priority, m.status, m.speed, m.alert_op,
             m.source, m.updated_at
      FROM metric_alerts ma
      INNER JOIN metrics m ON m.id = ma.metric_id
      LEFT JOIN projects p ON m.project IS NOT NULL AND trim(m.project) != ''
        AND (p.id = m.project OR p.path = m.project OR p.name = m.project)
      WHERE ma.resolved_at IS NULL
        AND m.status = 'active'
      ORDER BY ma.created_at DESC
    `).all() as any[]);

    const openAlertByMetric = new Map(openAlerts.map((alert) => [alert.metricId, alert]));
    const metricsWithAlertState = metrics.map((metric) => {
      const alert = openAlertByMetric.get(metric.id);
      return alert
        ? { ...metric, alertOpen: true, alertId: alert.alertId, alertMessage: alert.message, alertType: alert.alertType, latestJudgment: alert.latestJudgment }
        : { ...metric, alertOpen: false };
    });

    const snapshots = db.prepare(`
      SELECT ms.metric_id, ms.value, ms.sample_size, ms.measured_at, ms.note
      FROM metric_snapshots ms
      INNER JOIN (
        SELECT metric_id, MAX(measured_at) as max_at
        FROM metric_snapshots GROUP BY metric_id
      ) latest ON ms.metric_id = latest.metric_id AND ms.measured_at = latest.max_at
      ORDER BY ms.measured_at DESC
    `).all() as any[];

    const recentSnapshots = db.prepare(`
      SELECT ms.metric_id, ms.value, ms.sample_size, ms.measured_at, ms.measured_by, ms.note
      FROM metric_snapshots ms ORDER BY ms.measured_at DESC LIMIT 50
    `).all() as any[];

    return new Response(JSON.stringify({ metrics: metricsWithAlertState, latestSnapshots: snapshots, recentSnapshots, alerts: openAlerts }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  function handleBrowse(url: URL): Response {
    const relPath = url.searchParams.get("path") ?? "";
    const sharedDir = SHARED_ROOT;

    // Only allow browsing under the shared root.
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

  function handleKnowledgeSearch(url: URL): Response {
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();
    const limit = Math.max(1, Math.min(80, Number(url.searchParams.get("limit") || 40)));
    if (q.length < 2) return json({ query: q, results: [] });

    const roots: Array<{ label: string; dir: string }> = [];
    const sharedKnowledge = resolve(SHARED_ROOT, "knowledge");
    if (existsSync(sharedKnowledge)) roots.push({ label: "shared/knowledge", dir: sharedKnowledge });
    try {
      for (const entry of readdirSync(PROJECTS_ROOT, { withFileTypes: true })) {
        if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
        const knowledgeDir = resolve(PROJECTS_ROOT, entry.name, "knowledge");
        if (existsSync(knowledgeDir)) roots.push({ label: `projects/${entry.name}/knowledge`, dir: knowledgeDir });
      }
    } catch {
      // Keep search available even if projects root is missing.
    }

    const results: Array<Record<string, unknown>> = [];
    const visit = (root: { label: string; dir: string }, dir: string, depth: number) => {
      if (results.length >= limit || depth > 5) return;
      let entries: any[];
      try {
        entries = readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (results.length >= limit) return;
        if (entry.name.startsWith(".")) continue;
        const abs = resolve(dir, entry.name);
        const rel = relative(root.dir, abs);
        if (rel.startsWith("..") || rel.startsWith("/")) continue;
        if (entry.isDirectory()) {
          visit(root, abs, depth + 1);
          continue;
        }
        if (!/\.(md|json|txt)$/i.test(entry.name)) continue;
        let stat: { size: number } | null = null;
        try {
          stat = statSync(abs);
          if (stat.size > 200_000) continue;
        } catch {
          continue;
        }
        const displayPath = `${root.label}/${rel.replace(/\\/g, "/")}`;
        let content = "";
        try {
          content = readFileSync(abs, "utf-8");
        } catch {
          continue;
        }
        const lowerPath = displayPath.toLowerCase();
        const lowerContent = content.toLowerCase();
        const pathHit = lowerPath.includes(q);
        const contentIdx = lowerContent.indexOf(q);
        if (!pathHit && contentIdx === -1) continue;
        const start = contentIdx === -1 ? 0 : Math.max(0, contentIdx - 90);
        const snippet = content.slice(start, Math.min(content.length, start + 240)).replace(/\s+/g, " ").trim();
        results.push({
          path: displayPath,
          browsePath: root.label === "shared/knowledge" ? `knowledge/${rel.replace(/\\/g, "/")}` : null,
          source: root.label,
          size: stat.size,
          match: pathHit ? "path" : "content",
          snippet,
        });
      }
    };
    for (const root of roots) visit(root, root.dir, 0);
    return json({ query: q, results });
  }

  function contentTypeFor(path: string): string {
    switch (extname(path).toLowerCase()) {
      case ".html": return "text/html; charset=utf-8";
      case ".css": return "text/css; charset=utf-8";
      case ".js": return "text/javascript; charset=utf-8";
      case ".json": return "application/json; charset=utf-8";
      case ".md": return "text/markdown; charset=utf-8";
      case ".txt": return "text/plain; charset=utf-8";
      case ".svg": return "image/svg+xml";
      case ".png": return "image/png";
      case ".jpg":
      case ".jpeg": return "image/jpeg";
      case ".gif": return "image/gif";
      case ".webp": return "image/webp";
      case ".ico": return "image/x-icon";
      default: return "application/octet-stream";
    }
  }

  function htmlEscape(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function isInsideProjectsRoot(path: string): boolean {
    const rel = relative(PROJECTS_ROOT, path);
    return rel === "" || (!rel.startsWith("..") && !rel.startsWith("/"));
  }

  function projectStaticPathFromUrl(pathname: string): string | null {
    const raw = pathname === "/projects" ? "" : pathname.replace(/^\/projects\/?/, "");
    try {
      return decodeURIComponent(raw);
    } catch {
      return null;
    }
  }

  function serveFile(path: string): Response {
    return new Response(readFileSync(path), {
      headers: {
        "Content-Type": contentTypeFor(path),
        "Cache-Control": "no-cache",
      },
    });
  }

  function serveProjectDirectory(path: string, urlPath: string): Response {
    const indexPath = join(path, "index.html");
    if (existsSync(indexPath) && statSync(indexPath).isFile()) return serveFile(indexPath);

    const normalizedUrlPath = urlPath.endsWith("/") ? urlPath : `${urlPath}/`;
    const rel = relative(PROJECTS_ROOT, path);
    const title = rel ? `/projects/${rel}` : "/projects";
    const parent = rel ? `<li><a href="${htmlEscape(normalizedUrlPath)}../">../</a></li>` : "";
    const entries = readdirSync(path)
      .map((name) => {
        const fullPath = join(path, name);
        const stat = statSync(fullPath);
        return { name, isDir: stat.isDirectory(), size: stat.size };
      })
      .sort((a, b) => Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name));
    const rows = entries.map((entry) => {
      const href = `${normalizedUrlPath}${encodeURIComponent(entry.name)}${entry.isDir ? "/" : ""}`;
      const label = `${entry.name}${entry.isDir ? "/" : ""}`;
      const meta = entry.isDir ? "dir" : `${entry.size} bytes`;
      return `<li><a href="${htmlEscape(href)}">${htmlEscape(label)}</a> <span>${htmlEscape(meta)}</span></li>`;
    }).join("\n");
    return new Response(`<!doctype html>
<html><head><meta charset="utf-8"><title>${htmlEscape(title)}</title>
<style>body{font:14px system-ui,sans-serif;margin:32px;line-height:1.5}a{color:#0969da;text-decoration:none}a:hover{text-decoration:underline}ul{list-style:none;padding:0}li{padding:4px 0;border-bottom:1px solid #eee}span{color:#666;margin-left:12px;font-size:12px}</style>
</head><body><h1>${htmlEscape(title)}</h1><ul>${parent}${rows}</ul></body></html>`, {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" },
    });
  }

  function serveProjectStatic(pathname: string): Response {
    const relPath = projectStaticPathFromUrl(pathname);
    if (relPath === null) return new Response("Bad path", { status: 400 });
    let absPath = resolve(PROJECTS_ROOT, relPath);
    if (!isInsideProjectsRoot(absPath)) return new Response("Forbidden", { status: 403 });
    if (!existsSync(absPath)) {
      const parts = relPath.split("/").filter(Boolean);
      const [name, area, ...rest] = parts;
      const appDir = projectAppDirForName(name);
      if (appDir && area === "ui") {
        absPath = resolve(appDir, "ui", ...rest);
      } else if (appDir && area === "kanban") {
        absPath = resolve(appDir, "ui", "kanban", ...rest);
      }
      if (!isInsideProjectsRoot(absPath)) return new Response("Forbidden", { status: 403 });
    }
    if (!existsSync(absPath)) return new Response("Not found", { status: 404 });
    const stat = statSync(absPath);
    if (stat.isDirectory()) return serveProjectDirectory(absPath, pathname);
    if (stat.isFile()) return serveFile(absPath);
    return new Response("Not found", { status: 404 });
  }

  function serveIndex(): Response {
    const platformUi = resolve(PROJECTS_ROOT, "platform", "ui", "index.html");
    if (existsSync(platformUi)) return serveFile(platformUi);
    return serveProjectStatic("/projects");
  }

  function handleProjects(): Response {
    const projects: Array<Record<string, unknown>> = [];

    // Helper to process a project directory entry
    const processProject = (projectFile: string, relPath: string, name: string, fallbackOwner: string) => {
      try {
        const content = readFileSync(projectFile, "utf-8");
        const jsonProject = content.trim().startsWith("{")
          ? (() => { try { return JSON.parse(content) as Record<string, any>; } catch { return null; } })()
          : null;
        // Parse YAML frontmatter if present (current convention).
        // Legacy per-agent projects may still use old `**Owner**: x` lines.
        const normalizedRelPath = normalizeProjectPathForCompare(relPath);
        const isSharedProject = normalizedRelPath.startsWith("projects/");
        let frontmatter: Record<string, string> = {};
        const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
        if (fmMatch) {
          for (const line of fmMatch[1].split("\n")) {
            const kv = line.match(/^([a-z_]+):\s*(.+?)\s*$/i);
            if (kv) frontmatter[kv[1].toLowerCase()] = kv[2];
          }
        }
        const formatErrors: string[] = [];
        if (isSharedProject && !fmMatch) formatErrors.push("missing YAML frontmatter");
        for (const required of ["id", "owner", "status"]) {
          if (isSharedProject && !frontmatter[required]) formatErrors.push(`missing frontmatter field: ${required}`);
        }
        if (isSharedProject && content.replace(/^---\n[\s\S]*?\n---\n/, "").match(/^\s*\*\*(Owner|Status):?\*\*:?\s*/mi)) {
          formatErrors.push("metadata duplicated as bold body field");
        }
        const field = (n: string) => {
          if (jsonProject) {
            const jsonValue = jsonProject[n[0].toLowerCase() + n.slice(1)] ?? jsonProject[n.toLowerCase()];
            if (jsonValue !== undefined && jsonValue !== null) return String(jsonValue);
          }
          // YAML frontmatter wins; fall back to bold-prefixed line only for legacy projects.
          if (frontmatter[n.toLowerCase()] !== undefined) return frontmatter[n.toLowerCase()];
          if (isSharedProject) return null;
          const m = content.match(new RegExp(`^\\*\\*${n}\\*\\*:\\s*(.+)$`, "m"));
          return m ? m[1].trim() : null;
        };
        const msX = (content.match(/^- \[x\]/gim) || []).length;
        const msO = (content.match(/^- \[ \]/gm) || []).length;
        projects.push({
          name: field("Id") || name.replace(/\.(md|json)$/, ""),
          path: relPath,
          owner: field("Owner") || fallbackOwner,
          status: field("Status") || "unknown",
          priority: field("Priority"),
          iteration: parseInt(field("Iteration") || "0", 10),
          health: field("Health"),
          type: field("Type") || null,
          formatErrors: jsonProject ? [] : formatErrors,
          milestonesDone: msX,
          milestonesTotal: msX + msO,
          metrics: (() => {
            const mIdx = content.indexOf("## Metrics\n");
            if (mIdx === -1) return [];
            const after = content.slice(mIdx + "## Metrics\n".length);
            const ns = after.indexOf("\n## ");
            const section = (ns === -1 ? after : after.slice(0, ns)).trim();
            const ids = section.split("\n").filter((l: string) => l.startsWith("- ")).map((l: string) => {
              const m = l.match(/^- `?(\S+?)`?:/);
              const t = l.match(/target\s*([<>]=?\s*)?(\d[\d.]*%?)/);
              return m ? { id: m[1].replace(/`/g, ""), target: t ? (t[1] || "") + t[2] : null } : null;
            }).filter(Boolean) as Array<{id: string; target: string | null}>;
            if (ids.length === 0) return [];
            try {
              const db = _db();
              return ids.map(({ id, target }) => {
                const row = db.prepare("SELECT current, threshold, alert_op FROM metrics WHERE id = ?").get(id) as any;
                const current = row?.current ?? null;
                const threshold = row?.threshold;
                const above = row?.alert_op === "above" || row?.alert_op === ">";
                const breached = threshold != null && current != null && (above ? current > threshold : current < threshold);
                return { id, current, target, breached };
              });
            } catch { return ids.map(({ id, target }) => ({ id, current: null, target, breached: false })); }
          })(),
          updatedAt: statSync(projectFile).mtimeMs,
        });
      } catch { /* skip */ }
    };

    try {
      // Scan first-class projects.
      const seen = new Set<string>();
      const scanSharedProjectsDir = (dir: string, relPrefix: string) => {
        if (!existsSync(dir)) return;
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          if (!entry.isDirectory()) continue;
          if (seen.has(entry.name)) continue;
          const projectMd = join(dir, entry.name, "project.md");
          const projectJson = join(dir, entry.name, "project.json");
          const projectFile = existsSync(projectMd) ? projectMd : existsSync(projectJson) ? projectJson : "";
          if (!existsSync(projectFile)) continue;
          const relPath = `${relPrefix}/${entry.name}`;
          seen.add(entry.name);
          processProject(projectFile, relPath, entry.name, "unknown");
        }
      };
      scanSharedProjectsDir(PROJECTS_ROOT, "projects");

      // Scan legacy per-agent locations
      for (const dir of readdirSync(AGENTS_ROOT, { withFileTypes: true })) {
        if (!dir.isDirectory() || dir.name.startsWith(".") || dir.name === "shared") continue;
        const projDir = join(AGENTS_ROOT, dir.name, "workspace", "projects");
        if (!existsSync(projDir)) continue;
        for (const entry of readdirSync(projDir, { withFileTypes: true })) {
          if (!entry.isDirectory()) continue;
          const projectFile = join(projDir, entry.name, "project.md");
          if (!existsSync(projectFile)) continue;
          const relPath = `agents/${dir.name}/workspace/projects/${entry.name}`;
          processProject(projectFile, relPath, entry.name, dir.name);
        }
      }
    } catch { /* skip */ }
    return json(projects);
  }

  function handleProjectJournal(url: URL): Response {
    const path = url.searchParams.get("path");
    if (!path) return json({ error: "path required" }, 400);
    const journalPath = resolve(resolveProjectDir(path), "journal.md");
    try {
      return json({ content: readFileSync(journalPath, "utf-8") });
    } catch {
      return json({ content: "(No journal found)" });
    }
  }

  function handleProjectDiscussion(url: URL): Response {
    const path = url.searchParams.get("path");
    if (!path) return json({ error: "path required" }, 400);
    const discPath = resolve(resolveProjectDir(path), "discussion.md");
    try {
      return json({ content: readFileSync(discPath, "utf-8") });
    } catch {
      return json({ content: "(No discussion yet)" });
    }
  }

  function handleProjectContent(url: URL): Response {
    const path = url.searchParams.get("path");
    if (!path) return json({ error: "path required" }, 400);
    if (!isAllowedProjectPath(path)) return json({ error: "Access denied" }, 403);
    const filePath = resolveProjectFile(path);
    try {
      const content = readFileSync(filePath, "utf-8");
      return json({ content });
    } catch {
      return json({ content: "(No project file found)" });
    }
  }

  function handleProjectArtifact(url: URL): Response {
    const path = url.searchParams.get("path");
    const file = url.searchParams.get("file");
    if (!path) return json({ error: "path required" }, 400);
    if (!file) return json({ error: "file required" }, 400);
    if (path.endsWith(".md")) return json({ error: "artifact reads require a project directory path" }, 400);
    if (!isAllowedProjectPath(path)) return json({ error: "Access denied" }, 403);
    if (file.startsWith("/") || file.includes("\0") || file.split(/[\\/]+/).includes("..")) {
      return json({ error: "invalid file path" }, 400);
    }

    const projectDir = resolveProjectDir(path);
    const artifactPath = resolve(projectDir, file);
    if (artifactPath !== projectDir && !artifactPath.startsWith(`${projectDir}/`)) {
      return json({ error: "Access denied" }, 403);
    }

    try {
      const content = readFileSync(artifactPath, "utf-8");
      return json({ content });
    } catch {
      return json({ error: "Artifact not found" }, 404);
    }
  }

  function handleProjectTasks(url: URL): Response {
    const path = url.searchParams.get("path");
    if (!path) return json({ error: "path required" }, 400);
    if (!isAllowedProjectPath(path)) return json({ error: "Access denied" }, 403);

    const projectDir = resolveProjectDir(path);
    const appDir = projectAppDirForPath(path);
    let treePath = appDir ? ensureTaskTreeState(appDir).path : resolve(projectDir, "tasks", "tree.json");
    if (treePath !== projectDir && !treePath.startsWith(`${projectDir}/`)) {
      if (!appDir || (treePath !== appDir && !treePath.startsWith(`${appDir}/`))) return json({ error: "Access denied" }, 403);
    }

    if (!existsSync(treePath)) {
      return json({
        available: false,
        path,
        treePath: appDir ? `${projectNameFromPath(path)}.app/.state/tasks/tree.json` : "tasks/tree.json",
        reason: "Project does not expose a task tree yet.",
      });
    }

    try {
      const tree = JSON.parse(readFileSync(treePath, "utf-8"));
      return json(buildProjectTasksReadModel(tree, { path, treePath: appDir ? ".state/tasks/tree.json" : "tasks/tree.json" }));
    } catch (e) {
      return json({
        available: false,
        path,
        treePath: appDir ? ".state/tasks/tree.json" : "tasks/tree.json",
        reason: "Task tree JSON could not be parsed.",
        errors: [e instanceof Error ? e.message : String(e)],
      });
    }
  }

  /**
   * GET /api/projects/detail?path=<projectPath> — dense rollup for the
   * project detail page header. Replaces the operator's eyeballing of
   * project.md frontmatter / scrolling for goals.
   *
   * Returns:
   *   {
   *     path, name, owner,                  — identity
   *     frontmatter: {...},                  — raw parsed YAML
   *     status, iteration, priority,         — promoted from frontmatter
   *     goal: string|null,                  — first ## Goal section content
   *     milestonesDone, milestonesTotal,    — counted from '- [ ]' / '- [x]'
   *     citedMetrics: [string],             — metric-id-shaped tokens in body
   *     ownedMetrics: [Metric],             — metrics where project=<id>
   *     sessionCount, recentSessions: [..], — from sessions table
   *     updatedAt, createdAt,               — file mtime / ctime
   *   }
   */
  function handleProjectDetail(url: URL): Response {
    const path = url.searchParams.get("path");
    if (!path) return json({ error: "path required" }, 400);
    if (!isAllowedProjectPath(path)) return json({ error: "Access denied" }, 403);
    const filePath = resolveProjectFile(path);
    if (!existsSync(filePath)) return json({ error: "not found" }, 404);

    let content = "";
    let stat: { mtimeMs: number; ctimeMs: number } | null = null;
    try {
      content = readFileSync(filePath, "utf-8");
      stat = statSync(filePath);
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
    let jsonProject = content.trim().startsWith("{")
      ? (() => { try { return JSON.parse(content) as Record<string, any>; } catch { return null; } })()
      : null;
    const appDirForDetail = projectAppDirForPath(path);
    if (appDirForDetail && jsonProject) {
      jsonProject = loadProjectReadModel(appDirForDetail) as Record<string, any>;
    }

    // Parse frontmatter ("---\n...\n---").
    const frontmatter: Record<string, string> = {};
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n?/);
    let body = content;
    if (fmMatch) {
      body = content.slice(fmMatch[0].length);
      for (const ln of fmMatch[1].split("\n")) {
        const kv = ln.match(/^([a-zA-Z_][a-zA-Z0-9_-]*):\s*(.+?)\s*$/);
        if (kv) frontmatter[kv[1]] = kv[2];
      }
    }

    // Derive identity. Canonical projectId is owner/name, even for shared path.
    const identity = parseProjectIdentity(path, content);
    const owner = frontmatter.owner || identity.owner;
    const projectName = identity.name;
    const projectId = `${owner}/${projectName}`;

    // Extract common summary sections (everything until the next "##").
    const goal = jsonProject && typeof jsonProject.goal === "string"
      ? jsonProject.goal
      : extractMarkdownSection(body, "Goal");
    const currentState = jsonProject
      ? typeof jsonProject.currentState === "string"
        ? jsonProject.currentState
        : typeof jsonProject.currentState?.summary === "string"
        ? jsonProject.currentState.summary
        : null
      : extractMarkdownSection(body, "Current State");

    // Count milestones: lines like '- [ ] foo' / '- [x] foo' anywhere in body.
    const checkboxes = body.match(/^[\s\-*]*\[[ xX]\]/gm) || [];
    const milestonesTotal = checkboxes.length;
    const milestonesDone = (body.match(/^[\s\-*]*\[[xX]\]/gm) || []).length;

    // Find metric-id-shaped backtick tokens in the body.
    const cited = new Set<string>();
    const re = /`([a-z]+(?:\.[a-z0-9-]+)+)`/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body)) !== null) {
      // Only keep tokens that look like our metric IDs (start with a known
      // axis prefix). Limits noise (e.g., file paths like 'foo.md').
      const tok = m[1];
      if (/^(metric|capability|project|handler|session|evaluator|agent|system|v2)\./.test(tok)) cited.add(tok);
    }

    // Resolve owned metrics + cited-metrics-that-exist via DB.
    const db = _db();
    let ownedMetrics: Array<Record<string, unknown>> = [];
    let citedMetricsResolved: Array<Record<string, unknown>> = [];
    try {
      ownedMetrics = db.prepare(`SELECT id, name, current, threshold, alert_op, unit, priority, type FROM metrics WHERE project = ?`).all(projectName) as any[];
      if (cited.size > 0) {
        const placeholders = [...cited].map(() => "?").join(",");
        citedMetricsResolved = db.prepare(`SELECT id, name, current, threshold, alert_op, unit, priority, type FROM metrics WHERE id IN (${placeholders})`).all(...[...cited]) as any[];
      }
    } catch { /* tolerate missing column */ }

    // Recent sessions for this project. Two-tier:
    //   tier 1: rows tagged with projectId (canonical)
    //   tier 2: rows whose task mentions the project name (best-effort)
    let recentSessions: Array<Record<string, unknown>> = [];
    let sessionCount = 0;
    let mentionCount = 0;
    try {
      const tagged = db.prepare(
        `SELECT sessionId, agent, status, startedAt, endedAt, task FROM sessions WHERE projectId = ? ORDER BY startedAt DESC LIMIT 10`
      ).all(projectId) as any[];
      for (const r of tagged) recentSessions.push({ ...r, link: "tagged" });
      const cnt = db.prepare(`SELECT COUNT(*) as c FROM sessions WHERE projectId = ?`).get(projectId) as any;
      sessionCount = cnt?.c ?? 0;
      // Tier 2 — only if tagged is short.
      if (tagged.length < 10 && projectName.length >= 6) {
        const seen = new Set(tagged.map(t => t.sessionId));
        const mentions = db.prepare(
          `SELECT sessionId, agent, status, startedAt, endedAt, task FROM sessions WHERE (projectId IS NULL OR projectId = '') AND task LIKE ? ORDER BY startedAt DESC LIMIT 10`
        ).all(`%${projectName}%`) as any[];
        for (const r of mentions) {
          if (!seen.has(r.sessionId)) recentSessions.push({ ...r, link: "mention" });
        }
        const mcnt = db.prepare(
          `SELECT COUNT(*) as c FROM sessions WHERE (projectId IS NULL OR projectId = '') AND task LIKE ?`
        ).get(`%${projectName}%`) as any;
        mentionCount = mcnt?.c ?? 0;
      }
    } catch { /* skip */ }

    return json({
      path,
      name: projectName,
      owner,
      projectId,
      frontmatter,
      status: jsonProject?.status || frontmatter.status || null,
      iteration: jsonProject?.iteration ? Number(jsonProject.iteration) : frontmatter.iteration ? Number(frontmatter.iteration) : 0,
      priority: jsonProject?.priority || frontmatter.priority || null,
      type: jsonProject?.type || frontmatter.type || null,
      workflow: frontmatter.workflow || null,
      goal,
      currentState,
      milestonesTotal,
      milestonesDone,
      citedMetrics: [...cited],
      ownedMetrics,
      citedMetricsResolved,
      sessionCount,
      mentionCount,
      recentSessions,
      app: (() => {
        const appDir = projectAppDirForPath(path);
        if (!appDir) return null;
        return {
          appDirName: appDir.split("/").pop(),
          hasUi: existsSync(resolve(appDir, "ui", "index.html")),
          actions: extractProjectAppActions(appDir),
        };
      })(),
      updatedAt: stat ? Math.floor(stat.mtimeMs) : null,
      createdAt: stat ? Math.floor(stat.ctimeMs) : null,
    });
  }

  /**
   * GET /api/projects/lineage?path=<projectPath> — every session that
   * causally touched this project, deduplicated, with provenance.
   *
   * The premise: there is no single source of truth for 'sessions in a
   * project'. Only ~27% of sessions have sessions.projectId set (the
   * canonical tag, only populated by workflow dispatch). The rest of
   * the lineage emerges from 5 independent signals combined:
   *
   *   tier 1 (tagged):    sessions.projectId = <owner>/<name>
   *   tier 2 (workflow):  sessions.workflowRunId in (runs tagged with
   *                       projectId, or legacy runs whose task mentions
   *                       the project path)
   *   tier 3 (file-read): file_reads.filePath like %/<name>/% — the
   *                       session opened a file inside the project dir.
   *                       This is *strong* signal even if the session
   *                       was a heartbeat (agent literally looked).
   *   tier 4 (mention):   sessions.task like %<name>% — weakest, only
   *                       used if name is distinctive (length ≥ 6).
   *   tier 5 (children):  sessions.parentSessionId in (any of above)
   *                       — recursive descent so worker sessions show
   *                       up under their master.
   *
   * Output: deduplicated by sessionId, sorted by startedAt, each session
   * carries its `link` provenance (highest-confidence wins on dedup).
   * Returns parentSessionId so the frontend can render a tree.
   *
   * Scale: 15k sessions · 6k file_reads · 8k workflow_runs. All queries
   * indexed-or-bounded; tier 4 LIKE %name% is the slowest (~5–10ms).
   * Total budget: <50ms for any project. Acceptable for review UX.
   */
  function handleProjectLineage(url: URL): Response {
    const path = url.searchParams.get("path");
    if (!path) return json({ error: "path required" }, 400);
    if (!isAllowedProjectPath(path)) return json({ error: "Access denied" }, 403);

    let content = "";
    try { content = readFileSync(resolveProjectFile(path), "utf-8"); } catch {}
    const { name, projectId } = parseProjectIdentity(path, content);

    // link confidence ranking; lower = stronger.
    const RANK: Record<string, number> = { tagged: 0, workflow: 1, "file-read": 2, child: 3, mention: 4 };
    const byId = new Map<string, any>();
    const accept = (row: any, link: string) => {
      if (!row?.sessionId) return;
      const existing = byId.get(row.sessionId);
      if (!existing || RANK[link] < RANK[existing.link]) {
        byId.set(row.sessionId, { ...row, link });
      }
    };

    const SELECT = `SELECT sessionId, agent, status, kind, source, parentSessionId, workflowRunId, projectId, startedAt, endedAt, opCount, outcome, task FROM sessions`;
    const db = _db();

    try {
      // tier 1: tagged.
      for (const r of db.prepare(`${SELECT} WHERE projectId = ? ORDER BY startedAt DESC LIMIT 200`).all(projectId) as any[]) {
        accept(r, "tagged");
      }

      // tier 2: workflow_runs tagged with this project, plus legacy runs
      // whose task mentions the project path or name.
      // Project path appears in master-worker tasks like 'project: /app/projects/<name>'.
      const runRows = db.prepare(
        `SELECT runId FROM workflow_runs WHERE projectId = ? OR task LIKE ? OR task LIKE ? LIMIT 200`
      ).all(projectId, `%${path}%`, `%projects/${name}%`) as Array<{ runId: string }>;
      if (runRows.length > 0) {
        const placeholders = runRows.map(() => "?").join(",");
        const ids = runRows.map(r => r.runId);
        for (const r of db.prepare(`${SELECT} WHERE workflowRunId IN (${placeholders}) ORDER BY startedAt DESC LIMIT 200`).all(...ids) as any[]) {
          accept(r, "workflow");
        }
      }

      // tier 3: file_reads of any file inside the project dir.
      // filePath patterns vary: '/app/projects/<name>/...', './agents/...', 'agents/...'
      const readRows = db.prepare(
        `SELECT DISTINCT sessionId FROM file_reads WHERE filePath LIKE ? OR filePath LIKE ? OR filePath LIKE ? LIMIT 500`
      ).all(
        `%/projects/${name}/%`,
        `%projects/${name}/%`,
        `%${path}/%`,
      ) as Array<{ sessionId: string }>;
      if (readRows.length > 0) {
        const placeholders = readRows.map(() => "?").join(",");
        const ids = readRows.map(r => r.sessionId);
        for (const r of db.prepare(`${SELECT} WHERE sessionId IN (${placeholders}) ORDER BY startedAt DESC LIMIT 500`).all(...ids) as any[]) {
          accept(r, "file-read");
        }
      }

      // tier 4: task mention. Only if name is distinctive.
      if (name.length >= 6) {
        for (const r of db.prepare(`${SELECT} WHERE task LIKE ? AND (projectId IS NULL OR projectId != ?) ORDER BY startedAt DESC LIMIT 100`).all(`%${name}%`, projectId) as any[]) {
          accept(r, "mention");
        }
      }

      // tier 5: children of any session above (one-level descent; recursive
      // descent left for later if needed). parentSessionId is barely populated
      // today (5 rows) but if it grows this is the hook.
      const ids = [...byId.keys()];
      if (ids.length > 0 && ids.length <= 200) {
        const placeholders = ids.map(() => "?").join(",");
        for (const r of db.prepare(`${SELECT} WHERE parentSessionId IN (${placeholders}) ORDER BY startedAt DESC LIMIT 200`).all(...ids) as any[]) {
          accept(r, "child");
        }
      }
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }

    // Sort by startedAt asc (oldest first — timeline reads top-down).
    const sessions = [...byId.values()].sort((a, b) => (a.startedAt || 0) - (b.startedAt || 0));

    // Counts by link for the header chips.
    const byLink: Record<string, number> = { tagged: 0, workflow: 0, "file-read": 0, child: 0, mention: 0 };
    for (const s of sessions) byLink[s.link] = (byLink[s.link] || 0) + 1;

    // Optionally pull session_digests for first N sessions — inline review fuel.
    // Capped to 30 to keep payload reasonable; the rest can be fetched on click.
    const digestIds = sessions.slice(0, 30).map(s => s.sessionId);
    const digestsBySession: Record<string, any[]> = {};
    if (digestIds.length > 0) {
      try {
        const placeholders = digestIds.map(() => "?").join(",");
        const rows = db.prepare(
          `SELECT sessionId, step, trigger, what_happened, outcome, still_open, action, action_reason, created_at FROM session_digests WHERE sessionId IN (${placeholders}) ORDER BY sessionId, step`
        ).all(...digestIds) as any[];
        for (const d of rows) {
          if (!digestsBySession[d.sessionId]) digestsBySession[d.sessionId] = [];
          digestsBySession[d.sessionId].push(d);
        }
      } catch { /* digest table may differ */ }
    }

    return json({
      path,
      projectId,
      total: sessions.length,
      byLink,
      sessions,
      digestsBySession,
    });
  }

  function handleProjectSessions(url: URL): Response {
    const path = url.searchParams.get("path");
    if (!path) return json({ error: "path required" }, 400);
    if (!isAllowedProjectPath(path)) return json({ error: "Access denied" }, 403);
    // Canonical projectId is owner/name, even for shared path.
    let content = "";
    try { content = readFileSync(resolveProjectFile(path), "utf-8"); } catch {}
    const { name, projectId } = parseProjectIdentity(path, content);

    // Two-tier query:
    //   tier 1 = sessions where projectId column is set (canonical — tagged at
    //            dispatch time by the workflow runtime)
    //   tier 2 = sessions where the task body mentions the project name
    //            (best-effort — catches heartbeat sessions that reference the
    //            project but weren't dispatched through it)
    // Always return both, with `link` field marking provenance so the UI
    // can distinguish 'work done on this project' vs 'mentioned this project'.
    const sessions: any[] = [];
    try {
      const db = _db();
      const tagged = db.prepare(
        "SELECT sessionId, agent, status, opCount, startedAt, endedAt, task FROM sessions WHERE projectId = ? ORDER BY startedAt DESC LIMIT 50"
      ).all(projectId) as any[];
      for (const r of tagged) sessions.push({ ...r, link: "tagged" });
      // Tier 2: only if tagged is short, look for task mentions. Cap the
      // scan so big DBs don't get slow; project names are typically distinctive
      // (e.g. 'evaluator-low-quality-rate-calibration') so LIKE %name% is safe.
      if (tagged.length < 20 && name.length >= 6) {
        const seen = new Set(tagged.map(t => t.sessionId));
        const mentions = db.prepare(
          "SELECT sessionId, agent, status, opCount, startedAt, endedAt, task FROM sessions WHERE (projectId IS NULL OR projectId = '') AND task LIKE ? ORDER BY startedAt DESC LIMIT 30"
        ).all(`%${name}%`) as any[];
        for (const r of mentions) {
          if (!seen.has(r.sessionId)) sessions.push({ ...r, link: "mention" });
        }
      }
    } catch { /* projectId column may not exist */ }

    if (sessions.length > 0) return json(sessions);

    // Final fallback: scan workflow run files (legacy path).
    const searchPaths = [path, path.replace(/^agents\//, "")];
    for (const dir of [join(STATE_DIR, "workflow-runs"), join(STATE_DIR, "workflows")]) {
      try {
        for (const f of readdirSync(dir)) {
          try {
            const run = JSON.parse(readFileSync(join(dir, f), "utf-8"));
            if (searchPaths.some(sp => run.task?.includes(sp))) {
              for (const step of run.steps ?? []) {
                if (step.sessionId) sessions.push({ sessionId: step.sessionId, agent: step.agent, status: step.status, startedAt: step.startedAt, task: step.task?.slice(0, 80), link: "workflow-file" });
              }
            }
          } catch { /* skip corrupted files */ }
        }
      } catch { /* dir may not exist */ }
    }
    return json(sessions);
  }

  async function handleProjectComment(req: Request): Promise<Response> {
    try {
      const body = await req.json() as { path?: string; comment?: string };
      const { path, comment } = body;
      if (!path || !comment) return json({ error: "path and comment required" }, 400);
      if (!isAllowedProjectPath(path)) return json({ error: "Access denied" }, 403);

      const projectFile = resolveProjectFile(path);
      if (!existsSync(projectFile)) return json({ error: "Project not found" }, 404);
      const projectContent = readFileSync(projectFile, "utf-8");
      const { projectId, owner } = parseProjectIdentity(path, projectContent);
      const sentAt = Date.now();

      const trigger = await sendDaemonFrame({
        type: "project.comment.created",
        source: "web-ui",
        owner: normalizeEventOwner(owner),
        data: {
          projectPath: path,
          comment,
          author: "hao",
        },
      });
      if (!trigger.ok) return json({ ok: false, triggered: false, error: trigger.error }, 503);

      let workflow = await waitForProjectWorkflowStart(projectId, path, sentAt, 1500);
      let fallbackTriggered = false;
      if (!workflow) {
        const fallback = await sendDaemonFrame({
          type: "trigger.project",
          source: "web-ui",
          owner: normalizeEventOwner(owner),
          data: {
            projectPath: path,
            reason: "comment-created-fallback",
          },
        });
        fallbackTriggered = fallback.ok;
        workflow = await waitForProjectWorkflowStart(projectId, path, sentAt, 2500);
      }

      return json({
        ok: true,
        triggered: true,
        workflowStarted: Boolean(workflow),
        workflowRunId: workflow?.runId ?? null,
        workflowStatus: workflow?.status ?? null,
        fallbackTriggered,
      }, workflow ? 200 : 202);
    } catch (e: any) {
      return json({ error: e.message }, 500);
    }
  }

  async function waitForProjectWorkflowStart(
    projectId: string,
    projectPath: string,
    sinceMs: number,
    timeoutMs: number,
  ): Promise<{ runId: string; status: string } | null> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const found = findProjectWorkflowStart(projectId, projectPath, sinceMs - 250);
      if (found) return found;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return findProjectWorkflowStart(projectId, projectPath, sinceMs - 250);
  }

  function findProjectWorkflowStart(
    projectId: string,
    projectPath: string,
    sinceMs: number,
  ): { runId: string; status: string } | null {
    try {
      const rows = _db().prepare(
        `SELECT runId, status, task, projectId, startedAt
         FROM workflow_runs
         WHERE startedAt >= ?
           AND workflow = 'project'
           AND (projectId = ? OR task LIKE ?)
         ORDER BY startedAt DESC
         LIMIT 10`
      ).all(sinceMs, projectId, `%${normalizeProjectPathForCompare(projectPath)}%`) as Array<{
        runId?: string;
        status?: string;
        task?: string | null;
        projectId?: string | null;
      }>;
      for (const row of rows) {
        if (row.projectId === projectId || projectPathsMatch(row.task ?? "", projectPath) || String(row.task ?? "").includes(normalizeProjectPathForCompare(projectPath))) {
          return { runId: row.runId ?? "", status: row.status ?? "running" };
        }
      }
    } catch {
      // DB confirmation is best-effort; caller already sent the daemon event.
    }
    return null;
  }

  function handleEvents(url: URL): Response {
    const db = _db();
    const limit = parseInt(url.searchParams.get("limit") || "100", 10);
    const owner = url.searchParams.get("owner");
    const eventType = url.searchParams.get("type");
    let query = "SELECT * FROM events";
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (owner) { conditions.push("owner = ?"); params.push(owner); }
    if (eventType) { conditions.push("event_type = ?"); params.push(eventType); }
    if (conditions.length) query += " WHERE " + conditions.join(" AND ");
    query += " ORDER BY timestamp DESC LIMIT ?";
    params.push(limit);
    try {
      const rows = db.prepare(query).all(...params);
      return json(rows);
    } catch {
      return json([]); // table may not exist yet
    }
  }

  function handleEventDeliveryHealth(url: URL): Response {
    const db = _db();
    const now = Date.now();
    const lookbackMs = Math.max(1, Math.min(24 * 60 * 60_000, Number(url.searchParams.get("lookbackMs") || 6 * 60 * 60_000)));
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") || 25)));
    const since = now - lookbackMs;
    const pendingTtlMs = 2 * 60_000;
    const eventColumns =
      `id, event_type as eventType, source, owner, timestamp, ttl_ms as ttlMs,
       delivery_status as deliveryStatus, accepted_by as acceptedBy,
       accepted_at as acceptedAt, delivery_route as deliveryRoute,
       delivery_note as deliveryNote, data`;
    const pairColumns =
      `p.id, p.pair_name as pairName, p.correlation_key as correlationKey,
       p.open_event_id as openEventId, p.close_event_id as closeEventId,
       p.owner, p.status, p.opened_at as openedAt,
       p.expected_close_at as expectedCloseAt, p.closed_at as closedAt,
       p.note, e.event_type as openEventType, e.source as openEventSource,
       e.data as openEventData`;
    try {
      const eventSchema = db.prepare("PRAGMA table_info(events)").all() as Array<{ name?: string }>;
      const eventColumnsSet = new Set(eventSchema.map((row) => row.name).filter(Boolean));
      const pairTable = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'event_pair_runs'").get();
      if (!eventColumnsSet.has("delivery_status") || !eventColumnsSet.has("delivery_route") || !pairTable) {
        return json({
          now,
          since,
          lookbackMs,
          schemaReady: false,
          note: "event delivery schema is not migrated in this state database yet",
          ownerInboxOpenCount: 0,
          unhandledEvents: [],
          overduePendingEvents: [],
          orphanPairs: [],
          overdueOpenPairs: [],
        });
      }
      const unhandledEvents = db.prepare(
        `SELECT ${eventColumns}
         FROM events
         WHERE delivery_status = 'unhandled'
           AND timestamp >= ?
         ORDER BY timestamp DESC, id DESC
         LIMIT ?`
      ).all(since, limit);
      const overduePendingEvents = db.prepare(
        `SELECT ${eventColumns}
         FROM events
         WHERE delivery_status = 'pending'
           AND timestamp >= ?
           AND timestamp + COALESCE(ttl_ms, ?) < ?
         ORDER BY timestamp DESC, id DESC
         LIMIT ?`
      ).all(since, pendingTtlMs, now, limit);
      const orphanPairs = db.prepare(
        `SELECT ${pairColumns}
         FROM event_pair_runs p
         LEFT JOIN events e ON e.id = p.open_event_id
         WHERE p.status = 'orphan'
           AND p.opened_at >= ?
         ORDER BY p.expected_close_at ASC, p.id ASC
         LIMIT ?`
      ).all(since, limit);
      const overdueOpenPairs = db.prepare(
        `SELECT ${pairColumns}
         FROM event_pair_runs p
         LEFT JOIN events e ON e.id = p.open_event_id
         WHERE p.status = 'open'
           AND p.opened_at >= ?
           AND p.expected_close_at < ?
         ORDER BY p.expected_close_at ASC, p.id ASC
         LIMIT ?`
      ).all(since, now, limit);
      const ownerInbox = db.prepare(
        `SELECT COUNT(*) as count
         FROM event_pair_runs
         WHERE pair_name = 'owner_inbox'
           AND status = 'open'`
      ).get() as { count?: number } | null;

      return json({
        now,
        since,
        lookbackMs,
        schemaReady: true,
        ownerInboxOpenCount: Number(ownerInbox?.count ?? 0),
        unhandledEvents,
        overduePendingEvents,
        orphanPairs,
        overdueOpenPairs,
      });
    } catch (error) {
      return json({
        now,
        since,
        lookbackMs,
        schemaReady: false,
        ownerInboxOpenCount: 0,
        unhandledEvents: [],
        overduePendingEvents: [],
        orphanPairs: [],
        overdueOpenPairs: [],
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  function objectRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  }

  function stringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }

  function safeId(prefix: string): string {
    const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 17);
    return `${prefix}_${stamp}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function writeProjectJsonFile(projectDir: string, relativePath: string, value: unknown): void {
    const filePath = resolve(projectDir, relativePath);
    if (filePath !== projectDir && !filePath.startsWith(`${projectDir}/`)) {
      throw new Error(`Refusing to write outside project: ${relativePath}`);
    }
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
  }

  function appendProjectJsonl(projectDir: string, relativePath: string, value: unknown): void {
    const filePath = resolve(projectDir, relativePath);
    if (filePath !== projectDir && !filePath.startsWith(`${projectDir}/`)) {
      throw new Error(`Refusing to write outside project: ${relativePath}`);
    }
    mkdirSync(dirname(filePath), { recursive: true });
    appendFileSync(filePath, `${JSON.stringify(value)}\n`, "utf-8");
  }

  function dispatchFeatureTestRunner(input: {
    projectDir: string;
    requestId: string;
    runId: string;
    featureId: string;
    specId: string;
    target: Record<string, unknown>;
    params: Record<string, unknown>;
  }): { dispatched: boolean; phase: string; pid?: number; reason?: string } {
    const { projectDir, requestId, runId, featureId, specId, target, params } = input;
    const supportedProject = projectDir.endsWith("/projects/alpha-project");
    const environment = typeof target.environment === "string" ? target.environment.toLowerCase() : "";
    const surface = typeof target.surface === "string"
      ? target.surface.toLowerCase()
      : typeof target.clientSurface === "string"
      ? target.clientSurface.toLowerCase()
      : "";
    const liveRun = params.liveRun === true;
    const gatedLiveRun = params.gatedLiveRun === true;
    const supportedManagedSystemSpecs = new Set([
      "spec.managedsystem.rest-add-existing.minimal-rest",
      "spec.managedsystem.field-rejection-matrix",
      "spec.managedsystem.delete-existing",
      "spec.managedsystem.runtime-restrictions",
      "spec.managedsystem.single-pool-constraint",
      "spec.managedsystem.reconcile-preservation",
    ]);
    const supported = supportedProject
      && featureId === "managedsystem-pool"
      && supportedManagedSystemSpecs.has(specId)
      && environment === "staging"
      && (surface === "rest" || surface === "arm-rest")
      && liveRun
      && gatedLiveRun;

    if (!supported) {
      const missing = [
        supportedProject ? "" : "project is not alpha-project",
        featureId === "managedsystem-pool" ? "" : `unsupported feature ${featureId || "unknown"}`,
        supportedManagedSystemSpecs.has(specId) ? "" : `unsupported spec ${specId || "unknown"}`,
        environment === "staging" ? "" : `unsupported environment ${environment || "unknown"}`,
        surface === "rest" || surface === "arm-rest" ? "" : `unsupported surface ${surface || "unknown"}`,
        liveRun ? "" : "liveRun gate missing",
        gatedLiveRun ? "" : "gatedLiveRun gate missing",
      ].filter(Boolean).join("; ");
      return { dispatched: false, phase: "runner-not-dispatched", reason: missing || "unsupported feature test request" };
    }

    const appDir = projectAppDirForName("alpha-project");
    const runnerPath = resolve(appDir ?? projectDir, "runner", "feature-test-runner.ts");
    if (!existsSync(runnerPath)) {
      return { dispatched: false, phase: "runner-not-found", reason: `runner/feature-test-runner.ts not found` };
    }

    const child = spawn("bun", [
      runnerPath,
      `--request-id=${requestId}`,
      `--run-id=${runId}`,
    ], {
      cwd: projectDir,
      detached: true,
      stdio: "ignore",
      env: {
        ...process.env,
        AKS_RP_E2E_EXECUTION_HOST: "devbox",
      },
    });
    child.unref();
    return { dispatched: true, phase: "runner-dispatched", pid: child.pid };
  }

  function maybeWriteFeatureTestRequest(input: {
    body: Record<string, unknown>;
    data: Record<string, unknown>;
    projectDir: string;
    workflow: { runId?: string | null; status?: string | null } | null;
  }): Record<string, unknown> | null {
    const { body, data, projectDir, workflow } = input;
    const params = objectRecord(data.params);
    const reason = typeof data.reason === "string" ? data.reason : typeof params.eventType === "string" ? params.eventType : "";
    if (reason !== "feature-test.requested") return null;

    const featureId = typeof params.featureId === "string" ? params.featureId : typeof data.featureId === "string" ? data.featureId : "";
    const specId = typeof params.specId === "string" ? params.specId : typeof data.specId === "string" ? data.specId : "";
    if (!featureId || !specId) return { error: "feature-test.requested requires params.featureId and params.specId" };

    const now = new Date().toISOString();
    const requestId = safeId("req");
    const runId = safeId("run");
    const selectedPathIds = stringArray(params.selectedPathIds);
    const featurePathIds = selectedPathIds.length ? selectedPathIds : stringArray(params.featurePathIds);
    const target = objectRecord(params.executionTarget);
    const workflowRunId = workflow?.runId ?? null;
    const workflowStatus = workflow?.status ?? null;
    const status = "queued";
    let phase = workflowRunId ? "owner-workflow-started" : "waiting-runner-dispatch";
    const actor = typeof data.requested_by === "string"
      ? data.requested_by
      : typeof body.owner === "string"
      ? body.owner
      : "feature-page";
    const runnerGate = {
      liveRun: params.liveRun === true,
      gatedLiveRun: params.gatedLiveRun === true,
      acceptedEnvironment: typeof target.environment === "string" ? target.environment : null,
      acceptedSurface: typeof target.surface === "string" ? target.surface : typeof target.clientSurface === "string" ? target.clientSurface : null,
      acceptedBy: actor,
      acceptedAt: now,
      cleanupPlan: "ManagedSystem REST add-existing probe creates an isolated resource group and records resource-group delete/verification.",
    };

    const request = {
      requestId,
      featureId,
      specId,
      featurePathIds,
      target,
      status,
      createdBy: actor,
      createdAt: now,
      updatedAt: now,
      reason: typeof params.prompt === "string" ? params.prompt.split("\n").slice(0, 8).join("\n") : "Feature page requested REST staging replay.",
      runIds: [runId],
      workflowRunId,
      workflowStatus,
      params,
      runnerGate,
      source: {
        eventType: typeof body.type === "string" ? body.type : "project.execution.requested",
        reason,
        source: typeof body.source === "string" ? body.source : "web-ui",
      },
    };
    const runStatus = {
      runId,
      requestId,
      featureId,
      specId,
      featurePathIds,
      target,
      status,
      phase,
      startedAt: null,
      createdAt: now,
      updatedAt: now,
      workflowRunId,
      workflowStatus,
      evidenceDir: `evidence/test-runs/runs/${runId}`,
      resultPath: `evidence/test-runs/runs/${runId}/result.json`,
      diagnosisPath: `evidence/test-runs/runs/${runId}/diagnosis.json`,
      summaryPath: `evidence/test-runs/runs/${runId}/summary.md`,
    };
    const indexRecord = {
      kind: "run",
      requestId,
      runId,
      featureId,
      specId,
      featurePathIds,
      target,
      status,
      phase,
      createdAt: now,
      updatedAt: now,
      workflowRunId,
      workflowStatus,
      requestPath: `evidence/test-runs/requests/${requestId}.json`,
      statusPath: `evidence/test-runs/runs/${runId}/status.json`,
      resultPath: `evidence/test-runs/runs/${runId}/result.json`,
      diagnosisPath: `evidence/test-runs/runs/${runId}/diagnosis.json`,
      summaryPath: `evidence/test-runs/runs/${runId}/summary.md`,
    };

    writeProjectJsonFile(projectDir, `evidence/test-runs/requests/${requestId}.json`, request);
    writeProjectJsonFile(projectDir, `evidence/test-runs/runs/${runId}/request.json`, request);
    writeProjectJsonFile(projectDir, `evidence/test-runs/runs/${runId}/status.json`, runStatus);
    appendProjectJsonl(projectDir, `evidence/test-runs/runs/${runId}/steps.jsonl`, {
      ts: now,
      step: "request.accepted",
      status,
      phase,
      workflowRunId,
      note: workflowRunId
        ? "Feature test request accepted and owner workflow observed."
        : "Feature test request accepted; owner workflow was not observed during the HTTP confirmation window.",
    });
    const summary = [
      `# Feature Test Run ${runId}`,
      "",
      `- request: ${requestId}`,
      `- feature: ${featureId}`,
      `- spec: ${specId}`,
      `- status: ${status}`,
      `- phase: ${phase}`,
      `- workflow: ${workflowRunId || "not observed yet"}`,
      "",
      "This file is created when the feature page requests a test. The runner should update `status.json`, `result.json`, `diagnosis.json`, and this summary after execution.",
      "",
    ].join("\n");
    const summaryPath = resolve(projectDir, `evidence/test-runs/runs/${runId}/summary.md`);
    mkdirSync(dirname(summaryPath), { recursive: true });
    writeFileSync(summaryPath, summary, "utf-8");
    appendProjectJsonl(projectDir, "evidence/test-runs/index.jsonl", indexRecord);

    const runner = dispatchFeatureTestRunner({ projectDir, requestId, runId, featureId, specId, target, params });
    if (runner.dispatched) {
      const dispatchedAt = new Date().toISOString();
      phase = runner.phase;
      const dispatchedStatus = {
        ...runStatus,
        phase,
        updatedAt: dispatchedAt,
        runnerPid: runner.pid,
      };
      writeProjectJsonFile(projectDir, `evidence/test-runs/runs/${runId}/status.json`, dispatchedStatus);
      appendProjectJsonl(projectDir, `evidence/test-runs/runs/${runId}/steps.jsonl`, {
        ts: dispatchedAt,
        step: "runner.dispatched",
        status,
        phase,
        runnerPid: runner.pid,
        note: "Project-local feature test runner dispatched.",
      });
      appendProjectJsonl(projectDir, "evidence/test-runs/index.jsonl", {
        ...indexRecord,
        kind: "run-state",
        phase,
        updatedAt: dispatchedAt,
        runnerPid: runner.pid,
      });
    } else {
      const notDispatchedAt = new Date().toISOString();
      phase = runner.phase;
      const gatedStatus = {
        ...runStatus,
        status: "blocked",
        phase,
        updatedAt: notDispatchedAt,
        runnerDispatchReason: runner.reason,
      };
      writeProjectJsonFile(projectDir, `evidence/test-runs/runs/${runId}/status.json`, gatedStatus);
      appendProjectJsonl(projectDir, `evidence/test-runs/runs/${runId}/steps.jsonl`, {
        ts: notDispatchedAt,
        step: "runner.not-dispatched",
        status: "blocked",
        phase,
        note: runner.reason || "No supported runner adapter matched this request.",
      });
      appendProjectJsonl(projectDir, "evidence/test-runs/index.jsonl", {
        ...indexRecord,
        kind: "run-state",
        status: "blocked",
        phase,
        updatedAt: notDispatchedAt,
        runnerDispatchReason: runner.reason,
      });
    }

    return { requestId, runId, status: runner.dispatched ? status : "blocked", phase, workflowRunId, workflowStatus, runner, indexRecord };
  }

  function maybeWriteFeatureTestFeedback(input: {
    body: Record<string, unknown>;
    data: Record<string, unknown>;
    projectDir: string;
  }): Record<string, unknown> | null {
    const { body, data, projectDir } = input;
    const params = objectRecord(data.params);
    const reason = typeof data.reason === "string" ? data.reason : typeof params.eventType === "string" ? params.eventType : "";
    if (reason !== "feature-test.failure.reviewed") return null;

    const runId = typeof params.runId === "string" ? params.runId : "";
    const requestId = typeof params.requestId === "string" ? params.requestId : "";
    const featureId = typeof params.featureId === "string" ? params.featureId : "";
    const specId = typeof params.specId === "string" ? params.specId : "";
    const action = typeof params.action === "string" ? params.action : "";
    const note = typeof params.note === "string" ? params.note.trim() : "";
    if (!runId || !requestId || !featureId || !specId || !action) {
      return { error: "feature-test.failure.reviewed requires runId, requestId, featureId, specId, and action" };
    }

    const runStatusPath = resolve(projectDir, `evidence/test-runs/runs/${runId}/status.json`);
    if (!runStatusPath.startsWith(`${projectDir}/`) || !existsSync(runStatusPath)) {
      return { error: `run not found: ${runId}` };
    }

    const now = new Date().toISOString();
    const feedbackId = safeId("fb");
    const actor = typeof data.requested_by === "string"
      ? data.requested_by
      : typeof body.owner === "string"
      ? body.owner
      : "feature-page";
    const feedback = {
      feedbackId,
      ts: now,
      actor,
      subject: objectRecord(params.subject),
      context: objectRecord(params.context),
      requestId,
      runId,
      featureId,
      specId,
      action,
      note,
      diagnosis: typeof params.diagnosis === "string" ? params.diagnosis : null,
      blocker: objectRecord(params.blocker),
      next: typeof params.next === "string" ? params.next : null,
      source: {
        eventType: typeof body.type === "string" ? body.type : "project.execution.requested",
        reason,
        source: typeof body.source === "string" ? body.source : "web-ui",
      },
    };

    appendProjectJsonl(projectDir, `evidence/test-runs/runs/${runId}/feedback.jsonl`, feedback);
    appendProjectJsonl(projectDir, `evidence/test-runs/runs/${runId}/steps.jsonl`, {
      ts: now,
      step: "feedback.received",
      status: "reviewed",
      phase: "human-feedback",
      action,
      note,
      feedbackId,
      contextKey: typeof objectRecord(params.context).key === "string" ? objectRecord(params.context).key : null,
    });
    appendProjectJsonl(projectDir, "evidence/test-runs/index.jsonl", {
      kind: "run-feedback",
      requestId,
      runId,
      featureId,
      specId,
      subject: objectRecord(params.subject),
      context: objectRecord(params.context),
      status: "reviewed",
      phase: "human-feedback",
      action,
      feedbackId,
      createdAt: now,
      updatedAt: now,
      statusPath: `evidence/test-runs/runs/${runId}/status.json`,
      feedbackPath: `evidence/test-runs/runs/${runId}/feedback.jsonl`,
      resultPath: `evidence/test-runs/runs/${runId}/result.json`,
      diagnosisPath: `evidence/test-runs/runs/${runId}/diagnosis.json`,
      summaryPath: `evidence/test-runs/runs/${runId}/summary.md`,
    });

    return {
      feedbackId,
      runId,
      requestId,
      status: "reviewed",
      phase: "human-feedback",
      action,
      feedbackPath: `evidence/test-runs/runs/${runId}/feedback.jsonl`,
    };
  }

  async function handleEventIngress(req: Request): Promise<Response> {
    try {
      const body = await req.json() as Record<string, unknown>;
      const type = typeof body.type === "string" ? body.type.trim() : "";
      if (!type) return json({ error: "type required" }, 400);
      const data = body.data && typeof body.data === "object" && !Array.isArray(body.data)
        ? body.data as Record<string, unknown>
        : {};
      const projectPath = typeof data.projectPath === "string"
        ? data.projectPath
        : typeof body.projectPath === "string"
        ? body.projectPath
        : "";

      let projectId = typeof data.projectId === "string" ? data.projectId : "";
      let projectDir = "";
      let owner = typeof body.owner === "string" && body.owner.trim() ? body.owner.trim() : "agent:may";
      if (projectPath) {
        if (!isAllowedProjectPath(projectPath)) return json({ error: "Access denied" }, 403);
        projectDir = resolveProjectDir(projectPath);
        const projectFile = resolveProjectFile(projectPath);
        if (!existsSync(projectFile)) return json({ error: "Project not found" }, 404);
        const identity = parseProjectIdentity(projectPath, readFileSync(projectFile, "utf-8"));
        projectId = projectId || identity.projectId;
        owner = typeof body.owner === "string" && body.owner.trim() ? body.owner.trim() : normalizeEventOwner(identity.owner);
      }

      const sentAt = Date.now();
      const trigger = await sendDaemonFrame({
        ...body,
        type,
        source: typeof body.source === "string" && body.source.trim() ? body.source.trim() : "web-ui",
        owner: normalizeEventOwner(owner),
        data,
      });
      if (!trigger.ok) return json({ ok: false, triggered: false, error: trigger.error }, 503);

      const workflow = type === "project.execution.requested" && projectPath
        ? await waitForProjectWorkflowStart(projectId, projectPath, sentAt, 2500)
        : null;
      const featureTestRequest = projectDir
        ? maybeWriteFeatureTestRequest({ body, data, projectDir, workflow })
        : null;
      if (featureTestRequest && typeof featureTestRequest.error === "string") {
        return json({ ok: false, triggered: true, error: featureTestRequest.error }, 400);
      }
      const featureTestFeedback = projectDir
        ? maybeWriteFeatureTestFeedback({ body, data, projectDir })
        : null;
      if (featureTestFeedback && typeof featureTestFeedback.error === "string") {
        return json({ ok: false, triggered: true, error: featureTestFeedback.error }, 400);
      }
      return json({
        ok: true,
        triggered: true,
        eventType: type,
        reason: typeof data.reason === "string" ? data.reason : null,
        workflowStarted: Boolean(workflow),
        workflowRunId: workflow?.runId ?? null,
        workflowStatus: workflow?.status ?? null,
        featureTestRequest,
        featureTestFeedback,
      }, workflow || type !== "project.execution.requested" ? 200 : 202);
    } catch (e: any) {
      return json({ error: e.message }, 500);
    }
  }

  function handleLoopTrace(url: URL): Response {
    const eventId = url.searchParams.get("eventId");
    const alertId = url.searchParams.get("alertId");
    const metricId = url.searchParams.get("metricId");
    const workflowRunId = url.searchParams.get("workflowRunId");
    const sessionId = url.searchParams.get("sessionId");

    let target: LoopTraceTarget | null = null;
    if (eventId) {
      const id = Number(eventId);
      if (!Number.isFinite(id)) return json({ error: "eventId must be numeric" }, 400);
      target = { eventId: id };
    } else if (alertId) {
      const id = Number(alertId);
      if (!Number.isFinite(id)) return json({ error: "alertId must be numeric" }, 400);
      target = { alertId: id };
    } else if (metricId) {
      target = { metricId };
    } else if (workflowRunId) {
      target = { workflowRunId };
    } else if (sessionId) {
      target = { sessionId };
    }

    if (!target) {
      return json({ error: "one of eventId, alertId, metricId, workflowRunId, or sessionId is required" }, 400);
    }

    return json(buildLoopTrace(_db(), target));
  }

  function json(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  function terminalError(err: unknown): Response {
    const message = err instanceof Error ? err.message : String(err);
    const status = /MAY_WEB_TERMINAL=1/.test(message) ? 403 : 400;
    return json({ error: message }, status);
  }

  async function handleTerminals(): Promise<Response> {
    return json(terminalManager.getStatus());
  }

  async function handleTerminalStart(req: Request): Promise<Response> {
    try {
      const body = await req.json().catch(() => ({})) as { profileId?: string; cols?: number; rows?: number };
      const profileId = body.profileId || "shell";
      await terminalManager.ensureSession(profileId, body.cols, body.rows);
      return json({ ok: true, terminalId: profileId });
    } catch (err) {
      return terminalError(err);
    }
  }

  async function handleTerminalResize(req: Request, terminalId: string): Promise<Response> {
    try {
      const body = await req.json().catch(() => ({})) as { cols?: number; rows?: number };
      terminalManager.resize(terminalId, Number(body.cols), Number(body.rows));
      return json({ ok: true, terminalId });
    } catch (err) {
      return terminalError(err);
    }
  }

  function handleTerminalRestart(terminalId: string): Response {
    try {
      terminalManager.restart(terminalId);
      return json({ ok: true, terminalId });
    } catch (err) {
      return terminalError(err);
    }
  }

  // ── Steering verbs (POST → daemon event socket) ───────────────────
  //
  // The web process does not own the bus or manager. It sends event frames to
  // the daemon and waits only for the daemon's transport ack.
  //
  // Per webui.md "Plane C — Steering verbs": one event per verb, async.

  async function sendDaemonFrame(frame: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
    const socketPath = conventionSocketPath();
    try {
      await sendDaemonEvent(socketPath, frame, { timeoutMs: 2000 });
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: `daemon socket delivery failed at ${socketPath}: ${message}` };
    }
  }

  async function handleSessionCancel(sessionId: string): Promise<Response> {
    if (!sessionId) return json({ error: "sessionId required" }, 400);
    const result = await sendDaemonFrame({
      type: "session.cancel.requested",
      source: "web-ui",
      owner: "agent:may",
      urgency: "high",
      data: { sessionId },
    });
    if (!result.ok) return json({ error: result.error }, 503);
    return json({ ok: true, sessionId });
  }

  async function handleSessionMessage(req: Request, sessionId: string): Promise<Response> {
    if (!sessionId) return json({ error: "sessionId required" }, 400);
    let body: { content?: string };
    try { body = await req.json() as { content?: string }; } catch { return json({ error: "invalid json" }, 400); }
    const content = (body.content ?? "").trim();
    if (!content) return json({ error: "content required" }, 400);
    // The daemon owns active/idle/cold routing: active/idle sessions receive
    // manager.send(); terminal-but-resumable sessions attempt resumeSession().
    const result = await sendDaemonFrame({
      type: "human.input.received",
      source: "web-ui",
      owner: "agent:may",
      data: {
        actor: "human",
        text: content,
        conversation: { channel: "web-ui" },
        target: { sessionId },
      },
    });
    if (!result.ok) return json({ error: result.error }, 503);
    return json({ ok: true, sessionId, deliveredAt: Date.now() });
  }

  /**
   * Resolve the "default chat session" for an agent. Telegram-style: each
   * agent has one persistent thread; this endpoint returns its sessionId.
   *
   * Strategy: pick the most-recently-active session for this agent
   * regardless of status (running/idle/done/error/interrupted). The 3b
   * cold-resume path means even a 'done' session can be woken up by
   * messaging it. Heartbeat / worker / fork-spawn sessions are NOT chat
   * threads (they're throwaway task runs) so we exclude them.
   *
   * Returns {sessionId: null} if no chat thread exists yet — UI can then
   * POST /api/agents/:name/message to spawn one.
   */
  /**
   * GET /api/agents — list all configured agents with rollups for the
   * Agents tab card grid. One row per agent.
   *
   * Aggregates from multiple sources:
   *   - agent.json:        description, model, tool count
   *   - sessions table:    heartbeats4h, last heartbeat, recent session count
   *   - metrics table:     owned-metric count, alerting count
   *   - filesystem scan:   project count for this owner (active+all)
   *
   * Cheap to compute (one query each); not cached. If this becomes a hot
   * path, memoize per ~5s.
   */
  function handleAgents(): Response {
    try {
      const db = _db();
      const fourHourAgo = Date.now() - 4 * 60 * 60 * 1000;
      const dayAgo = Date.now() - 24 * 60 * 60 * 1000;

      // 1. Discover agents from agents/ filesystem AND project-local agents (source of truth: agent.json).
      const agents: Array<Record<string, unknown>> = [];
      const seenAgentNames = new Set<string>();

      const scanAgentsDir = (root: string) => {
        if (!existsSync(root)) return;
        for (const dir of readdirSync(root, { withFileTypes: true })) {
          if (!dir.isDirectory() || dir.name.startsWith(".") || dir.name === "shared") continue;
          const agentJsonPath = join(root, dir.name, "agent.json");
          if (!existsSync(agentJsonPath)) continue;
          let cfg: Record<string, any> = {};
          try { cfg = JSON.parse(readFileSync(agentJsonPath, "utf-8")); } catch { /* skip */ }
          if (cfg.disabled) continue;
          const name = cfg.name || dir.name;
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
      };

      // Scan global agents/
      scanAgentsDir(AGENTS_ROOT);

      // Scan project-local agents from projects/*.app/agents/
      if (existsSync(PROJECTS_ROOT)) {
        for (const entry of readdirSync(PROJECTS_ROOT, { withFileTypes: true })) {
          if (!entry.isDirectory() || !entry.name.endsWith(".app")) continue;
          const appAgentsDir = join(PROJECTS_ROOT, entry.name, "agents");
          scanAgentsDir(appAgentsDir);
        }
      }

      // 2. Per-agent session/metric rollups (single query each, indexed on agent).
      for (const a of agents) {
        const name = a.name as string;

        // Sessions in 4h, partitioned into heartbeat vs other.
        const sess4h = db.prepare(`
          SELECT
            COUNT(*) as total,
            SUM(CASE WHEN COALESCE(kind,'') = 'heartbeat' OR task LIKE '[heartbeat]%' OR task LIKE 'You are %waking up for your heartbeat.%' THEN 1 ELSE 0 END) as heartbeats,
            MAX(startedAt) as lastStart,
            SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors
          FROM sessions WHERE agent = ? AND startedAt >= ?
        `).get(name, fourHourAgo) as any;
        a.sessions4h = sess4h?.total ?? 0;
        a.heartbeats4h = sess4h?.heartbeats ?? 0;
        a.lastSessionAt = sess4h?.lastStart ?? null;
        a.errors4h = sess4h?.errors ?? 0;

        // Sessions in 24h (for context).
        const sess24h = (db.prepare(`SELECT COUNT(*) as c FROM sessions WHERE agent = ? AND startedAt >= ?`).get(name, dayAgo) as any)?.c ?? 0;
        a.sessions24h = sess24h;

        // Owned metrics + breaches.
        const mets = db.prepare(`
          SELECT id, current, threshold, alert_op FROM metrics WHERE owner = ?
        `).all(name) as Array<{id: string; current: number | null; threshold: number | null; alert_op: string | null}>;
        a.metricCount = mets.length;
        a.metricBreached = mets.filter(m => {
          if (m.threshold == null || m.current == null) return false;
          const above = m.alert_op === "above" || m.alert_op === ">";
          return above ? m.current > m.threshold : m.current < m.threshold;
        }).length;
      }

      // 3. Project counts per owner (filesystem scan).
      const projByOwner: Record<string, { active: number; total: number }> = {};
      try {
        const HIDDEN = new Set(["done", "complete", "closed", "waiting", "blocked", "paused"]);
        const scanDir = (root: string, fallbackOwner: string | null) => {
          if (!existsSync(root)) return;
          for (const entry of readdirSync(root, { withFileTypes: true })) {
            if (!entry.isDirectory()) continue;
            const projectFile = join(root, entry.name, "project.md");
            if (!existsSync(projectFile)) continue;
            let owner = fallbackOwner ?? "unknown";
            let status = "unknown";
            try {
              const content = readFileSync(projectFile, "utf-8");
              const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
              if (fmMatch) {
                const oM = fmMatch[1].match(/^owner:\s*(.+?)\s*$/m);
                const sM = fmMatch[1].match(/^status:\s*(.+?)\s*$/m);
                if (oM) owner = oM[1];
                if (sM) status = sM[1];
              }
            } catch { /* skip */ }
            const key = owner;
            if (!projByOwner[key]) projByOwner[key] = { active: 0, total: 0 };
            projByOwner[key].total += 1;
            if (!HIDDEN.has(status)) projByOwner[key].active += 1;
          }
        };
        scanDir(PROJECTS_ROOT, null);
        for (const dir of readdirSync(AGENTS_ROOT, { withFileTypes: true })) {
          if (!dir.isDirectory() || dir.name.startsWith(".") || dir.name === "shared") continue;
          scanDir(join(AGENTS_ROOT, dir.name, "workspace", "projects"), dir.name);
        }
      } catch { /* leave empty */ }
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
   * head: the system-prompt-loaded files (the operator's mental model is
   * 'what does this agent know?'), separated from supplementary files
   * that exist on disk but aren't auto-injected.
   *
   * Source of truth (manager.ts:resolveSystemPrompt):
   *   1. shared/common-sense.md         (shared defaults, every agent)
   *   2. agents/<name>/AGENTS.md         (agent identity; role-specific behavior takes precedence)
   *   3. <runtime metadata block>        (synthesized at session start)
   *   PLUS def.systemPrompt if explicitly set in agent.json (overrides 1+2).
   *
   * Returns:
   *   { name, agentJson,
   *     promptFiles: [{name, path, content, bytes, source}],
   *     otherFiles:  [{name, path, content, bytes}] }
   *
   * If agent.json has an explicit systemPrompt, it's returned in promptFiles
   * as { name: '<inline systemPrompt>', source: 'agent.json' } and the
   * standard files are demoted to otherFiles.
   */
  function handleAgentAbout(agentName: string): Response {
    if (!agentName) return json({ error: "agent required" }, 400);
    const agentDir = resolveRuntimeAgentDirectory(AGENTS_ROOT, agentName, PROJECTS_ROOT)?.dir
      ?? join(AGENTS_ROOT, agentName);
    if (!existsSync(agentDir)) return json({ error: "agent not found" }, 404);
    let agentJson: Record<string, any> | null = null;
    try {
      const cfgPath = join(agentDir, "agent.json");
      if (existsSync(cfgPath)) agentJson = JSON.parse(readFileSync(cfgPath, "utf-8"));
    } catch { /* skip */ }

    const readFile = (path: string, displayName: string, source: string) => {
      if (!existsSync(path)) return null;
      try {
        const content = readFileSync(path, "utf-8");
        return { name: displayName, path: path.replace(STATE_DIR + "/..", "").replace(/^\//, ""), content, bytes: content.length, source };
      } catch { return null; }
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
    // Includes commonly-named convention files; agent decides when to read them.
    // last-eval.md: auto-generated evaluation feedback; inject into prompt so agents see it.
    const lastEval = readFile(join(agentDir, "last-eval.md"), "last-eval.md", "evaluation feedback");
    if (lastEval) promptFiles.push({ ...lastEval, source: "evaluation feedback (auto-generated)" });

    const otherCandidates = ["DOMAIN.md", "heartbeat.md", "context.md", "TOOLS.md", "LESSONS.md"];
    for (const f of otherCandidates) {
      const file = readFile(join(agentDir, f), f, "on-disk only");
      if (file) otherFiles.push(file);
    }

    return json({ name: agentName, agentJson, promptFiles, otherFiles });
  }

  function handleAgentDefaultSession(agentName: string): Response {
    if (!agentName) return json({ error: "agent required" }, 400);
    try {
      const db = _db();
      // Resolve the agent's chat session — only human-initiated conversations,
      // not workflows, heartbeats, or fork-spawned task sessions.
      const row = db.prepare(`
        SELECT sessionId, status, startedAt, kind, substr(task, 1, 200) as task
        FROM sessions
        WHERE agent = ?
          AND (kind = 'chat' OR source IN ('telegram', 'web-ui', 'web', 'cli'))
        ORDER BY startedAt DESC
        LIMIT 1
      `).get(agentName) as { sessionId: string; status: string; startedAt: number; kind: string | null; task: string } | undefined;
      if (!row) return json({ agent: agentName, sessionId: null });
      return json({
        agent: agentName,
        sessionId: row.sessionId,
        status: row.status,
        startedAt: row.startedAt,
        kind: row.kind,
        task: row.task,
      });
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  }

  /**
   * Send a message to an agent. Telegram-style:
   *   1. resolve default session (most-recent non-throwaway)
   *   2. if a session exists, forward to /api/sessions/:id/message which
   *      uses the 'steer' command (handles running/idle/cold uniformly).
   *   3. if no session exists yet, spawn a fresh one with the message as
   *      the task. Returns the new sessionId.
   *
   * Either way the response shape is {ok:true, sessionId, deliveredAt}.
   */
  async function handleAgentMessage(req: Request, agentName: string, url?: URL): Promise<Response> {
    if (!agentName) return json({ error: "agent required" }, 400);
    let body: { content?: string };
    try { body = await req.json() as { content?: string }; } catch { return json({ error: "invalid json" }, 400); }
    const content = (body.content ?? "").trim();
    if (!content) return json({ error: "content required" }, 400);
    const forceNew = url?.searchParams.get("new") === "true";

    // Resolve default session (skip if forcing new chat).
    if (!forceNew) {
      const resolveResp = handleAgentDefaultSession(agentName);
      const resolved = await resolveResp.json() as { agent: string; sessionId: string | null };
      if (resolved.sessionId) {
        const result = await sendDaemonFrame({
          type: "human.input.received",
          source: "web-ui",
          owner: normalizeEventOwner(agentName),
          data: {
            actor: "human",
            text: content,
            conversation: { channel: "web-ui" },
            target: { agent: agentName, sessionId: resolved.sessionId },
          },
        });
        if (!result.ok) return json({ error: result.error }, 503);
        return json({ ok: true, agent: agentName, sessionId: resolved.sessionId, deliveredAt: Date.now(), spawned: false });
      }
    }

    // No prior session — request a create-or-bind chat start from the daemon.
    const result = await sendDaemonFrame({
      type: "human.input.received",
      source: "web-ui",
      owner: normalizeEventOwner(agentName),
      data: {
        actor: "human",
        text: content,
        conversation: { channel: "web-ui" },
        target: { agent: agentName },
        context: { forceNew },
      },
    });
    if (!result.ok) return json({ error: result.error }, 503);
    return json({ ok: true, agent: agentName, sessionId: null, deliveredAt: Date.now(), spawned: true });
  }

  async function handleAgentHeartbeatNow(req: Request, agentName: string): Promise<Response> {    if (!agentName) return json({ error: "agent required" }, 400);
    // Resolve actor from request body if provided, default to "human" (UI).
    let actor = "human";
    try {
      const body = await req.json() as { actor?: string };
      if (body.actor) actor = String(body.actor);
    } catch { /* body optional */ }
    const result = await sendDaemonFrame({
      type: "heartbeat.trigger",
      source: actor,
      owner: normalizeEventOwner(agentName),
      data: { agent: agentName },
    });
    if (!result.ok) return json({ error: result.error }, 503);
    return json({ ok: true, agent: agentName, triggeredAt: Date.now() });
  }

  async function handleMetricThreshold(req: Request, metricId: string): Promise<Response> {
    if (!metricId) return json({ error: "metricId required" }, 400);
    let body: { threshold?: number };
    try { body = await req.json() as { threshold?: number }; } catch { return json({ error: "invalid json" }, 400); }
    if (typeof body.threshold !== "number" || !Number.isFinite(body.threshold)) {
      return json({ error: "threshold (finite number) required" }, 400);
    }
    const db = _db();
    const existing = db.prepare("SELECT id, owner, threshold FROM metrics WHERE id = ?").get(metricId) as { id: string; owner?: string | null; threshold: number | null } | undefined;
    if (!existing) return json({ error: "metric not found" }, 404);
    db.prepare("UPDATE metrics SET threshold = ?, updated_at = ? WHERE id = ?").run(body.threshold, Date.now(), metricId);
    // Best-effort emit so subscribers see the change.
    void sendDaemonFrame({
      type: "metric.threshold_changed",
      source: "web-ui",
      owner: normalizeEventOwner(existing.owner ?? "may"),
      data: {
        metricId,
        from: existing.threshold,
        to: body.threshold,
      },
    });
    return json({ ok: true, metric: metricId, from: existing.threshold, to: body.threshold });
  }

  async function handleAlertResolve(req: Request, alertId: string): Promise<Response> {
    const id = parseInt(alertId, 10);
    if (!Number.isFinite(id)) return json({ error: "numeric alertId required" }, 400);
    let body: { reason?: string } = {};
    try { body = await req.json() as { reason?: string }; } catch { /* body optional */ }
    const db = _db();
    const existing = db.prepare(
      `SELECT ma.id, ma.metric_id, ma.resolved_at, m.owner
       FROM metric_alerts ma
       LEFT JOIN metrics m ON m.id = ma.metric_id
       WHERE ma.id = ?`,
    ).get(id) as { id: number; metric_id: string; owner?: string | null; resolved_at: number | null } | undefined;
    if (!existing) return json({ error: "alert not found" }, 404);
    if (existing.resolved_at !== null) return json({ ok: true, alreadyResolved: true });
    db.prepare("UPDATE metric_alerts SET resolved_at = ? WHERE id = ?").run(Date.now(), id);
    void sendDaemonFrame({
      type: "metric.alert_resolved",
      source: "web-ui",
      owner: normalizeEventOwner(existing.owner ?? "may"),
      data: {
        metricId: existing.metric_id,
        alertId: id,
        reason: body.reason ?? null,
      },
    });
    return json({ ok: true, alertId: id });
  }

  // ── WebSocket proxy ─────────────────────────────────────────────────

  const wsToUnix = new Map<any, Duplex>();

  function proxyWebSocket(ws: any): void {
    const socketPath = conventionSocketPath();
    if (!existsSync(socketPath)) {
      ws.send(JSON.stringify({ type: "error", message: `Daemon socket not found at ${socketPath}` }));
      ws.close();
      return;
    }
    const unix = connectSocketEndpoint(socketPath);
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
      const terminalWsMatch = url.pathname.match(/^\/api\/terminals\/([^/]+)\/ws$/);
      if (terminalWsMatch) {
        const cols = Number(url.searchParams.get("cols") || "");
        const rows = Number(url.searchParams.get("rows") || "");
        if (server.upgrade(req, { data: { kind: "terminal", terminalId: decodeURIComponent(terminalWsMatch[1]), cols, rows } })) return undefined;
        return new Response("WebSocket upgrade failed", { status: 400 });
      }
      if (url.pathname === "/ws") {
        if (server.upgrade(req, { data: { kind: "events" } })) return undefined;
        return new Response("WebSocket upgrade failed", { status: 400 });
      }
      if (url.pathname === "/api/liveness") return handleLiveness(url);
      if (url.pathname === "/api/stats") return handleStats();
      if (url.pathname === "/api/terminals" && req.method === "GET") return handleTerminals();
      if (url.pathname === "/api/terminals" && req.method === "POST") return handleTerminalStart(req);
      if (url.pathname === "/api/agents") return handleAgents();
      if (url.pathname === "/api/agents/activity") return handleAgentActivity();      if (url.pathname === "/api/agents/timeline") return handleAgentTimeline(url);
      if (url.pathname === "/api/agents/health") return handleSystemHealth();
      const defaultSessionMatch = url.pathname.match(/^\/api\/agents\/([^/]+)\/default-session$/);
      if (defaultSessionMatch) return handleAgentDefaultSession(defaultSessionMatch[1]);
      const aboutMatch = url.pathname.match(/^\/api\/agents\/([^/]+)\/about$/);
      if (aboutMatch) return handleAgentAbout(aboutMatch[1]);
      if (url.pathname === "/api/digest") return handleDigest(url);
      if (url.pathname === "/api/benchmarks") return handleBenchmarks(url);
      if (url.pathname === "/api/benchmarks/prompts") return handleBenchmarkPrompts(url);
      if (url.pathname === "/api/benchmarks/compare") return handleBenchmarkCompare(url);
      if (url.pathname === "/api/browse") return handleBrowse(url);
      if (url.pathname === "/api/knowledge/search") return handleKnowledgeSearch(url);
      if (url.pathname === "/api/metrics") return handleMetrics(url);
      if (url.pathname === "/api/projects") return handleProjects();
      if (url.pathname === "/api/projects/content") return handleProjectContent(url);
      if (url.pathname === "/api/projects/artifact") return handleProjectArtifact(url);
      if (url.pathname === "/api/projects/tasks") return handleProjectTasks(url);
      if (url.pathname === "/api/projects/detail") return handleProjectDetail(url);
      if (url.pathname === "/api/projects/lineage") return handleProjectLineage(url);
      if (url.pathname === "/api/projects/journal") return handleProjectJournal(url);
      if (url.pathname === "/api/projects/discussion") return handleProjectDiscussion(url);
      if (url.pathname === "/api/projects/sessions") return handleProjectSessions(url);
      if (url.pathname === "/api/projects/comment" && req.method === "POST") return handleProjectComment(req);
      if (url.pathname === "/api/events/delivery-health") return handleEventDeliveryHealth(url);
      const eventTraceMatch = url.pathname.match(/^\/api\/events\/(\d+)\/trace$/);
      if (eventTraceMatch) {
        const traceUrl = new URL(url);
        traceUrl.pathname = "/api/loop-trace";
        traceUrl.search = `?eventId=${eventTraceMatch[1]}`;
        return handleLoopTrace(traceUrl);
      }
      if (url.pathname === "/api/events" && req.method === "POST") return handleEventIngress(req);
      if (url.pathname === "/api/events") return handleEvents(url);
      if (url.pathname === "/api/learning") return handleLearning(url);
      if (url.pathname === "/api/loop-trace") return handleLoopTrace(url);
      const metricHistoryMatch = url.pathname.match(/^\/api\/metrics\/([^/]+)\/history$/);
      if (metricHistoryMatch) {
        const metricId = decodeURIComponent(metricHistoryMatch[1]);
        const days = parseInt(url.searchParams.get("days") || "7", 10);
        const since = Date.now() - days * 86400000;
        const rows = _db().prepare(
          `SELECT value, sample_size, measured_at, measured_by, note FROM metric_snapshots WHERE metric_id = ? AND measured_at > ? ORDER BY measured_at ASC`
        ).all(metricId, since);
        return json({ metricId, days, snapshots: rows });
      }
      const agentDetailMatch = url.pathname.match(/^\/api\/agents\/([^/]+)\/detail$/);
      if (agentDetailMatch) return handleAgentDetail(agentDetailMatch[1]);
      const sessionMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)$/);
      if (sessionMatch) return handleSession(sessionMatch[1]);
      const transcriptMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/transcript$/);
      if (transcriptMatch) return handleTranscript(transcriptMatch[1]);
      const rawLogMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/raw-log$/);
      if (rawLogMatch) return handleRawLog(rawLogMatch[1], url);
      const evalMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/eval$/);
      if (evalMatch && req.method === "GET") return handleSessionEval(evalMatch[1]);

      // ── Steering verbs (POST) ───────────────────────────────────────
      if (req.method === "POST") {
        const sessionCancelMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/cancel$/);
        if (sessionCancelMatch) return handleSessionCancel(sessionCancelMatch[1]);
        const sessionEvalGenerateMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/eval$/);
        if (sessionEvalGenerateMatch) return handleSessionEvalGenerate(req, sessionEvalGenerateMatch[1]);
        const sessionEvalCommentMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/eval\/comment$/);
        if (sessionEvalCommentMatch) return handleSessionEvalComment(req, sessionEvalCommentMatch[1]);
        const sessionMessageMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/message$/);
        if (sessionMessageMatch) return handleSessionMessage(req, sessionMessageMatch[1]);
        const terminalResizeMatch = url.pathname.match(/^\/api\/terminals\/([^/]+)\/resize$/);
        if (terminalResizeMatch) return handleTerminalResize(req, decodeURIComponent(terminalResizeMatch[1]));
        const terminalRestartMatch = url.pathname.match(/^\/api\/terminals\/([^/]+)\/restart$/);
        if (terminalRestartMatch) return handleTerminalRestart(decodeURIComponent(terminalRestartMatch[1]));
        const heartbeatNowMatch = url.pathname.match(/^\/api\/agents\/([^/]+)\/heartbeat-now$/);
        if (heartbeatNowMatch) return handleAgentHeartbeatNow(req, heartbeatNowMatch[1]);
        const agentMessageMatch = url.pathname.match(/^\/api\/agents\/([^/]+)\/message$/);
        if (agentMessageMatch) return handleAgentMessage(req, agentMessageMatch[1], url);
        const thresholdMatch = url.pathname.match(/^\/api\/metrics\/([^/]+)\/threshold$/);
        if (thresholdMatch) return handleMetricThreshold(req, decodeURIComponent(thresholdMatch[1]));
        const alertResolveMatch = url.pathname.match(/^\/api\/alerts\/([^/]+)\/resolve$/);
        if (alertResolveMatch) return handleAlertResolve(req, alertResolveMatch[1]);
      }

      const platformUiResponse = servePlatformUiRequest(req, PROJECTS_ROOT);
      if (platformUiResponse) return platformUiResponse;
      if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) return serveIndex();
      if (req.method === "GET" && (url.pathname === "/projects" || url.pathname.startsWith("/projects/"))) return serveProjectStatic(url.pathname);
      return new Response("Not found", { status: 404 });
    },
    websocket: {
      open(ws: any) {
        if (ws.data?.kind === "terminal") {
          terminalManager.attach(ws.data.terminalId, ws, ws.data.cols, ws.data.rows).catch((err) => {
            try {
              ws.send(JSON.stringify({ type: "error", message: err instanceof Error ? err.message : String(err) }));
              ws.close();
            } catch {}
          });
          return;
        }
        proxyWebSocket(ws);
      },
      message(ws: any, msg: any) {
        if (ws.data?.kind === "terminal") {
          try {
            const frame = JSON.parse(String(msg)) as { type?: string; data?: string; cols?: number; rows?: number };
            if (frame.type === "input") terminalManager.input(ws.data.terminalId, frame.data ?? "");
            else if (frame.type === "resize") terminalManager.resize(ws.data.terminalId, Number(frame.cols), Number(frame.rows));
          } catch (err) {
            try {
              ws.send(JSON.stringify({ type: "error", message: err instanceof Error ? err.message : String(err) }));
            } catch {}
          }
          return;
        }
        const unix = wsToUnix.get(ws);
        if (unix && typeof msg === "string" && msg.trim()) unix.write(msg.trim() + "\n");
      },
      close(ws: any) {
        if (ws.data?.kind === "terminal") {
          terminalManager.detach(ws.data.terminalId, ws);
          return;
        }
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

export function runWebUIServerFromCli(argv: string[] = process.argv): void {
  // When run as compiled binary, argv is [binary, --state-dir, path, ...]
  // When run via bun, argv is [bun, web.ts, --state-dir, path, ...]
  // getArg works for both since it searches the full argv.
  const getArg = (name: string, fallback: string) => {
    const idx = argv.indexOf(name);
    return idx !== -1 && argv[idx + 1] ? argv[idx + 1] : fallback;
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

if ((import.meta as ImportMeta & { main?: boolean }).main && process.argv.includes("--state-dir")) {
  runWebUIServerFromCli();
}
