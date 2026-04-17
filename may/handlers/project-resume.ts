/**
 * project-resume — Ignition for persistent project tasks.
 *
 * Scans agents/*\/workspace/projects/*.md every 5 minutes. For each project
 * file with `Status: active`, if the owning agent has no running session,
 * fork the owner to resume the project (referencing the project file path).
 *
 * This is the missing ignition that makes persistent tasks actually persist:
 * without it, active projects stall whenever the last working session ends.
 *
 * Project file controls everything:
 *   Status: active          → keep working (this handler re-forks owner)
 *   Status: paused          → stop (owner can pause anytime)
 *   Status: blocked         → stop, needs help
 *   Status: pending-review  → stop, needs human review
 *   Status: done            → stop permanently
 *   (any other value)       → stop
 *
 * Safety:
 *   - Set DRY_RUN=1 (env) to log would-fork without forking.
 *   - Per-agent limit: if multiple active projects share one owner, the
 *     most-recently-modified file wins (others wait).
 *   - Double-fork prevention: strict `status='running'` check on sessions.
 *
 * Exports create() conforming to HandlerModule.
 */

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import type { HandlerContext, HandlerModule } from "../../../src/lib/handler-context.js";
import type { CronEntry } from "../../../src/lib/cron-tool.js";

/** Regex for `**Status**: <value>` — only the first whitespace-delimited token matters. */
const STATUS_RE = /^\*\*Status\*\*:\s*(\S+)/m;

interface ProjectFile {
  owner: string;
  path: string;        // absolute path to project .md
  relPath: string;     // agents/<owner>/workspace/projects/<name>.md
  mtimeMs: number;
  status: string;
}

/**
 * Scan agents/*\/workspace/projects/*.md and return parsed project files.
 * Silently skips files that can't be read or don't contain a Status line.
 */
export function scanProjects(agentsRoot: string): ProjectFile[] {
  const out: ProjectFile[] = [];

  let agentDirs: string[] = [];
  try {
    agentDirs = readdirSync(agentsRoot, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith("."))
      .map((d) => d.name);
  } catch {
    return out;
  }

  for (const owner of agentDirs) {
    const projDir = join(agentsRoot, owner, "workspace", "projects");
    if (!existsSync(projDir)) continue;

    let entries: string[] = [];
    try {
      entries = readdirSync(projDir).filter((f) => f.endsWith(".md"));
    } catch {
      continue;
    }

    for (const name of entries) {
      const abs = join(projDir, name);
      try {
        const content = readFileSync(abs, "utf-8");
        const m = STATUS_RE.exec(content);
        if (!m) continue;
        const status = m[1]!.toLowerCase();
        const st = statSync(abs);
        out.push({
          owner,
          path: abs,
          relPath: `agents/${owner}/workspace/projects/${name}`,
          mtimeMs: st.mtimeMs,
          status,
        });
      } catch {
        // unreadable / stat failed — skip
      }
    }
  }

  return out;
}

/**
 * Pick one active project per owner (most-recently-modified wins) from a
 * list of scanned projects. Non-active projects are dropped.
 */
export function pickPerOwner(projects: ProjectFile[]): Map<string, ProjectFile> {
  const byOwner = new Map<string, ProjectFile>();
  for (const p of projects) {
    if (p.status !== "active") continue;
    const cur = byOwner.get(p.owner);
    if (!cur || p.mtimeMs > cur.mtimeMs) byOwner.set(p.owner, p);
  }
  return byOwner;
}

/**
 * Return the set of agents with a session currently running.
 * Uses status='running' (not just endedAt IS NULL) because interrupted
 * sessions also have NULL endedAt but are not actively working.
 */
export function runningAgents(ctx: HandlerContext): Set<string> {
  const db = ctx.getDb();
  const rows = db
    .prepare(`SELECT DISTINCT agent FROM sessions WHERE status = 'running'`)
    .all() as Array<{ agent: string }>;
  return new Set(rows.map((r) => r.agent));
}

// ── Factory ───────────────────────────────────────────────────────────

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  const agentsRoot = resolve(ctx.projectRoot, "agents");

  return async () => {
    const dryRun = process.env.DRY_RUN === "1";

    const all = scanProjects(agentsRoot);
    const candidates = pickPerOwner(all);

    if (candidates.size === 0) {
      // Quiet — no active projects anywhere.
      return;
    }

    const busy = runningAgents(ctx);

    let forked = 0;
    let skippedBusy = 0;
    for (const [owner, project] of candidates) {
      if (busy.has(owner)) {
        skippedBusy++;
        continue;
      }

      const task =
        `[cron:project-resume] Resume your active project.\n\n` +
        `Project file: ${project.relPath}\n\n` +
        `Read the project file, check Status, and continue the work. ` +
        `If blocked or done, update Status in the file so this handler stops re-forking you.`;

      if (dryRun) {
        ctx.log(`[project-resume] DRY_RUN would fork ${owner} for ${project.relPath}`);
        continue;
      }

      try {
        const sessionId = ctx.manager.run(owner, task, { source: "cron" });
        ctx.log(
          `[project-resume] forked ${owner} → ${sessionId} (project: ${project.relPath})`,
        );
        forked++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        ctx.log(`[project-resume] ⚠️ failed to fork ${owner} for ${project.relPath}: ${msg}`);
      }
    }

    if (forked > 0 || skippedBusy > 0) {
      ctx.log(
        `[project-resume] scan complete — active=${candidates.size} forked=${forked} skipped-busy=${skippedBusy}${dryRun ? " (dry-run)" : ""}`,
      );
    }
  };
};
