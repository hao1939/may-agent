/**
 * feedback-echo-sync — Run feedback-echo.ts as a direct handler instead of LLM session.
 *
 * Previously this was a cron job routed through verify-wrap, which spun up an
 * entire LLM agent session just to run `bun agents/shared/feedback-echo.ts`.
 * That pattern caused repeated errors (the agent would sometimes fail to run
 * the command correctly, or hit empty-assistant-turn errors).
 *
 * This handler runs the script directly via subprocess, eliminating the LLM
 * overhead and error surface.
 */

import type { EventEnvelope, HandlerContext, HandlerModule } from "@may-agent/sdk";
import type { CronEntry } from "@may-agent/sdk";
import { spawn } from "node:child_process";
import { join } from "node:path";

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  return async (_event?: EventEnvelope) => {
    const scriptPath = join(process.cwd(), "agents/shared/feedback-echo.ts");
    // Use the runtime's own bun binary — the old hardcoded .state/.bun/bin/bun
    // path doesn't exist and caused spawn to hang or timeout at 300s.
    const bunPath = process.execPath || "/usr/local/bin/bun";

    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const settle = (fn: () => void) => { if (!settled) { settled = true; fn(); } };

      const proc = spawn(bunPath, [scriptPath], {
        cwd: process.cwd(),
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
      proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

      // Manual timeout — Node/Bun spawn timeout option is unreliable
      const timer = setTimeout(() => {
        proc.kill("SIGKILL");
        settle(() => {
          ctx.sdk.emit("handler.failed", {
            handler: "feedback-echo-sync",
            error: "Process killed after 30s timeout",
          });
          reject(new Error("feedback-echo.ts killed after 30s timeout"));
        });
      }, 30_000);

      proc.on("close", (code) => {
        clearTimeout(timer);
        if (code === 0) {
          const updatedCount = (stdout.match(/Updated/g) || []).length;
          settle(() => {
            ctx.sdk.emit("handler.completed", {
              handler: "feedback-echo-sync",
              summary: `Updated ${updatedCount} agent last-eval.md files`,
            });
            resolve();
          });
        } else {
          settle(() => {
            ctx.sdk.emit("handler.failed", {
              handler: "feedback-echo-sync",
              error: `Exit code ${code}: ${stderr.slice(0, 200)}`,
            });
            reject(new Error(`feedback-echo.ts exited with code ${code}: ${stderr.slice(0, 200)}`));
          });
        }
      });

      proc.on("error", (err) => {
        clearTimeout(timer);
        settle(() => {
          ctx.sdk.emit("handler.failed", {
            handler: "feedback-echo-sync",
            error: err.message,
          });
          reject(err);
        });
      });
    });
  };
};
