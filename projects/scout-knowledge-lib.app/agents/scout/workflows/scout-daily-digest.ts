/**
 * Scout daily digest — compile findings and send to Hao via Telegram.
 *
 * Runs as a cron task. Reads today.md, formats digest, emits to human
 * (Telegram picks up message.created to="human"), archives, resets.
 */
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  renameSync,
} from "node:fs";
import { join, resolve } from "node:path";
import type { WorkflowContext, WorkflowResult } from "@may-agent/sdk";

export const name = "scout-daily-digest";
export const description = "Compile and send daily research digest.";

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const agentsRoot =
    ctx.agentsRoot || resolve(import.meta.dirname ?? ".", "../..");
  const digestDir = join(agentsRoot, "scout", "workspace", "digest");
  const todayFile = join(digestDir, "today.md");

  mkdirSync(digestDir, { recursive: true });

  // Read today's accumulated findings
  let todayContent = "";
  if (existsSync(todayFile)) {
    todayContent = readFileSync(todayFile, "utf-8").trim();
  }

  if (!todayContent) {
    ctx.log("[scout-daily-digest] No findings today — skipping digest.");
    const summary = "No findings to digest today.";
    return ctx.done(summary, {
      state: "converged",
      summary,
      evidence: [`digest:${todayFile}`],
      actions: [],
    });
  }

  // Format date
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);

  // Build digest message
  const digest = `📡 Scout Daily Digest — ${dateStr}\n\n${todayContent}`;

  // Send to human via bus event (Telegram picks this up)
  ctx.emit({
    type: "message.created",
    from: "scout",
    to: "human",
    content: digest,
    intent: "daily-digest",
    priority: "P2",
  });

  ctx.log(
    `[scout-daily-digest] Sent digest (${todayContent.length} chars) to human.`,
  );

  // Archive today.md
  const archivePath = join(digestDir, `${dateStr}.md`);
  renameSync(todayFile, archivePath);

  // Create fresh today.md
  writeFileSync(
    todayFile,
    `# Scout Findings — ${new Date(now.getTime() + 86400000).toISOString().slice(0, 10)}\n\n`,
  );

  const summary = `Daily digest sent (${dateStr}). Archived to ${dateStr}.md.`;
  return ctx.done(summary, {
    state: "converged",
    summary,
    evidence: [`digest:${archivePath}`],
    actions: [],
  });
}
