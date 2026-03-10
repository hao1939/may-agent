/**
 * Focus-task-tracker — monitors active focus tasks for movement.
 *
 * Focus tasks are long-running improvement programs, not tickets.
 * This tracker checks if there's been RECENT ACTIVITY on each task
 * (new sessions, file changes, phase movement) and escalates to May
 * if a task has gone quiet for too long.
 *
 * Pure JS — no LLM needed. Runs every hour.
 *
 * Exports create() conforming to HandlerModule.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { HandlerContext, HandlerModule } from "../../../src/lib/handler-context.js";
import type { CronEntry } from "../../../src/lib/cron-tool.js";
import { appendToTodoSection } from "../../../src/lib/todo-utils.js";

// ── Config ────────────────────────────────────────────────────────────

/** Hours with no activity before we warn */
const QUIET_THRESHOLD_HOURS = 24;

/** Hours with no activity before we count a stale check */
const STALE_THRESHOLD_HOURS = 48;

/** How many stale checks before escalating to May */
const ESCALATE_AFTER = 3;

// ── Factory ───────────────────────────────────────────────────────────

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  const tasksPath = join(ctx.agentsRoot, "shared", "focus-tasks.md");
  const statePath = join(ctx.persistDir, "focus-tracker-state.json");

  return async () => {
    if (!existsSync(tasksPath)) {
      ctx.log("[focus-tracker] No focus-tasks.md found — skipping");
      return;
    }

    const content = readFileSync(tasksPath, "utf-8");
    const taskIds = parseActiveTaskIds(content);

    if (taskIds.length === 0) {
      ctx.log("[focus-tracker] No active focus tasks");
      return;
    }

    // Load previous state
    const state: TrackerState = loadState(statePath);
    const now = Date.now();
    const tasksFileModTime = getFileModTime(tasksPath);

    for (const id of taskIds) {
      const prev = state[id] || { lastActivity: now, staleChecks: 0 };
      
      // Check for activity signals:
      // 1. focus-tasks.md was modified since last check
      // 2. Related sessions ran recently
      const hasFileChange = tasksFileModTime > prev.lastActivity;
      const hasRecentSessions = checkRecentSessions(id, prev.lastActivity, ctx);

      if (hasFileChange || hasRecentSessions) {
        state[id] = { lastActivity: now, staleChecks: 0 };
        ctx.log(`[focus-tracker] ✅ ${id}: Active (${hasFileChange ? "file updated" : "recent sessions"})`);
      } else {
        const hoursSince = (now - prev.lastActivity) / (1000 * 60 * 60);

        if (hoursSince > STALE_THRESHOLD_HOURS) {
          const newStaleChecks = prev.staleChecks + 1;
          state[id] = { lastActivity: prev.lastActivity, staleChecks: newStaleChecks };

          if (newStaleChecks >= ESCALATE_AFTER) {
            ctx.log(`[focus-tracker] 🚨 ${id}: STALE — no activity for ${hoursSince.toFixed(0)}h (${newStaleChecks} stale checks)`);
            const mayTodoPath = join(ctx.agentsRoot, "may", "workspace", "todo.md");
            appendToTodoSection(mayTodoPath,
              `- [focus-tracker] ⚠️ ${id} has had no activity for ${hoursSince.toFixed(0)}h. Review focus-tasks.md and push progress or acknowledge pause.`
            );
            ctx.triggerNow("heartbeat");
          } else {
            ctx.log(`[focus-tracker] ⚠️ ${id}: Quiet for ${hoursSince.toFixed(0)}h (stale ${newStaleChecks}/${ESCALATE_AFTER})`);
          }
        } else if (hoursSince > QUIET_THRESHOLD_HOURS) {
          state[id] = prev;
          ctx.log(`[focus-tracker] ⏳ ${id}: Quiet for ${hoursSince.toFixed(0)}h (not yet stale)`);
        } else {
          state[id] = prev;
          ctx.log(`[focus-tracker] ✅ ${id}: OK (${hoursSince.toFixed(0)}h since last activity)`);
        }
      }
    }

    writeFileSync(statePath, JSON.stringify(state, null, 2));
  };
};

// ── Helpers ───────────────────────────────────────────────────────────

function parseActiveTaskIds(content: string): string[] {
  const ids: string[] = [];
  const lines = content.split("\n");
  let inActive = false;

  for (const line of lines) {
    // Start collecting after "## F" headers that appear before Completed/Meta sections
    if (line.startsWith("## F") && !inActive) inActive = true;
    if (/^## (Completed|Meta)/.test(line) || line.includes("Completed Tasks")) {
      inActive = false;
    }
    if (inActive) {
      const match = line.match(/^## (F\d+):/);
      if (match) ids.push(match[1]);
    }
  }

  return ids;
}

function checkRecentSessions(taskId: string, since: number, ctx: HandlerContext): boolean {
  for (const base of [
    join(ctx.persistDir, "sessions"),
    join(ctx.persistDir, "sessions", "history"),
  ]) {
    if (!existsSync(base)) continue;
    try {
      for (const dir of readdirSync(base)) {
        if (!dir.startsWith("s_")) continue;
        const parts = dir.split("_");
        if (parts.length < 2) continue;
        const ts = parseInt(parts[1]);
        if (isNaN(ts) || ts <= since) continue;

        const metaPath = join(base, dir, "meta.json");
        if (!existsSync(metaPath)) continue;
        try {
          const meta = JSON.parse(readFileSync(metaPath, "utf-8"));
          const task = String(meta.task || "");
          if (task.includes(taskId)) return true;
        } catch { continue; }
      }
    } catch { continue; }
  }
  return false;
}

function getFileModTime(path: string): number {
  try { return statSync(path).mtimeMs; } catch { return 0; }
}

interface TrackerState {
  [taskId: string]: { lastActivity: number; staleChecks: number };
}

function loadState(path: string): TrackerState {
  if (!existsSync(path)) return {};
  try { return JSON.parse(readFileSync(path, "utf-8")); } catch { return {}; }
}
