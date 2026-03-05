/**
 * Drain-todo — pure JS replacement for the drain-todo LLM calls.
 *
 * Previously, three cron jobs fired followUp messages into May's LLM session:
 *   - drain-todo: May reads its own todo.md and works on the top item
 *   - optimizer-drain-todo: May reads optimizer's todo.md and delegates to optimizer
 *   - bob-drain-todo: May reads bob's todo.md and delegates to bob
 *
 * All three follow the same formulaic pattern: read file → parse TODO items →
 * delegate to target agent. No reasoning needed — purely mechanical routing.
 *
 * This module replaces all three with a single JS handler:
 *   1. Read the agent's workspace/todo.md
 *   2. Parse items under the first `# TODO` heading
 *   3. If items exist, delegate to the target agent with the top item text
 *   4. If no items, skip silently
 *
 * For May's own drain-todo, uses manager.followUp() to send the task into
 * May's persistent session. For other agents, uses manager.run() to spawn
 * a new session.
 *
 * Cost saved: ~$0.30/call × 12.5 firings/day = ~$3.75/day
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { SubagentManager } from "../src/index.js";

export interface DrainTodoOptions {
  /** Path to the agents directory (e.g., /home/example-user/may-agent/agents) */
  agentsRoot: string;
  /** The SubagentManager instance for delegation */
  manager: SubagentManager;
  /** Callback for logging (optional) */
  onLog?: (message: string) => void;
}

/**
 * Configuration for a single drain-todo job.
 */
export interface DrainTodoJobConfig {
  /** The agent whose todo.md to read */
  sourceAgent: string;
  /** The agent to delegate the task to (may differ from sourceAgent) */
  targetAgent: string;
  /**
   * How to delegate:
   * - "run": spawn a new session via manager.run() (for optimizer, bob, etc.)
   * - "followUp": send into an existing persistent session (for may's own todo)
   */
  mode: "run" | "followUp";
  /**
   * Session ID getter — required when mode is "followUp".
   * Returns the session ID of the persistent session to send the followUp to.
   */
  getSessionId?: () => string;
}

/**
 * Parse TODO items from a todo.md file.
 *
 * Looks for lines under the first `# TODO` heading, stopping at the next
 * heading of equal or higher level (# or ##) that isn't a sub-section of TODO.
 * Each item is a `- ` or `- [ ]` prefixed line (the full line including
 * continuation lines until the next list item or heading).
 */
export function parseTodoItems(content: string): string[] {
  const lines = content.split("\n");
  const items: string[] = [];

  let inTodoSection = false;
  let currentItem: string[] = [];

  for (const line of lines) {
    // Detect the # TODO heading (must be exactly "# TODO", not "## TODO")
    if (/^# TODO\b/i.test(line)) {
      inTodoSection = true;
      continue;
    }

    // If we're in the TODO section and hit another top-level heading, stop
    if (inTodoSection && /^# [^#]/.test(line) && !/^# TODO\b/i.test(line)) {
      // Save any in-progress item
      if (currentItem.length > 0) {
        items.push(currentItem.join("\n").trim());
        currentItem = [];
      }
      break;
    }

    if (!inTodoSection) continue;

    // Detect ## sub-headings within TODO (e.g., "## Research Tasks")
    // These are part of the TODO section, not a boundary
    if (/^## /.test(line)) {
      // Save any in-progress item before the sub-heading
      if (currentItem.length > 0) {
        items.push(currentItem.join("\n").trim());
        currentItem = [];
      }
      continue;
    }

    // New list item (- or - [ ])
    if (/^- /.test(line)) {
      // Save previous item
      if (currentItem.length > 0) {
        items.push(currentItem.join("\n").trim());
      }
      currentItem = [line];
      continue;
    }

    // Continuation line (indented or blank within an item)
    if (currentItem.length > 0) {
      currentItem.push(line);
    }
  }

  // Don't forget the last item
  if (currentItem.length > 0) {
    items.push(currentItem.join("\n").trim());
  }

  return items;
}

/**
 * Create a drain-todo handler for a specific job configuration.
 *
 * Returns an async function suitable for cron.registerHandler().
 */
export function createDrainTodoHandler(
  config: DrainTodoJobConfig,
  opts: DrainTodoOptions,
): () => Promise<void> {
  const { sourceAgent, targetAgent, mode, getSessionId } = config;
  const { agentsRoot, manager, onLog } = opts;

  return async () => {
    const todoPath = join(agentsRoot, sourceAgent, "workspace", "todo.md");

    // Step 1: Check if file exists
    if (!existsSync(todoPath)) {
      onLog?.(`[drain-todo:${sourceAgent}] No todo.md found — skipping`);
      return;
    }

    // Step 2: Read and parse
    let content: string;
    try {
      content = readFileSync(todoPath, "utf-8");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onLog?.(`[drain-todo:${sourceAgent}] Failed to read todo.md: ${msg}`);
      return;
    }

    const items = parseTodoItems(content);

    if (items.length === 0) {
      onLog?.(`[drain-todo:${sourceAgent}] No TODO items — skipping`);
      return;
    }

    // Step 3: Take the top item
    const topItem = items[0];

    // Truncate for logging (first 120 chars)
    const preview = topItem.length > 120
      ? topItem.substring(0, 120) + "..."
      : topItem;

    onLog?.(`[drain-todo:${sourceAgent}] Found ${items.length} item(s), delegating top item to ${targetAgent}: ${preview}`);

    // Step 4: Delegate
    if (mode === "followUp") {
      // Send into May's own persistent session
      if (!getSessionId) {
        onLog?.(`[drain-todo:${sourceAgent}] ERROR: followUp mode requires getSessionId`);
        return;
      }
      const sid = getSessionId();
      const taskMessage = `[cron:drain-todo] Work on this TODO item from your workspace/todo.md. When done, move it to # Tracking with result (✅/⚠️/❌).\n\n${topItem}`;
      manager.followUp(sid, taskMessage, "cron");
    } else {
      // Spawn a new session for the target agent
      const taskMessage = `Work on this TODO item from your workspace/todo.md. When done, update the file — move the completed item to # Tracking with result (✅/⚠️/❌). Stop after this one item.\n\n${topItem}`;
      const sessionId = manager.run(targetAgent, taskMessage, { source: "cron" });
      onLog?.(`[drain-todo:${sourceAgent}] Started session ${sessionId} for ${targetAgent}`);
    }
  };
}
