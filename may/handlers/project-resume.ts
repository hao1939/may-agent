/**
 * project-resume — Scan projects modified since last check, fork owners.
 * Simple: if project.md changed and no session is running for it, resume it.
 * The persistent-task workflow handles status, comments, evaluation — not this handler.
 */
import { readdirSync, readFileSync, statSync, existsSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { HandlerContext, HandlerModule } from "../../../src/lib/handler-context.js";
import type { CronEntry } from "../../../src/lib/cron-tool.js";

const OWNER_RE = /^\*\*Owner\*\*:\s*(\S+)/mi;
const STATE_FILE = ".state/project-resume-last-check";

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  const agentsRoot = resolve(ctx.projectRoot, "agents");
  const stateFile = resolve(ctx.projectRoot, STATE_FILE);

  return async () => {
    // Read last check time
    let lastCheck = 0;
    try {
      lastCheck = parseInt(readFileSync(stateFile, "utf-8").trim(), 10) || 0;
    } catch { /* first run */ }

    const now = Date.now();
    const projects: Array<{ owner: string; relPath: string }> = [];

    // Scan all project directories
    try {
      for (const dir of readdirSync(agentsRoot, { withFileTypes: true })) {
        if (!dir.isDirectory() || dir.name.startsWith(".")) continue;
        const projDir = join(agentsRoot, dir.name, "workspace", "projects");
        if (!existsSync(projDir)) continue;

        for (const entry of readdirSync(projDir, { withFileTypes: true })) {
          let projectFile: string;
          let relPath: string;

          if (entry.isDirectory()) {
            projectFile = join(projDir, entry.name, "project.md");
            if (!existsSync(projectFile)) continue;
            relPath = `agents/${dir.name}/workspace/projects/${entry.name}`;
          } else if (entry.isFile() && entry.name.endsWith(".md")) {
            projectFile = join(projDir, entry.name);
            relPath = `agents/${dir.name}/workspace/projects/${entry.name}`;
          } else {
            continue;
          }

          try {
            const mtime = statSync(projectFile).mtimeMs;
            if (mtime <= lastCheck) continue; // Not modified since last check

            const content = readFileSync(projectFile, "utf-8");
            const m = OWNER_RE.exec(content);
            const owner = m ? m[1] : dir.name;
            projects.push({ owner, relPath });
          } catch { /* skip */ }
        }
      }
    } catch { return; }

    // Save check time
    try { writeFileSync(stateFile, String(now), "utf-8"); } catch { /* skip */ }

    if (projects.length === 0) return;

    // Find projects already being worked on
    const busyProjects = new Set<string>();
    try {
      const db = ctx.getDb();
      const wfRows = db.prepare(
        "SELECT task FROM sessions WHERE status = 'running' AND task LIKE '%persistent-task%'"
      ).all() as Array<{ task: string }>;
      for (const r of wfRows) {
        const m = r.task.match(/project:\s*([^\n"]+)/);
        if (m) busyProjects.add(m[1].trim());
      }
    } catch { /* skip */ }

    let forked = 0;
    for (const project of projects) {
      if (busyProjects.has(project.relPath)) continue;
      const task =
        `Run the persistent-task workflow for this project.\n\n` +
        `workflow.run("persistent-task", "project: ${project.relPath}\\nagent: ${project.owner}\\ngoal: see project file")`;
      try {
        ctx.manager.run(project.owner, task, { source: "cron" });
        forked++;
      } catch { /* skip */ }
    }

    if (forked > 0) {
      ctx.log(`[project-resume] forked ${forked} agent(s) for modified projects`);
    }
  };
};
