/**
 * coaching-feedback — Evaluation → Coaching feedback loop.
 *
 * Reads recent convention_checks from may.db, groups violations by agent,
 * and sends the top violation patterns per agent to coach for targeted
 * training briefs.
 *
 * Pure JS handler — no LLM session needed.
 *
 * Exports create() conforming to HandlerModule.
 */

import type { HandlerContext, HandlerModule } from "../../shared/agent-sdk.js";
import type { CronEntry } from "../../shared/agent-sdk.js";

// ── Types ─────────────────────────────────────────────────────────────

interface ViolationSummary {
  convention: string;
  count: number;
  total: number;
  rate: number; // violation rate (0-1)
  examples: string[]; // sample violation texts
}

interface AgentViolations {
  agent: string;
  sessionCount: number;
  violations: ViolationSummary[];
}

// ── Factory ───────────────────────────────────────────────────────────

export const create: HandlerModule["create"] = (ctx: HandlerContext, entry: CronEntry) => {
  const config = (entry.handlerConfig || {}) as {
    /** How far back to look for convention checks (ms). Default: 24h */
    lookbackMs?: number;
    /** Max violations per agent to report. Default: 3 */
    topN?: number;
    /** Min violation count to report (skip noise). Default: 3 */
    minViolations?: number;
  };

  const lookbackMs = config.lookbackMs ?? 86_400_000; // 24h
  const topN = config.topN ?? 3;
  const minViolations = config.minViolations ?? 3;

  return async () => {
    const db = ctx.getDb();

    // Gather violations grouped by agent + convention
    const cutoff = Date.now() - lookbackMs;
    const rows = db.prepare(`
      SELECT agent, convention,
             COUNT(*) as total,
             SUM(CASE WHEN passed = 0 THEN 1 ELSE 0 END) as violations,
             GROUP_CONCAT(CASE WHEN passed = 0 THEN violations ELSE NULL END, '|||') as examples
      FROM convention_checks
      WHERE checked_at > ?
      GROUP BY agent, convention
      HAVING violations >= ?
      ORDER BY agent, violations DESC
    `).all(cutoff, minViolations) as Array<{
      agent: string;
      convention: string;
      total: number;
      violations: number;
      examples: string | null;
    }>;

    if (rows.length === 0) {
      ctx.log("[coaching-feedback] No significant violations in the last " + (lookbackMs / 3600000).toFixed(0) + "h. Skipping.");
      return;
    }

    // Group by agent, take top N per agent
    const byAgent = new Map<string, ViolationSummary[]>();
    for (const row of rows) {
      const list = byAgent.get(row.agent) ?? [];
      if (list.length < topN) {
        // Parse example violations (stored as JSON arrays, concatenated with |||)
        const exampleTexts: string[] = [];
        if (row.examples) {
          for (const chunk of row.examples.split("|||")) {
            try {
              const parsed = JSON.parse(chunk);
              if (Array.isArray(parsed)) {
                for (const v of parsed.slice(0, 2)) {
                  exampleTexts.push(typeof v === "string" ? v.slice(0, 120) : String(v).slice(0, 120));
                }
              }
            } catch {
              // Not valid JSON — use raw text
              if (chunk.trim()) exampleTexts.push(chunk.trim().slice(0, 120));
            }
            if (exampleTexts.length >= 3) break;
          }
        }

        list.push({
          convention: row.convention,
          count: row.violations,
          total: row.total,
          rate: row.violations / row.total,
          examples: exampleTexts.slice(0, 3),
        });
      }
      byAgent.set(row.agent, list);
    }

    // Skip meta-agents (may, coach themselves don't need coaching from coach)
    const skipAgents = new Set(["may", "coach"]);

    // Build coaching brief per agent and send to coach
    let sentCount = 0;
    for (const [agent, violations] of byAgent) {
      if (skipAgents.has(agent)) continue;

      const violationLines = violations.map(v => {
        const rateStr = (v.rate * 100).toFixed(0) + "%";
        const exStr = v.examples.length > 0 ? "\n    Examples: " + v.examples.join("; ") : "";
        return `  - ${v.convention}: ${v.count}/${v.total} sessions (${rateStr})${exStr}`;
      }).join("\n");

      const brief = [
        `[coaching-feedback] Convention violation brief for ${agent}`,
        `Period: last ${(lookbackMs / 3600000).toFixed(0)}h`,
        ``,
        `Top ${violations.length} violation patterns:`,
        violationLines,
        ``,
        `Action: Review these patterns and consider:`,
        `1. Adding a targeted rule to ${agent}'s SOUL.md or heartbeat`,
        `2. Creating a gym scenario to train this specific behavior`,
        `3. Checking if a shared skill addresses this pattern`,
      ].join("\n");

      // Send to coach via event system
      ctx.emit({
        type: "message_created",
        fromEntity: "may:coaching-feedback",
        toAgent: "coach",
        method: "send",
        task: brief,
        source: "cron:coaching-feedback",
        priority: "P2",
      });

      sentCount++;
      ctx.log(`[coaching-feedback] Sent brief for ${agent} (${violations.length} patterns)`);
    }

    // Also log a summary for human visibility
    const summary = Array.from(byAgent.entries())
      .filter(([a]) => !skipAgents.has(a))
      .map(([a, v]) => `${a}: ${v.map(x => x.convention + "(" + x.count + ")").join(", ")}`)
      .join(" | ");

    ctx.log(`[coaching-feedback] Sent ${sentCount} coaching briefs. Summary: ${summary}`);
  };
};
