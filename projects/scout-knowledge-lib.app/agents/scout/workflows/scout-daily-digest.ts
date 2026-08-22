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
  readdirSync,
} from "node:fs";
import { basename, join } from "node:path";
import type { ExecutionResult, WorkflowContext } from "@may-agent/sdk";
import { taskEmissionKey } from "./lib/task-emission.js";

export const name = "scout-daily-digest";
export const description = "Compile and send daily research digest.";

function heading(date: string): string {
  return `# Scout Findings — ${date}\n\n`;
}

export function normalizedDigestBody(content: string): string {
  return content
    .replace(/^# Scout Findings — \d{4}-\d{2}-\d{2}\s*(?:\r?\n)?/, "")
    .trim();
}

function sameDayArchives(digestDir: string, date: string): string[] {
  const pattern = new RegExp(`^${date}(?:-(\\d+))?\\.md$`);
  return readdirSync(digestDir)
    .map((name) => ({ name, match: name.match(pattern) }))
    .filter(
      (entry): entry is { name: string; match: RegExpMatchArray } =>
        entry.match !== null,
    )
    .sort((left, right) => {
      const leftNumber = left.match[1] ? Number(left.match[1]) : 1;
      const rightNumber = right.match[1] ? Number(right.match[1]) : 1;
      return leftNumber - rightNumber;
    })
    .map((entry) => join(digestDir, entry.name));
}

function nextArchivePath(
  digestDir: string,
  date: string,
  archives: string[],
): string {
  if (archives.length === 0) return join(digestDir, `${date}.md`);
  let number = 2;
  while (existsSync(join(digestDir, `${date}-${number}.md`))) number += 1;
  return join(digestDir, `${date}-${number}.md`);
}

export async function execute(ctx: WorkflowContext): Promise<ExecutionResult> {
  if (!ctx.workspace)
    return ctx.blocked("Scout digest requires a canonical App workspace");
  const appDir = ctx.workspace.appRoot;
  const digestDir = join(appDir, "agents", "scout", "workspace", "digest");
  const todayFile = join(digestDir, "today.md");

  mkdirSync(digestDir, { recursive: true });

  // Read today's accumulated findings
  let todayContent = "";
  if (existsSync(todayFile)) {
    todayContent = readFileSync(todayFile, "utf-8").trim();
  }

  const todayBody = normalizedDigestBody(todayContent);
  if (!todayBody) {
    ctx.log.info("[scout-daily-digest] No findings today — skipping digest.");
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

  const archives = sameDayArchives(digestDir, dateStr);
  const identicalArchive = archives.find(
    (archive) =>
      normalizedDigestBody(readFileSync(archive, "utf-8")) === todayBody,
  );
  if (identicalArchive) {
    writeFileSync(todayFile, heading(dateStr));
    const summary = `Digest content was already archived in ${identicalArchive}; no duplicate message was sent.`;
    return ctx.done(summary, {
      state: "converged",
      summary,
      evidence: [`digest:${identicalArchive}`, "delivery:idempotent-no-op"],
      actions: [],
    });
  }

  // Build digest message
  const digest = `📡 Scout Daily Digest — ${dateStr}\n\n${todayBody}`;

  // Send to human via bus event (Telegram picks this up)
  await ctx.events.emit({
    type: "message.created",
    localKey: taskEmissionKey(ctx, "daily-digest-delivered"),
    source: "app:scout-knowledge-lib",
    owner: "human:operator",
    target: { human: true },
    data: {
      from: "scout",
      to: "human",
      content: digest,
      intent: "daily-digest",
      priority: "P2",
    },
  });

  ctx.log.info(
    `[scout-daily-digest] Sent digest (${todayBody.length} chars) to human.`,
  );

  // Archive today.md
  const archivePath = nextArchivePath(digestDir, dateStr, archives);
  renameSync(todayFile, archivePath);

  // Create fresh today.md
  writeFileSync(todayFile, heading(dateStr));

  const summary = `Daily digest sent (${dateStr}). Archived to ${basename(archivePath)}.`;
  return ctx.done(summary, {
    state: "converged",
    summary,
    evidence: [`digest:${archivePath}`],
    actions: [],
  });
}
