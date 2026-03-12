/**
 * Heartbeat Pre-Check — JS guard that skips empty heartbeats.
 *
 * Before spawning an LLM heartbeat session, this handler checks whether
 * the target agent actually has work to do:
 *
 *   1. Undelivered notifications for this agent?
 *   2. Unchecked items in workspace/todo.md?
 *   3. Overdue tasks in periodic-tasks.md?
 *
 * If ALL checks are empty → skip the heartbeat (log and return).
 * If ANY check has work OR any check fails → fire the LLM heartbeat.
 *
 * Conservative design: on error, we always fire the heartbeat. False positives
 * (unnecessary LLM calls) are the current behavior — no regression possible.
 *
 * handlerConfig:
 *   - agent: string — which agent to pre-check (required)
 *   - heartbeatMessage: string — the message to pass to manager.run() if work exists
 *   - overdueThresholdDays: number — how many days before a periodic task is "overdue" (default: 7)
 *
 * Exports create() conforming to HandlerModule.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { HandlerContext, HandlerModule } from "../../../src/lib/handler-context.js";
import type { CronEntry } from "../../../src/lib/cron-tool.js";

// ── Types ─────────────────────────────────────────────────────────────

interface PrecheckConfig {
  agent: string;
  heartbeatMessage: string;
  overdueThresholdDays?: number;
  /** If true, wait for the heartbeat session to finish and send the agent's
   *  final message to the human via Telegram (ctx.notify). Non-blocking —
   *  the handler returns immediately, notification is sent async. */
  notifyBrief?: boolean;
}

interface PrecheckResult {
  hasNotifications: boolean;
  hasTodoItems: boolean;
  hasOverdueTasks: boolean;
  overdueTasks: string[];
  todoCount: number;
  notificationCount: number;
  error?: string;
}

// ── Factory ───────────────────────────────────────────────────────────

export const create: HandlerModule["create"] = (ctx: HandlerContext, entry: CronEntry) => {
  const config = (entry.handlerConfig || {}) as unknown as PrecheckConfig;

  if (!config.agent) {
    ctx.log(`[heartbeat-precheck] ERROR: no agent in handlerConfig for ${entry.name}`);
    // Return a handler that always fires the heartbeat (safe fallback)
    return async () => {
      ctx.log(`[heartbeat-precheck:${entry.name}] No agent configured — firing heartbeat unconditionally`);
      ctx.manager.run(config.agent || "may", config.heartbeatMessage || entry.message, { source: "cron" });
    };
  }

  const agentName = config.agent;
  const heartbeatMessage = config.heartbeatMessage || entry.message;
  const overdueThresholdDays = config.overdueThresholdDays ?? 7;
  const notifyBrief = config.notifyBrief === true;

  return async () => {
    let result: PrecheckResult;
    try {
      result = runPrecheck(ctx, agentName, overdueThresholdDays);
    } catch (err) {
      // Pre-check failed — fire heartbeat to be safe
      const errMsg = err instanceof Error ? err.message : String(err);
      ctx.log(`[heartbeat-precheck:${agentName}] Pre-check error: ${errMsg} — firing heartbeat`);
      const sessionId = ctx.manager.run(agentName, heartbeatMessage, { source: "cron" });
      if (notifyBrief) waitAndNotify(ctx, agentName, sessionId);
      return;
    }

    const hasWork = result.hasNotifications || result.hasTodoItems || result.hasOverdueTasks;

    if (hasWork) {
      const reasons: string[] = [];
      if (result.hasNotifications) reasons.push(`${result.notificationCount} notification(s)`);
      if (result.hasTodoItems) reasons.push(`${result.todoCount} todo item(s)`);
      if (result.hasOverdueTasks) reasons.push(`overdue: ${result.overdueTasks.join(", ")}`);
      ctx.log(`[heartbeat-precheck:${agentName}] Work found (${reasons.join("; ")}) — firing heartbeat`);
      const sessionId = ctx.manager.run(agentName, heartbeatMessage, { source: "cron" });
      if (notifyBrief) waitAndNotify(ctx, agentName, sessionId);
    } else {
      ctx.log(`[heartbeat-precheck:${agentName}] No work — skipping heartbeat`);
    }
  };
};

// ── Async brief notification ──────────────────────────────────────────

/**
 * Wait for a heartbeat session to finish, then send the agent's last
 * assistant message to the human via ctx.notify(). Non-blocking — runs
 * in background, errors are logged and swallowed.
 */
function waitAndNotify(ctx: HandlerContext, agentName: string, sessionId: string): void {
  ctx.manager.waitFor(sessionId).then((taskResult) => {
    const text = taskResult.lastAssistantText?.trim();
    if (!text) {
      ctx.log(`[heartbeat-precheck:${agentName}] Session finished but no assistant text — skipping brief`);
      return;
    }
    // Prefix with agent name so the human knows who's reporting
    const brief = `📋 *${agentName}* heartbeat brief:\n\n${text}`;
    ctx.notify(brief);
    ctx.log(`[heartbeat-precheck:${agentName}] Brief sent (${text.length} chars)`);
  }).catch((err: unknown) => {
    const errMsg = err instanceof Error ? err.message : String(err);
    ctx.log(`[heartbeat-precheck:${agentName}] Failed to get brief: ${errMsg}`);
  });
}

// ── Pre-check logic ───────────────────────────────────────────────────

export function runPrecheck(
  ctx: HandlerContext,
  agentName: string,
  overdueThresholdDays: number,
): PrecheckResult {
  const result: PrecheckResult = {
    hasNotifications: false,
    hasTodoItems: false,
    hasOverdueTasks: false,
    overdueTasks: [],
    todoCount: 0,
    notificationCount: 0,
  };

  // ── Check 1: Undelivered notifications ──────────────────────────────
  result.notificationCount = checkNotifications(ctx, agentName);
  result.hasNotifications = result.notificationCount > 0;

  // ── Check 2: Unchecked TODO items ───────────────────────────────────
  result.todoCount = checkTodoItems(ctx, agentName);
  result.hasTodoItems = result.todoCount > 0;

  // ── Check 3: Overdue periodic tasks ─────────────────────────────────
  const overdue = checkPeriodicTasks(ctx, agentName, overdueThresholdDays);
  result.overdueTasks = overdue;
  result.hasOverdueTasks = overdue.length > 0;

  return result;
}

// ── Check 1: Notifications ────────────────────────────────────────────

function checkNotifications(ctx: HandlerContext, agentName: string): number {
  // Check undelivered-notifications.jsonl for entries targeting this agent
  const fallbackPath = join(ctx.persistDir, "undelivered-notifications.jsonl");
  if (!existsSync(fallbackPath)) return 0;

  try {
    const raw = readFileSync(fallbackPath, "utf-8").trim();
    if (!raw) return 0;

    let count = 0;
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        // Notification is for this agent if the parentAgent matches
        // (the agent that delegated the completed task)
        if (entry.parentAgent === agentName) count++;
      } catch {
        // Malformed line — skip
      }
    }
    return count;
  } catch {
    return 0;
  }
}

// ── Check 2: TODO items ──────────────────────────────────────────────

function checkTodoItems(ctx: HandlerContext, agentName: string): number {
  const todoPath = join(ctx.agentsRoot, agentName, "workspace", "todo.md");
  if (!existsSync(todoPath)) return 0;

  try {
    const content = readFileSync(todoPath, "utf-8");
    return countUncheckedItems(content);
  } catch {
    return 0;
  }
}

/**
 * Count unchecked TODO items (lines matching `- [ ]`).
 * Ignores checked items (`- [x]` / `- [X]`) and content outside TODO sections.
 */
export function countUncheckedItems(content: string): number {
  let count = 0;
  // Simple approach: count lines starting with `- [ ]` (unchecked checkbox)
  // This matches the standard heartbeat pattern where agents look for unchecked items.
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (/^- \[ \]/.test(trimmed)) {
      count++;
    }
  }
  return count;
}

// ── Check 3: Periodic tasks ──────────────────────────────────────────

/**
 * Parse periodic-tasks.md and find tasks that are overdue.
 *
 * Format expected:
 *   - [x] **Task Name** — Last done: YYYY-MM-DD
 *   - [ ] **Task Name** — Last done: never
 *
 * A task is overdue if:
 *   - Its checkbox is unchecked (- [ ]) AND it has a "Last done: never" or old date
 *   - OR its "Last done" date is older than overdueThresholdDays
 *
 * We use section headers to determine frequency:
 *   - "Per heartbeat" / "Daily" → overdue after 2 days
 *   - "Weekly" → overdue after 9 days
 *   - "Monthly" → overdue after 35 days
 *   - Default → overdueThresholdDays parameter
 */
export function checkPeriodicTasks(
  ctx: HandlerContext,
  agentName: string,
  defaultOverdueDays: number,
): string[] {
  const periodicPath = join(ctx.agentsRoot, agentName, "periodic-tasks.md");
  if (!existsSync(periodicPath)) return [];

  let content: string;
  try {
    content = readFileSync(periodicPath, "utf-8");
  } catch {
    return [];
  }

  return parseOverdueTasks(content, defaultOverdueDays);
}

export function parseOverdueTasks(content: string, defaultOverdueDays: number): string[] {
  const lines = content.split("\n");
  const overdue: string[] = [];
  const now = new Date();

  // Track current section frequency
  let sectionOverdueDays = defaultOverdueDays;

  for (const line of lines) {
    // Detect section headers for frequency
    const headerMatch = line.match(/^##\s+(.+)/);
    if (headerMatch) {
      const header = headerMatch[1].toLowerCase();
      if (header.includes("per heartbeat") || header.includes("daily")) {
        sectionOverdueDays = 2;
      } else if (header.includes("weekly")) {
        sectionOverdueDays = 9;
      } else if (header.includes("monthly")) {
        sectionOverdueDays = 35;
      } else {
        sectionOverdueDays = defaultOverdueDays;
      }
      continue;
    }

    // Match any task line that contains "Last done:"
    // We don't care about checkbox state — only the date matters for overdueness.
    // Formats seen in the wild:
    //   - [x] **Analysis review** — Last done: 2026-03-10
    //   - [ ] **Handler health check** — Last done: never
    //   - [x] **Daily Brief — Last done: 2026-03-10**
    //   - [x] **Synthesis Brief** — Last done: 2026-W11
    if (!/^- \[.\]/.test(line)) continue;

    const lastDoneMatch = line.match(/(?:Last done|last done):\s*(.+?)(?:\s*\*{0,2}\s*$)/i);
    if (!lastDoneMatch) continue;

    const lastDoneStr = lastDoneMatch[1].trim();

    // Extract task name: text after ** up to either the closing ** or " — Last done"
    const nameMatch = line.match(/\*\*(.+?)(?:\*\*|(?:\s*—\s*Last done))/i);
    const taskName = nameMatch ? nameMatch[1].replace(/\s*—\s*$/, "").trim() : "unknown task";

    if (lastDoneStr.toLowerCase() === "never") {
      overdue.push(taskName);
      continue;
    }

    // Parse date (YYYY-MM-DD or YYYY-WXX)
    const date = parseTaskDate(lastDoneStr);
    if (!date) {
      // Can't parse date — assume potentially overdue
      overdue.push(taskName);
      continue;
    }

    const daysSince = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince >= sectionOverdueDays) {
      overdue.push(taskName);
    }
  }

  return overdue;
}

/**
 * Parse a date string from periodic-tasks.md.
 * Supports: YYYY-MM-DD, YYYY-WXX (ISO week)
 */
function parseTaskDate(str: string): Date | null {
  // YYYY-MM-DD
  const dateMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateMatch) {
    const d = new Date(`${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}T00:00:00Z`);
    return isNaN(d.getTime()) ? null : d;
  }

  // YYYY-WXX (ISO week — approximate by week number × 7 days from Jan 1)
  const weekMatch = str.match(/^(\d{4})-W(\d{1,2})/);
  if (weekMatch) {
    const year = parseInt(weekMatch[1]);
    const week = parseInt(weekMatch[2]);
    // Approximate: Jan 1 + (week - 1) * 7 days
    const jan1 = new Date(`${year}-01-01T00:00:00Z`);
    const d = new Date(jan1.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}
