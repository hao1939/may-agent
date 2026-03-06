/**
 * Drain-todo — agent-owned cron handler.
 *
 * Reads an agent's workspace/todo.md, parses the top TODO item, and
 * delegates it (followUp for self, run for others). Pure JS — no LLM needed.
 *
 * Supports multiple cron entries via handlerConfig in cron.json:
 *   { "handler": "drain-todo", "handlerConfig": { "sourceAgent": "bob", "targetAgent": "bob", "mode": "run" } }
 *
 * Exports create() conforming to HandlerModule.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { HandlerContext, HandlerModule } from "../../../run/handler-context.js";
import type { CronEntry } from "../../../src/cron-tool.js";

// ── Factory ───────────────────────────────────────────────────────────

export const create: HandlerModule["create"] = (ctx: HandlerContext, entry: CronEntry) => {
  const config = (entry.handlerConfig || {}) as {
    sourceAgent?: string;
    targetAgent?: string;
    mode?: "run" | "followUp";
  };

  const sourceAgent = config.sourceAgent || ctx.agentName;
  const targetAgent = config.targetAgent || sourceAgent;
  const mode = config.mode || (sourceAgent === ctx.agentName ? "followUp" : "run");

  return async () => {
    const todoPath = join(ctx.agentsRoot, sourceAgent, "workspace", "todo.md");

    if (!existsSync(todoPath)) {
      ctx.log(`[drain-todo:${sourceAgent}] No todo.md found — skipping`);
      return;
    }

    let content: string;
    try { content = readFileSync(todoPath, "utf-8"); }
    catch (err) { ctx.log(`[drain-todo:${sourceAgent}] Failed to read todo.md: ${err}`); return; }

    const items = parseTodoItems(content);
    if (items.length === 0) {
      ctx.log(`[drain-todo:${sourceAgent}] No TODO items — skipping`);
      return;
    }

    const topItem = items[0];
    const preview = topItem.length > 120 ? topItem.substring(0, 120) + "..." : topItem;
    ctx.log(`[drain-todo:${sourceAgent}] Found ${items.length} item(s), delegating top to ${targetAgent}: ${preview}`);

    if (mode === "followUp") {
      const sid = ctx.getSessionId();
      if (!sid) { ctx.log(`[drain-todo:${sourceAgent}] ERROR: no active session for followUp`); return; }
      const taskMessage = `[cron:drain-todo] Work on this TODO item from your workspace/todo.md. When done, move it to # Tracking with result (✅/⚠️/❌).\n\n${topItem}`;
      ctx.manager.followUp(sid, taskMessage, "cron");
    } else {
      const taskMessage = `Work on this TODO item from your workspace/todo.md. When done, update the file — move the completed item to # Tracking with result (✅/⚠️/❌). Stop after this one item.\n\n${topItem}`;
      const sessionId = ctx.manager.run(targetAgent, taskMessage, { source: "cron" });
      ctx.log(`[drain-todo:${sourceAgent}] Started session ${sessionId} for ${targetAgent}`);
    }
  };
};

// ── Parsing ───────────────────────────────────────────────────────────

export function parseTodoItems(content: string): string[] {
  const lines = content.split("\n");
  const items: string[] = [];
  let inTodoSection = false;
  let currentItem: string[] = [];

  for (const line of lines) {
    if (/^# TODO\b/i.test(line)) { inTodoSection = true; continue; }
    if (inTodoSection && /^# [^#]/.test(line) && !/^# TODO\b/i.test(line)) {
      if (currentItem.length > 0) { items.push(currentItem.join("\n").trim()); currentItem = []; }
      break;
    }
    if (!inTodoSection) continue;
    if (/^## /.test(line)) {
      if (currentItem.length > 0) { items.push(currentItem.join("\n").trim()); currentItem = []; }
      continue;
    }
    if (/^- /.test(line)) {
      // Flush any pending item
      if (currentItem.length > 0) items.push(currentItem.join("\n").trim());
      // Skip completed items: checked checkbox or strikethrough
      if (/^- \[x\]/i.test(line) || /^- ~~/.test(line)) {
        currentItem = [];
        continue;
      }
      currentItem = [line];
      continue;
    }
    if (currentItem.length > 0) currentItem.push(line);
  }
  if (currentItem.length > 0) items.push(currentItem.join("\n").trim());
  return items;
}
