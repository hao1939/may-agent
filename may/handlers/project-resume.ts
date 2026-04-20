/**
 * project-resume — Scan projects, fork owners.
 * - Active projects: always resume
 * - Blocked/done projects with pending comments: resume to process comments
 * Supports both legacy (single .md) and new (directory with project.md) formats.
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import type { HandlerContext, HandlerModule } from "../../../src/lib/handler-context.js";
import type { CronEntry } from "../../../src/lib/cron-tool.js";

const STATUS_RE = /^[\s*]*Status[\s*:]*\s+(\S+)/mi;

function hasPendingComments(content: string): boolean {
  const idx = content.indexOf("## Comments\n");
  if (idx === -1) return false;
  const after = content.slice(idx + "## Comments\n".length);
  const nextSection = after.indexOf("\n## ");
  const text = nextSection === -1 ? after : after.slice(0, nextSection);
  return text.trim().length > 0;
}

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  const agentsRoot = resolve(ctx.projectRoot, "agents");

  return async () => {
    const picked = new Map<string, { relPath: string; mtime: number }>();

    try {
      for (const dir of readdirSync(agentsRoot, { withFileTypes: true })) {
        if (!dir.isDirectory() || dir.name.startsWith(".")) continue;
        const projDir = join(agentsRoot, dir.name, "workspace", "projects");
        if (!existsSync(projDir)) continue;

        for (const entry of readdirSync(projDir, { withFileTypes: true })) {
          let projectFile: string;
          let relPath: string;

          if (entry.isFile() && entry.name.endsWith(".md")) {
            // Legacy: single .md file
            projectFile = join(projDir, entry.name);
            relPath = `agents/${dir.name}/workspace/projects/${entry.name}`;
          } else if (entry.isDirectory()) {
            // New: directory with project.md
            projectFile = join(projDir, entry.name, "project.md");
            if (!existsSync(projectFile)) continue;
            relPath = `agents/${dir.name}/workspace/projects/${entry.name}`;
          } else {
            continue;
          }

          try {
            const content = readFileSync(projectFile, "utf-8");
            const m = STATUS_RE.exec(content);
            if (!m) continue;
            const status = m[1].toLowerCase();
            // Active projects: always resume
            // Blocked/done projects: resume only if they have pending comments
            const shouldResume = status === "active" ||
              ((status === "blocked" || status === "done") && hasPendingComments(content));
            if (!shouldResume) continue;
            const mtime = statSync(projectFile).mtimeMs;
            const existing = picked.get(dir.name);
            if (!existing || mtime > existing.mtime) {
              picked.set(dir.name, { relPath, mtime });
            }
          } catch { /* skip */ }
        }
      }
    } catch { return; }

    if (picked.size === 0) return;

    const busyProjects = new Set<string>();
    try {
      const db = ctx.getDb();
      // Check for running sessions on specific projects
      const wfRows = db.prepare("SELECT task FROM sessions WHERE status = 'running' AND task LIKE '%persistent-task%'").all() as Array<{ task: string }>;
      for (const r of wfRows) {
        const m = r.task.match(/project:\s*([^\n"]+)/);
        if (m) busyProjects.add(m[1].trim());
      }
    } catch { /* skip */ }

    let forked = 0;
    for (const [owner, project] of picked) {
      if (busyProjects.has(project.relPath)) continue;
      const task =
        `Run the persistent-task workflow for this project.\n\n` +
        `workflow.run("persistent-task", "project: ${project.relPath}\\nagent: ${owner}\\ngoal: see project file")\n\n` +
        `If the project is blocked or done, update Status in the file and call finish().`;
      try {
        ctx.manager.run(owner, task, { source: "cron" });
        forked++;
      } catch { /* skip */ }
    }

    if (forked > 0) {
      ctx.log(`[project-resume] forked ${forked} agent(s) for active projects`);
    }
  };
};
