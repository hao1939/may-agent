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
    const bunPath = join(process.cwd(), ".state/.bun/bin/bun");

    return new Promise<void>((resolve, reject) => {
      const proc = spawn(bunPath, [scriptPath], {
        cwd: process.cwd(),
        timeout: 30_000,
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
      proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

      proc.on("close", (code) => {
        if (code === 0) {
          const updatedCount = (stdout.match(/Updated/g) || []).length;
          ctx.sdk.emit("handler.completed", {
            handler: "feedback-echo-sync",
            summary: `Updated ${updatedCount} agent last-eval.md files`,
          });
          resolve();
        } else {
          ctx.sdk.emit("handler.failed", {
            handler: "feedback-echo-sync",
            error: `Exit code ${code}: ${stderr.slice(0, 200)}`,
          });
          reject(new Error(`feedback-echo.ts exited with code ${code}: ${stderr.slice(0, 200)}`));
        }
      });

      proc.on("error", (err) => {
        ctx.sdk.emit("handler.failed", {
          handler: "feedback-echo-sync",
          error: err.message,
        });
        reject(err);
      });
    });
  };
};
