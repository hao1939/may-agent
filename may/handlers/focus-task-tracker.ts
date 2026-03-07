/**
 * Focus-task-tracker — monitors active focus tasks for progress.
 *
 * Reads agents/shared/focus-tasks.md, checks each active task's signal,
 * logs check results, and escalates to May if a task is stuck.
 *
 * Pure JS — no LLM needed. Runs every 8h.
 *
 * Exports create() conforming to HandlerModule.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import type { HandlerContext, HandlerModule } from "../../../run/handler-context.js";
import type { CronEntry } from "../../../src/cron-tool.js";
import { appendToTodoSection } from "../../../run/todo-utils.js";

// ── Types ─────────────────────────────────────────────────────────────

interface FocusTask {
  id: string;
  title: string;
  owner: string;
  status: string;
  signal: string;
  escalateAfter: number;
  checks: Array<{ date: string; result: "pass" | "fail"; note: string }>;
  /** Raw line range in the file for rewriting */
  lineStart: number;
  lineEnd: number;
}

interface CheckResult {
  taskId: string;
  passed: boolean;
  note: string;
}

// ── Factory ───────────────────────────────────────────────────────────

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  const tasksPath = join(ctx.agentsRoot, "shared", "focus-tasks.md");

  return async () => {
    if (!existsSync(tasksPath)) {
      ctx.log("[focus-tracker] No focus-tasks.md found — skipping");
      return;
    }

    const content = readFileSync(tasksPath, "utf-8");
    const tasks = parseFocusTasks(content);
    const activeTasks = tasks.filter(t => t.status === "in-progress");

    if (activeTasks.length === 0) {
      ctx.log("[focus-tracker] No active focus tasks");
      return;
    }

    const results: CheckResult[] = [];

    for (const task of activeTasks) {
      const result = checkSignal(task, ctx);
      results.push(result);

      // Count consecutive fails
      const recentChecks = [...task.checks, { date: today(), result: result.passed ? "pass" as const : "fail" as const, note: result.note }];
      let consecutiveFails = 0;
      for (let i = recentChecks.length - 1; i >= 0; i--) {
        if (recentChecks[i].result === "fail") consecutiveFails++;
        else break;
      }

      if (result.passed) {
        ctx.log(`[focus-tracker] ✅ ${task.id}: ${task.title} — PASS: ${result.note}`);
      } else if (consecutiveFails >= task.escalateAfter) {
        // Escalate!
        ctx.log(`[focus-tracker] 🚨 ${task.id}: ${task.title} — ESCALATED (${consecutiveFails} consecutive fails)`);
        const escalationItem = `- [focus-tracker] ESCALATED: ${task.id} "${task.title}" — ${consecutiveFails} consecutive failed checks. Owner: ${task.owner}. Last note: ${result.note}. Review and reassign or unblock.`;
        const mayTodoPath = join(ctx.agentsRoot, "may", "workspace", "todo.md");
        appendToTodoSection(mayTodoPath, escalationItem);
        ctx.triggerNow("heartbeat");
      } else {
        ctx.log(`[focus-tracker] ❌ ${task.id}: ${task.title} — FAIL (${consecutiveFails}/${task.escalateAfter}): ${result.note}`);
      }
    }

    // Rewrite the file with updated check history
    const updatedContent = updateChecks(content, activeTasks, results);
    writeFileSync(tasksPath, updatedContent);
  };
};

// ── Signal checkers ───────────────────────────────────────────────────

function checkSignal(task: FocusTask, ctx: HandlerContext): CheckResult {
  try {
    // F1: Lean heartbeats — check average turns per heartbeat session
    if (task.id === "F1") {
      return checkLeanHeartbeats(ctx);
    }

    // F2: Pattern recognition — check if workflow proposals exist
    if (task.id === "F2") {
      return checkPatternRecognition(ctx);
    }

    // F3: Score-reactive coaching — check if coach gets todo items from evaluate-sessions
    if (task.id === "F3") {
      return checkReactiveCoaching(ctx);
    }

    // Generic: just check if the task's session completed
    if (task.signal.includes("File exists:")) {
      const pathPattern = task.signal.replace("File exists:", "").trim();
      return checkFileExists(pathPattern, ctx);
    }

    return { taskId: task.id, passed: false, note: "No signal checker for this task" };
  } catch (err) {
    return { taskId: task.id, passed: false, note: `Signal check error: ${err}` };
  }
}

function checkLeanHeartbeats(ctx: HandlerContext): CheckResult {
  // Check recent heartbeat sessions for turn count
  const sessionsDir = join(ctx.persistDir, "sessions");
  if (!existsSync(sessionsDir)) {
    return { taskId: "F1", passed: false, note: "No sessions directory" };
  }

  const sessionDirs = readdirSync(sessionsDir)
    .filter(d => d.startsWith("s_"))
    .sort()
    .slice(-50); // last 50 sessions

  let heartbeatSessions = 0;
  let totalTurns = 0;

  for (const dir of sessionDirs) {
    const metaPath = join(sessionsDir, dir, "meta.json");
    if (!existsSync(metaPath)) continue;
    try {
      const meta = JSON.parse(readFileSync(metaPath, "utf-8"));
      if (meta.task && typeof meta.task === "string" && meta.task.includes("[heartbeat]")) {
        heartbeatSessions++;
        totalTurns += meta.turnsUsed || 0;
      }
    } catch { continue; }
  }

  if (heartbeatSessions === 0) {
    return { taskId: "F1", passed: false, note: "No heartbeat sessions found in recent history" };
  }

  const avg = totalTurns / heartbeatSessions;
  const passed = avg < 6;
  return {
    taskId: "F1",
    passed,
    note: `${heartbeatSessions} heartbeat sessions, avg ${avg.toFixed(1)} turns (target: <6)`,
  };
}

function checkPatternRecognition(ctx: HandlerContext): CheckResult {
  const proposalsDir = join(ctx.agentsRoot, "shared", "workflow-proposals");
  if (!existsSync(proposalsDir)) {
    return { taskId: "F2", passed: false, note: "workflow-proposals/ directory doesn't exist yet" };
  }

  const files = readdirSync(proposalsDir).filter(f => f.endsWith(".md"));
  if (files.length === 0) {
    return { taskId: "F2", passed: false, note: "workflow-proposals/ exists but empty — no proposals yet" };
  }

  return {
    taskId: "F2",
    passed: true,
    note: `${files.length} proposal(s) found: ${files.join(", ")}`,
  };
}

function checkReactiveCoaching(ctx: HandlerContext): CheckResult {
  // Check if coach's todo.md has any items written by evaluate-sessions
  const coachTodoPath = join(ctx.agentsRoot, "coach", "workspace", "todo.md");
  if (!existsSync(coachTodoPath)) {
    return { taskId: "F3", passed: false, note: "Coach todo.md doesn't exist" };
  }

  const content = readFileSync(coachTodoPath, "utf-8");
  const hasReactiveItems = content.includes("verdict: needs_improvement") ||
                           content.includes("[evaluate-sessions]");

  if (hasReactiveItems) {
    return { taskId: "F3", passed: true, note: "Coach todo.md has evaluate-sessions triggered items" };
  }

  // No bad evals may just mean everything is scoring well — check if evaluate-sessions ran recently
  return {
    taskId: "F3",
    passed: false,
    note: "No reactive coaching items in coach's todo.md (may just mean no bad evals yet — not necessarily broken)",
  };
}

function checkFileExists(pathPattern: string, ctx: HandlerContext): CheckResult {
  const resolvedPath = pathPattern.startsWith("/")
    ? pathPattern
    : join(ctx.agentsRoot, "..", pathPattern);

  if (pathPattern.includes("*")) {
    // Glob-like: check directory for any matching files
    const dir = resolvedPath.replace(/\/\*.*$/, "");
    const ext = pathPattern.includes(".md") ? ".md" : "";
    if (!existsSync(dir)) {
      return { taskId: "?", passed: false, note: `Directory ${dir} doesn't exist` };
    }
    const files = readdirSync(dir).filter(f => !ext || f.endsWith(ext));
    return {
      taskId: "?",
      passed: files.length > 0,
      note: files.length > 0 ? `${files.length} file(s) found` : "Directory empty",
    };
  }

  return {
    taskId: "?",
    passed: existsSync(resolvedPath),
    note: existsSync(resolvedPath) ? "File exists" : "File not found",
  };
}

// ── Parser ────────────────────────────────────────────────────────────

function parseFocusTasks(content: string): FocusTask[] {
  const tasks: FocusTask[] = [];
  const lines = content.split("\n");

  let currentTask: Partial<FocusTask> | null = null;
  let taskLineStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // New task header: ### F1: Title
    const headerMatch = line.match(/^###\s+(F\d+):\s+(.+)/);
    if (headerMatch) {
      if (currentTask?.id) {
        currentTask.lineEnd = i - 1;
        tasks.push(currentTask as FocusTask);
      }
      currentTask = {
        id: headerMatch[1],
        title: headerMatch[2],
        owner: "",
        status: "",
        signal: "",
        escalateAfter: 3,
        checks: [],
        lineStart: i,
        lineEnd: lines.length - 1,
      };
      taskLineStart = i;
      continue;
    }

    if (!currentTask) continue;

    // Parse fields
    if (line.startsWith("- **Owner:**")) {
      currentTask.owner = line.replace("- **Owner:**", "").trim();
    } else if (line.startsWith("- **Status:**")) {
      currentTask.status = line.replace("- **Status:**", "").trim();
    } else if (line.startsWith("- **Signal:**")) {
      currentTask.signal = line.replace("- **Signal:**", "").trim();
    } else if (line.startsWith("- **Escalate after:**")) {
      const num = parseInt(line.replace("- **Escalate after:**", "").trim());
      if (!isNaN(num)) currentTask.escalateAfter = num;
    } else if (line.match(/^\s+-\s+\d{4}-\d{2}-\d{2}/)) {
      // Check history line: - 2026-03-07 PASS: note
      const checkMatch = line.match(/^\s+-\s+(\d{4}-\d{2}-\d{2})\s+(PASS|FAIL):\s*(.*)$/);
      if (checkMatch) {
        currentTask.checks = currentTask.checks || [];
        currentTask.checks.push({
          date: checkMatch[1],
          result: checkMatch[2].toLowerCase() as "pass" | "fail",
          note: checkMatch[3],
        });
      }
    }
  }

  if (currentTask?.id) {
    currentTask.lineEnd = lines.length - 1;
    tasks.push(currentTask as FocusTask);
  }

  return tasks;
}

function updateChecks(content: string, tasks: FocusTask[], results: CheckResult[]): string {
  const lines = content.split("\n");

  for (const task of tasks) {
    const result = results.find(r => r.taskId === task.id);
    if (!result) continue;

    const checkLine = `  - ${today()} ${result.passed ? "PASS" : "FAIL"}: ${result.note}`;

    // Find the "- **Checks:**" line for this task
    for (let i = task.lineStart; i <= Math.min(task.lineEnd, lines.length - 1); i++) {
      if (lines[i].startsWith("- **Checks:**")) {
        // Insert after this line
        lines.splice(i + 1, 0, checkLine);
        // Adjust lineEnd for subsequent tasks
        for (const other of tasks) {
          if (other.lineStart > i) {
            other.lineStart++;
            other.lineEnd++;
          }
        }
        task.lineEnd++;
        break;
      }
    }

    // Update status if escalated
    const recentChecks = [...task.checks, { date: today(), result: result.passed ? "pass" as const : "fail" as const, note: result.note }];
    let consecutiveFails = 0;
    for (let i = recentChecks.length - 1; i >= 0; i--) {
      if (recentChecks[i].result === "fail") consecutiveFails++;
      else break;
    }

    if (result.passed) {
      // Mark done if passing
      for (let i = task.lineStart; i <= Math.min(task.lineEnd, lines.length - 1); i++) {
        if (lines[i].startsWith("- **Status:**")) {
          lines[i] = "- **Status:** done ✅";
          break;
        }
      }
    } else if (consecutiveFails >= task.escalateAfter) {
      for (let i = task.lineStart; i <= Math.min(task.lineEnd, lines.length - 1); i++) {
        if (lines[i].startsWith("- **Status:**")) {
          lines[i] = "- **Status:** escalated 🚨";
          break;
        }
      }
    }
  }

  return lines.join("\n");
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
