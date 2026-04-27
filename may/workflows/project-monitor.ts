/// <reference path="../../../src/lib/workflow-defs.d.ts" />

import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Project Monitor Workflow
 *
 * Actively checks on external agent projects — not just asking status,
 * but reading the actual work output, verifying quality, and providing
 * feedback or escalating.
 *
 * Optimized 2026-04-25: Mechanical data gathering (projects.json, socket
 * checks, session history, workspace listing) moved to pure JS. The LLM
 * agent now receives pre-loaded context and only does judgment work
 * (quality assessment, feedback decisions, report writing).
 * Estimated savings: ~8-12 tool calls per invocation.
 */

export const description = "Actively monitor external projects — verify work, give feedback, escalate when needed";

// ── Pure JS data gathering ─────────────────────────────────────────────

interface ProjectConfig {
  name: string;
  path: string;
  socket: string;
  description: string;
  agent: string;
}

interface SessionMeta {
  filename: string;
  modTime: string;
  content: Record<string, any> | null;
}

interface ProjectSnapshot {
  config: ProjectConfig;
  socketStatus: string;
  recentSessions: SessionMeta[];
  workspaceFiles: string[];
}

function loadProjects(): ProjectConfig[] {
  const projectsPath = "agents/may/projects.json";
  try {
    return JSON.parse(readFileSync(projectsPath, "utf-8"));
  } catch {
    return [];
  }
}

function checkSocket(project: ProjectConfig): string {
  const socketPath = join(project.path, project.socket);
  try {
    const out = execSync(
      `echo '{"type":"status"}' | socat -t2 - UNIX-CONNECT:${JSON.stringify(socketPath)} 2>&1`,
      { encoding: "utf-8", timeout: 5000 },
    );
    return out.trim() || "(connected, no response)";
  } catch (err: any) {
    return `offline: ${(err.stderr || err.message || "").toString().trim().slice(0, 200)}`;
  }
}

function getRecentSessions(project: ProjectConfig, count = 3): SessionMeta[] {
  const historyDir = join(project.path, ".state/sessions/history");
  if (!existsSync(historyDir)) return [];

  try {
    const entries = readdirSync(historyDir)
      .filter((f: string) => statSync(join(historyDir, f)).isDirectory())
      .map((f: string) => ({
        name: f,
        mtime: statSync(join(historyDir, f)).mtimeMs,
      }))
      .sort((a: { mtime: number }, b: { mtime: number }) => b.mtime - a.mtime)
      .slice(0, count);

    return entries.map((e) => {
      const metaPath = join(historyDir, e.name, "meta.json");
      let content: Record<string, any> | null = null;
      try {
        content = JSON.parse(readFileSync(metaPath, "utf-8"));
      } catch { /* meta.json may not exist */ }
      return {
        filename: e.name,
        modTime: new Date(e.mtime).toISOString(),
        content,
      };
    });
  } catch {
    return [];
  }
}

function listWorkspaceFiles(project: ProjectConfig): string[] {
  // List workspace files across all agents in the project
  const agentsDir = join(project.path, "agents");
  if (!existsSync(agentsDir)) return [];

  try {
    const results: string[] = [];
    for (const agent of readdirSync(agentsDir)) {
      const wsDir = join(agentsDir, agent, "workspace");
      if (!existsSync(wsDir) || !statSync(wsDir).isDirectory()) continue;
      for (const f of readdirSync(wsDir)) {
        results.push(`agents/${agent}/workspace/${f}`);
      }
    }
    return results.slice(0, 30); // cap to avoid bloat
  } catch {
    return [];
  }
}

function gatherProjectData(): ProjectSnapshot[] {
  const projects = loadProjects();
  return projects.map((config) => ({
    config,
    socketStatus: checkSocket(config),
    recentSessions: getRecentSessions(config),
    workspaceFiles: listWorkspaceFiles(config),
  }));
}

function formatSnapshot(snapshots: ProjectSnapshot[]): string {
  if (snapshots.length === 0) return "(no projects configured in agents/may/projects.json)";

  return snapshots.map((s) => {
    const sessions = s.recentSessions.length > 0
      ? s.recentSessions.map((sess) => {
          const meta = sess.content;
          if (!meta) return `  - ${sess.filename} (${sess.modTime}) — no meta.json`;
          const status = meta.status ?? "unknown";
          const task = (meta.task ?? "").toString().slice(0, 120);
          const summary = (meta.summary ?? "").toString().slice(0, 200);
          return `  - ${sess.filename} (${sess.modTime})\n    Status: ${status} | Task: ${task}\n    Summary: ${summary}`;
        }).join("\n")
      : "  (no session history found)";

    const wsFiles = s.workspaceFiles.length > 0
      ? s.workspaceFiles.map((f) => `  - ${f}`).join("\n")
      : "  (no workspace files)";

    return [
      `### ${s.config.name}`,
      `- **Path**: ${s.config.path}`,
      `- **Description**: ${s.config.description}`,
      `- **Agent**: ${s.config.agent}`,
      `- **Socket status**: ${s.socketStatus}`,
      ``,
      `**Recent sessions:**`,
      sessions,
      ``,
      `**Workspace files:**`,
      wsFiles,
    ].join("\n");
  }).join("\n\n---\n\n");
}

// ── Main workflow ──────────────────────────────────────────────────────

export default async function projectMonitor(ctx: WorkflowContext) {
  // Phase 1: Pure JS data gathering — no LLM needed
  ctx.emit({ type: "step_start", step: "data-gather" });
  const snapshots = gatherProjectData();
  const preloadedContext = formatSnapshot(snapshots);
  ctx.emit({ type: "step_done", step: "data-gather" } as any);

  // Phase 2: LLM judgment — assess quality, decide on feedback
  const checkResult = await ctx.runAgent("may", `
You are reviewing external agent projects. The mechanical data has been pre-loaded below.

## Pre-loaded Project Data

${preloadedContext}

## Your Job (judgment only — data is already gathered)

For each project above:

1. **Assess work quality** based on the session history and workspace files.
   - Read specific workspace files if you need more detail (paths listed above).
   - Check if the agent's recent work makes sense given its description.

2. **Decide what to do**:
   - **Work is good** → note it, move on
   - **Work has minor issues** → send feedback directly via socat
   - **Agent is stuck or confused** → note for coach escalation
   - **Agent needs human decision** → note the specific question for Hao
   - **Agent is idle** → check if there's pending work to assign

3. **Write report** to agents/may/workspace/project-status.md:
   - Each project: status, what was produced, quality assessment
   - Feedback sent (if any)
   - Issues that need coaching (if any) — with evidence
   - Questions for Hao (if any) — with context

Focus on judgment and action. Do NOT re-read projects.json or re-check sockets — that data is above.
`);

  const report = checkResult.lastAssistantText ?? "";

  // If coach is needed, escalate with evidence
  if (report.toLowerCase().includes("needs coaching") ||
      report.toLowerCase().includes("coach") ||
      report.toLowerCase().includes("behavioral gap") ||
      report.toLowerCase().includes("keeps failing")) {

    await ctx.runAgent("coach", `
An external project agent needs coaching. Read agents/may/workspace/project-status.md for May's assessment.

Your job:
1. Read the specific session transcripts May identified (paths are in the report)
2. Diagnose WHY the agent failed — is it a SOUL.md gap? Missing skill? Wrong methodology?
3. Fix it: edit the project's SOUL.md or common-sense.md (paths in agents/may/projects.json)
4. Write your diagnosis and fix to agents/coach/workspace/project-coaching.md

Remember: you're editing files in a DIFFERENT project directory. Read agents/may/projects.json for paths.
`);
  }

  // If human input needed, notify
  if (report.toLowerCase().includes("question for hao") ||
      report.toLowerCase().includes("human decision") ||
      report.toLowerCase().includes("[human-needed]")) {
    ctx.emit({ type: "step_done", step: "human-attention" } as any);
  }

  return ctx.done(
    `## Project Monitor Complete\n\n${report.slice(0, 1000)}`
  );
}
