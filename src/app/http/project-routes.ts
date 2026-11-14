/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import {
  sendSocketCommand,
  type SocketEndpoint,
  type SocketResponse,
} from "@may-agent/control/client";
import { metricThresholdBreached } from "../../lib/metrics.js";
import {
  normalizeProjectPathForCompare,
  projectPathIdentity,
  readProjectIngressIdentity,
  readProjectMetadata,
} from "./project-metadata.js";
import type { SqliteDb } from "./read-model/state-db.js";

export type DurableControlReceipt = { eventId: number; eventType: string };
export type ConfirmDurableControl = (
  idempotencyKey: string,
) => DurableControlReceipt | undefined | Promise<DurableControlReceipt | undefined>;

export function extractMarkdownSection(body: string, headings: string | string[]): string | null {
  const wanted = new Set((Array.isArray(headings) ? headings : [headings]).map((h) => h.trim().toLowerCase()));
  const lines = body.split(/\r?\n/);
  let start = -1;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^##\s+(.+?)\s*$/);
    if (!match) continue;
    const heading = match[1].trim().toLowerCase();
    const matched = [...wanted].some(
      (name) => heading === name || heading.startsWith(`${name} `) || heading.startsWith(`${name} (`),
    );
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

export function projectEventTargetForPath(path: string, fallbackProjectId: string): string {
  const normalized = normalizeProjectPathForCompare(path);
  const projectName = normalized.split("/").filter(Boolean)[1] ?? "";
  return projectName.endsWith(".app") ? projectName.slice(0, -".app".length) : fallbackProjectId;
}

export type AppAdmissionPublishCommand = {
  type: "publish";
  event: {
    type: "app.input.requested";
    target: { appId: string };
    data: {
      input: {
        kind: "message";
        data: {
          message: string;
          context: { intent: "project-comment"; projectId: string; projectPath: string };
        };
      };
      source: { kind: "human"; id: string };
      conversationId: string;
      channel: "web-ui";
    };
    idempotencyKey: string;
  };
};

export function buildAppAdmissionCommand(input: {
  projectPath: string;
  projectId: string;
  comment: string;
  idempotencyKey: string;
}): AppAdmissionPublishCommand {
  return {
    type: "publish",
    event: {
      type: "app.input.requested",
      target: { appId: input.projectId },
      data: {
        input: {
          kind: "message",
          data: {
            message: input.comment,
            context: {
              intent: "project-comment",
              projectId: input.projectId,
              projectPath: input.projectPath,
            },
          },
        },
        source: { kind: "human", id: `web-ui:${input.idempotencyKey}` },
        conversationId: `web-ui:project:${input.projectId}`,
        channel: "web-ui",
      },
      idempotencyKey: input.idempotencyKey,
    },
  };
}

export function createProjectRouteHandlers(options: {
  projectRoot: string;
  agentsRoot: string;
  projectsRoot: string;
  getDb: () => SqliteDb;
  json: (data: unknown, status?: number) => Response;
  conventionSocketPath: () => string;
  platformUiContentTypeFor: (path: string) => string;
  sendAppInputWithRetry: (
    endpoint: SocketEndpoint,
    command: AppAdmissionPublishCommand,
    send?: typeof sendSocketCommand,
    confirm?: ConfirmDurableControl,
  ) => Promise<SocketResponse>;
  sendProjectActionWithRetry: (
    endpoint: SocketEndpoint,
    command: {
      type: "project.action.invoke";
      projectId: string;
      actionId: string;
      params: unknown;
      idempotencyKey: string;
    },
    send?: typeof sendSocketCommand,
    confirm?: ConfirmDurableControl,
  ) => Promise<SocketResponse>;
  confirmAcceptedAppInput: (
    appId: string,
    idempotencyKey: string,
    data: Record<string, unknown>,
    inputSource: { kind: "human"; id: string },
  ) => { eventId: number; eventType: "app.input.requested"; delivery: "accepted" } | undefined;
}) {
  const {
    projectRoot: PROJECT_ROOT,
    agentsRoot: AGENTS_ROOT,
    projectsRoot: PROJECTS_ROOT,
    getDb: _db,
    json,
    conventionSocketPath,
    platformUiContentTypeFor,
    sendAppInputWithRetry,
    sendProjectActionWithRetry,
    confirmAcceptedAppInput,
  } = options;

  function projectNameFromPath(path: string): string {
    return projectPathIdentity(path).name;
  }

  function readProject(path: string, filePath = resolveProjectFile(path)) {
    return readProjectMetadata(path, filePath);
  }

  function isAllowedProjectPath(path: string): boolean {
    const normalized = normalizeProjectPathForCompare(path);
    return (
      /^projects\/[^/]+(?:\/.*)?$/.test(normalized) || /^[^/]+\/workspace\/projects\/[^/]+(?:\/.*)?$/.test(normalized)
    );
  }

  function projectPathCandidates(path: string): string[] {
    const normalized = normalizeProjectPathForCompare(path);
    const clean = normalized.replace(/\/project\.md$/, "").replace(/\/$/, "");
    const name = projectNameFromPath(clean);
    const candidates = path.includes("workspace/projects/")
      ? [resolve(PROJECT_ROOT, path), resolve(PROJECT_ROOT, clean)]
      : [resolve(PROJECT_ROOT, clean), resolve(PROJECT_ROOT, path)];
    if (name) {
      candidates.push(resolve(PROJECTS_ROOT, name));
    }
    return [...new Set(candidates)];
  }

  function resolveProjectDir(path: string): string {
    const candidates = projectPathCandidates(path);
    return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
  }

  function appDirForName(name: string): string | null {
    if (!name) return null;
    const appDir = resolve(PROJECTS_ROOT, `${name.replace(/\.app$/, "")}.app`);
    return existsSync(appDir) ? appDir : null;
  }

  function appDirForPath(path: string): string | null {
    return appDirForName(projectNameFromPath(path));
  }

  function projectAppId(path: string, appDir: string): string {
    try {
      return readProjectIngressIdentity(path, resolve(appDir, "project.json")).name.replace(/\.app$/, "");
    } catch {
      return projectNameFromPath(path);
    }
  }

  function resolveProjectFile(path: string): string {
    if (path.endsWith(".md")) {
      const dir = resolveProjectDir(path.replace(/\/project\.md$/, ""));
      const projectFile = resolve(dir, "project.md");
      if (existsSync(projectFile)) return projectFile;
      const appDir = appDirForPath(path);
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
    const appDir = appDirForPath(path);
    if (appDir) {
      const appProjectFile = resolve(appDir, "project.md");
      if (existsSync(appProjectFile)) return appProjectFile;
      return resolve(appDir, "project.json");
    }
    return projectFile;
  }

  function htmlEscape(value: string): string {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
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
        "Content-Type": platformUiContentTypeFor(path),
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
    const rows = entries
      .map((entry) => {
        const href = `${normalizedUrlPath}${encodeURIComponent(entry.name)}${entry.isDir ? "/" : ""}`;
        const label = `${entry.name}${entry.isDir ? "/" : ""}`;
        const meta = entry.isDir ? "dir" : `${entry.size} bytes`;
        return `<li><a href="${htmlEscape(href)}">${htmlEscape(label)}</a> <span>${htmlEscape(meta)}</span></li>`;
      })
      .join("\n");
    return new Response(
      `<!doctype html>
<html><head><meta charset="utf-8"><title>${htmlEscape(title)}</title>
<style>body{font:14px system-ui,sans-serif;margin:32px;line-height:1.5}a{color:#0969da;text-decoration:none}a:hover{text-decoration:underline}ul{list-style:none;padding:0}li{padding:4px 0;border-bottom:1px solid #eee}span{color:#666;margin-left:12px;font-size:12px}</style>
</head><body><h1>${htmlEscape(title)}</h1><ul>${parent}${rows}</ul></body></html>`,
      {
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" },
      },
    );
  }

  function serveProjectStatic(pathname: string): Response {
    const relPath = projectStaticPathFromUrl(pathname);
    if (relPath === null) return new Response("Bad path", { status: 400 });
    let absPath = resolve(PROJECTS_ROOT, relPath);
    if (!isInsideProjectsRoot(absPath)) return new Response("Forbidden", { status: 403 });
    if (!existsSync(absPath)) {
      const parts = relPath.split("/").filter(Boolean);
      const [name, area, ...rest] = parts;
      const appDir = appDirForName(name);
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

  function readProjects() {
    const projects: Array<{ path: string; project: ReturnType<typeof readProject>; updatedAt: number }> = [];
    const scan = (dir: string, prefix: string) => {
      if (!existsSync(dir)) return;
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const path = `${prefix}/${entry.name}`;
        const markdown = join(dir, entry.name, "project.md");
        const file = existsSync(markdown) ? markdown : join(dir, entry.name, "project.json");
        try {
          projects.push({ path, project: readProject(path, file), updatedAt: statSync(file).mtimeMs });
        } catch {
          /* Missing or unreadable metadata is not a project record. */
        }
      }
    };
    try {
      scan(PROJECTS_ROOT, "projects");
      if (existsSync(AGENTS_ROOT)) {
        for (const entry of readdirSync(AGENTS_ROOT, { withFileTypes: true })) {
          if (!entry.isDirectory() || entry.name.startsWith(".") || entry.name === "shared") continue;
          scan(join(AGENTS_ROOT, entry.name, "workspace", "projects"), `agents/${entry.name}/workspace/projects`);
        }
      }
    } catch {
      /* Retain readable records if a discovery root becomes unavailable. */
    }
    return projects;
  }

  function handleProjects(): Response {
    return json(
      readProjects().map(({ path, project, updatedAt }) => {
        const { content, field } = project;
        const msX = (content.match(/^- \[x\]/gim) || []).length;
        const msO = (content.match(/^- \[ \]/gm) || []).length;
        return {
          name: field("id") || project.name,
          path,
          owner: project.owner,
          status: field("status") || "unknown",
          priority: field("priority"),
          iteration: parseInt(field("iteration") || "0", 10),
          health: field("health"),
          type: field("type") || null,
          formatErrors: project.formatErrors,
          milestonesDone: msX,
          milestonesTotal: msX + msO,
          metrics: (() => {
            const mIdx = content.indexOf("## Metrics\n");
            if (mIdx === -1) return [];
            const after = content.slice(mIdx + "## Metrics\n".length);
            const ns = after.indexOf("\n## ");
            const section = (ns === -1 ? after : after.slice(0, ns)).trim();
            const ids = section
              .split("\n")
              .filter((l: string) => l.startsWith("- "))
              .map((l: string) => {
                const m = l.match(/^- `?(\S+?)`?:/);
                const t = l.match(/target\s*([<>]=?\s*)?(\d[\d.]*%?)/);
                return m ? { id: m[1].replace(/`/g, ""), target: t ? (t[1] || "") + t[2] : null } : null;
              })
              .filter(Boolean) as Array<{ id: string; target: string | null }>;
            if (ids.length === 0) return [];
            try {
              const db = _db();
              return ids.map(({ id, target }) => {
                const row = db.prepare("SELECT current, threshold, alert_op FROM metrics WHERE id = ?").get(id) as any;
                const current = row?.current ?? null;
                const threshold = row?.threshold;
                const breached = threshold != null && current != null && metricThresholdBreached(row);
                return { id, current, target, breached };
              });
            } catch {
              return ids.map(({ id, target }) => ({ id, current: null, target, breached: false }));
            }
          })(),
          updatedAt,
        };
      }),
    );
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

  function handleProjectDetail(url: URL): Response {
    const path = url.searchParams.get("path");
    if (!path) return json({ error: "path required" }, 400);
    if (!isAllowedProjectPath(path)) return json({ error: "Access denied" }, 403);
    const filePath = resolveProjectFile(path);
    if (!existsSync(filePath)) return json({ error: "not found" }, 404);

    let project: ReturnType<typeof readProject>;
    let stat: { mtimeMs: number; ctimeMs: number };
    try {
      project = readProject(path, filePath);
      stat = statSync(filePath);
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
    const { body, frontmatter, owner, name: projectName, projectId, projectIds } = project;
    const jsonProject = project.isJson ? project.data : null;

    const goal =
      jsonProject && typeof jsonProject.goal === "string" ? jsonProject.goal : extractMarkdownSection(body, "Goal");
    const currentState = jsonProject
      ? typeof jsonProject.currentState === "string"
        ? jsonProject.currentState
        : jsonProject.currentState &&
            typeof jsonProject.currentState === "object" &&
            "summary" in jsonProject.currentState &&
            typeof jsonProject.currentState.summary === "string"
          ? jsonProject.currentState.summary
          : null
      : extractMarkdownSection(body, "Current State");

    const checkboxes = body.match(/^[\s\-*]*\[[ xX]\]/gm) || [];
    const milestonesTotal = checkboxes.length;
    const milestonesDone = (body.match(/^[\s\-*]*\[[xX]\]/gm) || []).length;

    const cited = new Set<string>();
    const re = /`([a-z]+(?:\.[a-z0-9-]+)+)`/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body)) !== null) {
      const tok = m[1];
      if (/^(metric|capability|project|handler|session|evaluator|agent|system|v2)\./.test(tok)) cited.add(tok);
    }

    const db = _db();
    let ownedMetrics: Array<Record<string, unknown>> = [];
    let citedMetricsResolved: Array<Record<string, unknown>> = [];
    try {
      ownedMetrics = db
        .prepare(`SELECT id, name, current, threshold, alert_op, unit, priority, type FROM metrics WHERE project = ?`)
        .all(projectName) as any[];
      if (cited.size > 0) {
        const placeholders = [...cited].map(() => "?").join(",");
        citedMetricsResolved = db
          .prepare(
            `SELECT id, name, current, threshold, alert_op, unit, priority, type FROM metrics WHERE id IN (${placeholders})`,
          )
          .all(...[...cited]) as any[];
      }
    } catch {
      /* tolerate missing column */
    }

    const recentSessions: Array<Record<string, unknown>> = [];
    let sessionCount = 0;
    try {
      const tagged = db
        .prepare(
          `SELECT sessionId, agent, status, startedAt, endedAt, task FROM sessions WHERE projectId IN (${projectIds.map(() => "?").join(",")}) ORDER BY startedAt DESC LIMIT 10`,
        )
        .all(...projectIds) as any[];
      for (const r of tagged) recentSessions.push({ ...r, link: "tagged" });
      const cnt = db
        .prepare(`SELECT COUNT(*) as c FROM sessions WHERE projectId IN (${projectIds.map(() => "?").join(",")})`)
        .get(...projectIds) as any;
      sessionCount = cnt?.c ?? 0;
    } catch {
      /* skip */
    }

    return json({
      path,
      name: projectName,
      owner,
      projectId,
      frontmatter,
      status: project.field("status"),
      iteration: Number(project.field("iteration") || 0),
      priority: project.field("priority"),
      type: project.field("type"),
      workflow: project.field("workflow"),
      goal,
      currentState,
      milestonesTotal,
      milestonesDone,
      citedMetrics: [...cited],
      ownedMetrics,
      citedMetricsResolved,
      sessionCount,
      recentSessions,
      app: (() => {
        const appDir = appDirForPath(path);
        if (!appDir) return null;
        return {
          appId: projectAppId(path, appDir),
          appDirName: appDir.split("/").pop(),
          hasUi: existsSync(resolve(appDir, "ui", "index.html")),
        };
      })(),
      updatedAt: stat ? Math.floor(stat.mtimeMs) : null,
      createdAt: stat ? Math.floor(stat.ctimeMs) : null,
    });
  }

  function handleProjectSessions(url: URL): Response {
    const path = url.searchParams.get("path");
    if (!path) return json({ error: "path required" }, 400);
    if (!isAllowedProjectPath(path)) return json({ error: "Access denied" }, 403);
    let project: Pick<ReturnType<typeof projectPathIdentity>, "projectIds">;
    try {
      project = readProject(path);
    } catch {
      project = projectPathIdentity(path);
    }
    const { projectIds } = project;

    const sessions: any[] = [];
    try {
      const db = _db();
      const tagged = db
        .prepare(
          `SELECT sessionId, agent, status, opCount, startedAt, endedAt, task FROM sessions WHERE projectId IN (${projectIds.map(() => "?").join(",")}) ORDER BY startedAt DESC LIMIT 50`,
        )
        .all(...projectIds) as any[];
      for (const r of tagged) sessions.push({ ...r, link: "tagged" });
    } catch {
      /* projectId column may not exist */
    }

    return json(sessions);
  }

  async function handleProjectComment(req: Request): Promise<Response> {
    try {
      const body = (await req.json()) as {
        path?: string;
        projectId?: string;
        comment?: string;
        idempotencyKey?: string;
      };
      const path = body.path ?? (body.projectId ? `projects/${body.projectId.replace(/\.app$/, "")}` : undefined);
      const { comment } = body;
      if (!path || !comment) return json({ error: "path and comment required" }, 400);
      if (!isAllowedProjectPath(path)) return json({ error: "Access denied" }, 403);

      const projectFile = resolveProjectFile(path);
      if (!existsSync(projectFile)) return json({ error: "Project not found" }, 404);
      const identity = readProjectIngressIdentity(path, projectFile);
      const projectId = projectEventTargetForPath(path, identity.projectId);
      const idempotencyKey = body.idempotencyKey?.trim() || `web-project-${randomUUID()}`;
      const command = buildAppAdmissionCommand({ projectPath: path, projectId, comment, idempotencyKey });
      try {
        const admitted = await sendAppInputWithRetry(conventionSocketPath(), command, sendSocketCommand, (key) =>
          confirmAcceptedAppInput(
            projectId,
            key,
            {
              input: command.event.data.input,
              conversationId: command.event.data.conversationId,
              channel: command.event.data.channel,
            },
            { kind: "human", id: `web-ui:${key}` },
          ),
        );
        return json(
          {
            ok: true,
            triggered: true,
            eventType: String(admitted.eventType ?? "app.input.requested"),
            eventId: Number(admitted.eventId) || undefined,
            projectId,
          },
          202,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return json({ ok: false, triggered: false, error: message }, 503);
      }
    } catch (e: any) {
      return json({ error: e.message }, 500);
    }
  }

  async function handleProjectActions(projectIdText: string): Promise<Response> {
    const projectId = decodeURIComponent(projectIdText)
      .trim()
      .replace(/\.app$/, "");
    if (!projectId) return json({ error: "projectId required" }, 400);
    try {
      const response = await sendSocketCommand(
        conventionSocketPath(),
        { type: "project.actions.describe", projectId },
        { timeoutMs: 2000 },
      );
      return json({ projectId, actions: Array.isArray(response.actions) ? response.actions : [] });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : String(error) }, 503);
    }
  }

  async function handleProjectActionInvoke(
    req: Request,
    projectIdText: string,
    actionIdText: string,
  ): Promise<Response> {
    const projectId = decodeURIComponent(projectIdText)
      .trim()
      .replace(/\.app$/, "");
    const actionId = decodeURIComponent(actionIdText).trim();
    if (!projectId || !actionId) return json({ error: "projectId and actionId required" }, 400);
    try {
      const body = (await req.json().catch(() => ({}))) as {
        input?: unknown;
        params?: unknown;
        idempotencyKey?: string;
      };
      const idempotencyKey = body.idempotencyKey?.trim() || `web-action-${randomUUID()}`;
      const response = await sendProjectActionWithRetry(
        conventionSocketPath(),
        {
          type: "project.action.invoke",
          projectId,
          actionId,
          params: body.input ?? body.params ?? {},
          idempotencyKey,
        },
        sendSocketCommand,
        (key) => {
          const row = _db()
            .prepare(
              `SELECT id, event_type
               FROM events
               WHERE idempotency_key = ? AND project_id = ?
               ORDER BY id
               LIMIT 1`,
            )
            .get(key, projectId) as { id?: unknown; event_type?: unknown } | undefined;
          const eventId = Number(row?.id);
          const eventType = typeof row?.event_type === "string" ? row.event_type : "";
          return Number.isInteger(eventId) && eventId > 0 && eventType ? { eventId, eventType } : undefined;
        },
      );
      return json(
        {
          projectId,
          actionId,
          eventId: response.eventId,
          eventType: response.eventType,
        },
        202,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = message.startsWith("Invalid input") ? 400 : 503;
      return json({ error: message }, status);
    }
  }

  return {
    isAllowedProjectPath,
    resolveProjectFile,
    serveProjectStatic,
    readProjects,
    handleProjects,
    handleProjectContent,
    handleProjectArtifact,
    handleProjectDetail,
    handleProjectSessions,
    handleProjectComment,
    handleProjectActions,
    handleProjectActionInvoke,
  };
}
