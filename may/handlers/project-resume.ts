/**
 * project-resume — Simple: scan active projects, fork owners.
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import type { HandlerContext, HandlerModule } from "../../../src/lib/handler-context.js";
import type { CronEntry } from "../../../src/lib/cron-tool.js";

const STATUS_RE = /^[\s*]*Status[\s*:]*\s+(\S+)/mi;

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  const agentsRoot = resolve(ctx.projectRoot, "agents");

  return async () => {
    // Scan for active projects
    const candidates: Array<{ owner: string; relPath: string }> = [];
    const picked = new Map<string, { relPath: string; mtime: number }>();

    try {
      for (const dir of readdirSync(agentsRoot, { withFileTypes: true })) {
        if (!dir.isDirectory() || dir.name.startsWith(".")) continue;
        const projDir = join(agentsRoot, dir.name, "workspace", "projects");
        if (!existsSync(projDir)) continue;
        for (const file of readdirSync(projDir).filter(f => f.endsWith(".md"))) {
          try {
            const abs = join(projDir, file);
            const content = readFileSync(abs, "utf-8");
            const m = STATUS_RE.exec(content);
            if (!m) continue;
            const status = m[1].toLowerCase();
            if (status !== "active") continue;
            const mtime = statSync(abs).mtimeMs;
            const existing = picked.get(dir.name);
            if (!existing || mtime > existing.mtime) {
              picked.set(dir.name, { relPath: `agents/${dir.name}/workspace/projects/${file}`, mtime });
            }
          } catch { /* skip unreadable files */ }
        }
      }
    } catch { return; }

    if (picked.size === 0) return;

    // Check which agents already have running sessions
    const busy = new Set<string>();
    try {
      const db = ctx.getDb();
      const rows = db.prepare("SELECT DISTINCT agent FROM sessions WHERE status = 'running'").all() as Array<{ agent: string }>;
      for (const r of rows) busy.add(r.agent);
    } catch { /* skip if DB unavailable */ }

    let forked = 0;
    for (const [owner, project] of picked) {
      if (busy.has(owner)) continue;
      const task =
        `Run the persistent-task workflow for this project.\n\n` +
        `workflow.run("persistent-task", "project: ${project.relPath}\\nagent: ${owner}\\ngoal: see project file")\n\n` +
        `If the project is blocked or done, update Status in the file and call finish().`;
      try {
        ctx.manager.run(owner, task, { source: "cron" });
        forked++;
      } catch { /* skip failed forks */ }
    }

    if (forked > 0) {
      ctx.log(`[project-resume] forked ${forked} agent(s) for active projects`);
    }
  };
};
