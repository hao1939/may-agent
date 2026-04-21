/**
 * context-learning — Extract lessons from failed sessions and persist to context.md.
 *
 * Runs every 2 hours. Queries recent failed/errored sessions, checks which
 * ones haven't been processed yet, then dispatches an agent session to
 * extract "When X, do Y" lessons and append them to the agent's context.md.
 *
 * This replaces the blocked M2/M3 of context-learning-impl (which needed
 * src/lib/manager.ts runtime hooks). Instead, it runs as a cron handler
 * that forks an agent to do the LLM extraction.
 *
 * State tracking: writes processed session IDs to .state/context-learning-processed.json
 *
 * Exports create() conforming to HandlerModule.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import type { HandlerContext, HandlerModule } from "../../../src/lib/handler-context.js";
import type { CronEntry } from "../../../src/lib/cron-tool.js";
import { runAgentTask } from "./run-agent-task.js";

const STATE_FILE = ".state/context-learning-processed.json";
const LOOKBACK_MS = 4 * 60 * 60 * 1000; // 4 hours
const MAX_LESSONS_PER_AGENT = 15;
const MIN_QUALITY_THRESHOLD = 4; // Only learn from sessions scoring below this

// Agents that should learn from their failures
const LEARNING_AGENTS = ["bob", "coach", "tech-lead", "scout", "qa"];

// ── Factory ───────────────────────────────────────────────────────────

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  return async () => {
    const db = ctx.getDb();
    const now = Date.now();
    const cutoff = now - LOOKBACK_MS;

    // Load processed set
    const statePath = join(ctx.projectRoot, STATE_FILE);
    let processed: Set<string>;
    try {
      const data = JSON.parse(readFileSync(statePath, "utf-8"));
      processed = new Set(data.sessionIds || []);
    } catch {
      processed = new Set();
    }

    // Find failed/low-quality sessions in the lookback window
    const candidates = db.prepare(`
      SELECT s.sessionId, s.agent, s.task, s.error, s.outcome, s.opCount,
             e.quality, e.verdict, e.issues, e.failureChains,
             d.what_happened
      FROM sessions s
      LEFT JOIN evaluations e ON e.sessionId = s.sessionId
      LEFT JOIN session_digests d ON d.sessionId = s.sessionId AND d.trigger = 'end'
      WHERE s.status = 'done'
        AND s.startedAt > ?
        AND s.agent IN (${LEARNING_AGENTS.map(() => '?').join(',')})
        AND (
          s.error IS NOT NULL AND s.error != ''
          OR e.quality < ?
          OR e.verdict IN ('fail', 'poor')
        )
      GROUP BY s.sessionId
      ORDER BY s.startedAt DESC
      LIMIT 20
    `).all(cutoff, ...LEARNING_AGENTS, MIN_QUALITY_THRESHOLD) as any[];

    // Filter out already-processed
    const unprocessed = candidates.filter(c => !processed.has(c.sessionId));

    if (unprocessed.length === 0) {
      ctx.log("[context-learning] No new failed sessions to learn from.");
      return;
    }

    // Group by agent
    const byAgent = new Map<string, typeof unprocessed>();
    for (const s of unprocessed) {
      const list = byAgent.get(s.agent) || [];
      list.push(s);
      byAgent.set(s.agent, list);
    }

    let dispatched = 0;

    for (const [agent, sessions] of byAgent) {
      // Build summary of failures for the extraction agent
      const failureSummaries = sessions.map((s, i) => {
        const parts = [
          `### Failure ${i + 1}: ${s.sessionId}`,
          `**Task**: ${(s.task || "").slice(0, 200)}`,
          `**Error**: ${s.error || "none"}`,
          `**Outcome**: ${(s.outcome || "").slice(0, 300)}`,
          `**What happened**: ${(s.what_happened || "").slice(0, 300)}`,
          `**Quality**: ${s.quality ?? "unknown"}/10`,
          `**Verdict**: ${s.verdict || "unknown"}`,
          `**Issues**: ${(s.issues || "[]").slice(0, 300)}`,
        ];
        return parts.join("\n");
      }).join("\n\n");

      const task = [
        `You are extracting lessons from failed sessions for agent "${agent}".`,
        ``,
        `## Failed Sessions`,
        failureSummaries,
        ``,
        `## Your Job`,
        `For each failure above, extract a concise, actionable lesson the agent should remember.`,
        ``,
        `Rules:`,
        `1. Write each lesson as: "When X, do Y instead of Z — because [reason]"`,
        `2. Focus on the ROOT CAUSE of wasted effort, not the final fix`,
        `3. Max 2 sentences per lesson`,
        `4. Skip if the failure was external (timeout, infra) — only extract if the agent made an avoidable mistake`,
        `5. Skip if a similar lesson already exists in the agent's context.md`,
        ``,
        `## Steps`,
        `1. Read agents/${agent}/context.md to see existing lessons (look for "## Learned from experience" section)`,
        `2. For each failure, decide: extractable lesson or skip?`,
        `3. For each extractable lesson, append it to agents/${agent}/context.md under "## Learned from experience"`,
        `   - If that section doesn't exist, create it at the end of the file`,
        `   - Format: \`- When X, do Y instead of Z — because [reason] (source: SESSION_ID, DATE)\``,
        `4. If there are more than ${MAX_LESSONS_PER_AGENT} lessons in that section, remove the oldest ones (top of list)`,
        `5. Commit with message: "context-learning: add lessons for ${agent} from failed sessions"`,
        ``,
        `IMPORTANT: Do NOT edit any files other than agents/${agent}/context.md`,
      ].join("\n");

      // Fork bob to extract lessons — no waiting, fire-and-forget
      await runAgentTask(ctx, {
        agent: "bob",
        message: task,
        waitForCompletion: false,
      });

      dispatched++;
      ctx.log(`[context-learning] Forked bob to extract lessons for ${agent} (${sessions.length} failures)`);

      // Mark as processed
      for (const s of sessions) {
        processed.add(s.sessionId);
      }
    }

    // Persist processed set (keep last 500 to prevent unbounded growth)
    const processedArr = [...processed].slice(-500);
    mkdirSync(dirname(statePath), { recursive: true });
    writeFileSync(statePath, JSON.stringify({ sessionIds: processedArr, lastRun: now }, null, 2));

    ctx.log(`[context-learning] Done. Dispatched ${dispatched} extraction tasks from ${unprocessed.length} failed sessions.`);
  };
};
