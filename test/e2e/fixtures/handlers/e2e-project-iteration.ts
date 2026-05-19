/**
 * E2E fixture handler: scans projects and dispatches the iteration workflow.
 *
 * Used by e3a-project-iteration-loop. Dispatches once per fire for each active
 * project whose project.md exists.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { CronEntry, HandlerContext, HandlerModule, TriggerEvent } from "@may-agent/sdk";

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  return async (_event?: TriggerEvent) => {
    const projectsRoot = ctx.sdk.paths.projects;
    if (!existsSync(projectsRoot)) return;

    for (const entry of readdirSync(projectsRoot)) {
      const dir = join(projectsRoot, entry);
      try {
        if (!statSync(dir).isDirectory()) continue;
      } catch {
        continue;
      }
      const pFile = join(dir, "project.md");
      if (!existsSync(pFile)) continue;
      const content = readFileSync(pFile, "utf-8");
      const fm = content.match(/^---\n([\s\S]*?)\n---/);
      if (!fm) continue;
      const statusLine = fm[1].match(/^status:\s*(.+)$/m);
      const status = statusLine ? statusLine[1].trim().toLowerCase() : "";
      if (status !== "active") continue;

      ctx.sdk.emit("e2e.iteration.dispatch", { projectId: entry });
      try {
        await ctx.sdk.runWorkflow("e2e-iteration-stub", `iterate ${entry}`);
      } catch (err) {
        ctx.sdk.emit("e2e.iteration.error", {
          projectId: entry,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  };
};
