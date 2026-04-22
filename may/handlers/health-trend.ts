/**
 * health-trend — Weekly health trend monitoring.
 *
 * Compares per-agent metrics (success rate, quality, convention pass rate)
 * this week vs last week. Alerts May if any agent drops significantly.
 *
 * Pure JS handler — no LLM session needed.
 *
 * Exports create() conforming to HandlerModule.
 */

import type { HandlerContext, HandlerModule } from "../../shared/agent-sdk.js";
import type { CronEntry } from "../../shared/agent-sdk.js";

// ── Types ─────────────────────────────────────────────────────────────

interface AgentHealth {
  agent: string;
  thisWeek: PeriodStats;
  lastWeek: PeriodStats;
  doneRateDelta: number;     // pp change
  avgQualityDelta: number;   // pp change
  conventionPassDelta: number; // pp change
}

interface PeriodStats {
  sessions: number;
  done: number;
  error: number;
  doneRate: number;          // 0-1
  avgQuality: number;        // 0-1 (from evaluations)
  conventionPassRate: number; // 0-1 (from convention_checks)
}

// ── Constants ─────────────────────────────────────────────────────────

const WEEK_MS = 7 * 86_400_000;
const ALERT_THRESHOLD_PP = 20; // Alert if any metric drops by 20+ percentage points
const MIN_SESSIONS = 5; // Need at least 5 sessions to compare meaningfully

// ── Factory ───────────────────────────────────────────────────────────

export const create: HandlerModule["create"] = (ctx: HandlerContext, entry: CronEntry) => {
  const config = (entry.handlerConfig || {}) as {
    /** Alert threshold in percentage points. Default: 20 */
    alertThresholdPp?: number;
    /** Minimum sessions to include an agent. Default: 5 */
    minSessions?: number;
  };

  const alertPp = config.alertThresholdPp ?? ALERT_THRESHOLD_PP;
  const minSessions = config.minSessions ?? MIN_SESSIONS;

  return async () => {
    const db = ctx.getDb();
    const now = Date.now();
    const thisWeekStart = now - WEEK_MS;
    const lastWeekStart = thisWeekStart - WEEK_MS;

    // ── Session stats ──────────────────────────────────────────────
    const sessionRows = db.prepare(`
      SELECT agent,
             CASE WHEN startedAt >= ? THEN 'this' ELSE 'last' END as period,
             COUNT(*) as total,
             SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done,
             SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors
      FROM sessions
      WHERE startedAt >= ? AND startedAt < ?
        AND kind != 'chat'
      GROUP BY agent, period
    `).all(thisWeekStart, lastWeekStart, now) as Array<{
      agent: string;
      period: string;
      total: number;
      done: number;
      errors: number;
    }>;

    // ── Evaluation quality scores ──────────────────────────────────
    const evalRows = db.prepare(`
      SELECT agent,
             CASE WHEN createdAt >= ? THEN 'this' ELSE 'last' END as period,
             AVG(quality) as avgQuality
      FROM evaluations
      WHERE createdAt >= ? AND createdAt < ?
        AND quality IS NOT NULL
      GROUP BY agent, period
    `).all(thisWeekStart, lastWeekStart, now) as Array<{
      agent: string;
      period: string;
      avgQuality: number | null;
    }>;

    // ── Convention pass rates ──────────────────────────────────────
    const convRows = db.prepare(`
      SELECT agent,
             CASE WHEN checked_at >= ? THEN 'this' ELSE 'last' END as period,
             COUNT(*) as total,
             SUM(CASE WHEN passed = 1 THEN 1 ELSE 0 END) as passed
      FROM convention_checks
      WHERE checked_at >= ? AND checked_at < ?
      GROUP BY agent, period
    `).all(thisWeekStart, lastWeekStart, now) as Array<{
      agent: string;
      period: string;
      total: number;
      passed: number;
    }>;

    // ── Assemble per-agent health ──────────────────────────────────
    const agents = new Set<string>();
    for (const r of sessionRows) agents.add(r.agent);

    const skipAgents = new Set(["may"]); // Don't alert on may's own sessions

    const healthData: AgentHealth[] = [];
    const alerts: string[] = [];

    for (const agent of agents) {
      if (skipAgents.has(agent)) continue;

      // Session stats
      const thisS = sessionRows.find(r => r.agent === agent && r.period === "this");
      const lastS = sessionRows.find(r => r.agent === agent && r.period === "last");
      if (!thisS || thisS.total < minSessions) continue; // Not enough data this week

      // Quality
      const thisQ = evalRows.find(r => r.agent === agent && r.period === "this");
      const lastQ = evalRows.find(r => r.agent === agent && r.period === "last");

      // Convention pass rate
      const thisC = convRows.find(r => r.agent === agent && r.period === "this");
      const lastC = convRows.find(r => r.agent === agent && r.period === "last");

      const thisWeekStats: PeriodStats = {
        sessions: thisS.total,
        done: thisS.done,
        error: thisS.errors,
        doneRate: thisS.total > 0 ? thisS.done / thisS.total : 0,
        avgQuality: thisQ?.avgQuality ?? 0,
        conventionPassRate: thisC && thisC.total > 0 ? thisC.passed / thisC.total : 0,
      };

      const lastWeekStats: PeriodStats = {
        sessions: lastS?.total ?? 0,
        done: lastS?.done ?? 0,
        error: lastS?.errors ?? 0,
        doneRate: lastS && lastS.total > 0 ? lastS.done / lastS.total : 0,
        avgQuality: lastQ?.avgQuality ?? 0,
        conventionPassRate: lastC && lastC.total > 0 ? lastC.passed / lastC.total : 0,
      };

      const health: AgentHealth = {
        agent,
        thisWeek: thisWeekStats,
        lastWeek: lastWeekStats,
        doneRateDelta: (thisWeekStats.doneRate - lastWeekStats.doneRate) * 100,
        avgQualityDelta: (thisWeekStats.avgQuality - lastWeekStats.avgQuality) * 100,
        conventionPassDelta: (thisWeekStats.conventionPassRate - lastWeekStats.conventionPassRate) * 100,
      };

      healthData.push(health);

      // Check for alerts
      if (lastWeekStats.sessions >= minSessions) {
        const drops: string[] = [];
        if (health.doneRateDelta <= -alertPp) {
          drops.push(`done rate ${(lastWeekStats.doneRate * 100).toFixed(0)}%→${(thisWeekStats.doneRate * 100).toFixed(0)}% (${health.doneRateDelta.toFixed(0)}pp)`);
        }
        if (health.avgQualityDelta <= -alertPp) {
          drops.push(`quality ${(lastWeekStats.avgQuality * 100).toFixed(0)}→${(thisWeekStats.avgQuality * 100).toFixed(0)} (${health.avgQualityDelta.toFixed(0)}pp)`);
        }
        if (health.conventionPassDelta <= -alertPp) {
          drops.push(`convention pass ${(lastWeekStats.conventionPassRate * 100).toFixed(0)}%→${(thisWeekStats.conventionPassRate * 100).toFixed(0)}% (${health.conventionPassDelta.toFixed(0)}pp)`);
        }
        if (drops.length > 0) {
          alerts.push(`⚠️ ${agent}: ${drops.join(", ")}`);
        }
      }
    }

    // ── Format report ──────────────────────────────────────────────
    const reportLines: string[] = [
      `# Weekly Health Trend Report`,
      `Period: ${new Date(thisWeekStart).toISOString().slice(0, 10)} to ${new Date(now).toISOString().slice(0, 10)}`,
      ``,
    ];

    // Sort by done rate delta (worst first)
    healthData.sort((a, b) => a.doneRateDelta - b.doneRateDelta);

    for (const h of healthData) {
      const arrow = (delta: number) => delta >= 5 ? "📈" : delta <= -5 ? "📉" : "➡️";
      reportLines.push(
        `**${h.agent}**: ${h.thisWeek.sessions} sessions, ` +
        `done=${(h.thisWeek.doneRate * 100).toFixed(0)}% ${arrow(h.doneRateDelta)}(${h.doneRateDelta >= 0 ? "+" : ""}${h.doneRateDelta.toFixed(0)}pp), ` +
        `quality=${(h.thisWeek.avgQuality * 100).toFixed(0)} ${arrow(h.avgQualityDelta)}(${h.avgQualityDelta >= 0 ? "+" : ""}${h.avgQualityDelta.toFixed(0)}pp), ` +
        `conventions=${(h.thisWeek.conventionPassRate * 100).toFixed(0)}% ${arrow(h.conventionPassDelta)}(${h.conventionPassDelta >= 0 ? "+" : ""}${h.conventionPassDelta.toFixed(0)}pp)`
      );
    }

    reportLines.push("");

    // ── Send alerts if needed ──────────────────────────────────────
    if (alerts.length > 0) {
      const alertMsg = [
        `[health-trend] ⚠️ Health regression detected:`,
        ...alerts,
        ``,
        `Full report:`,
        ...reportLines.slice(3), // Skip title/date
      ].join("\n");

      // Alert May (self) for investigation
      ctx.emit({
        type: "message_created",
        fromEntity: "may:health-trend",
        toAgent: "may",
        method: "send",
        task: alertMsg,
        source: "cron:health-trend",
        priority: "P1",
      });

      // Also notify human
      ctx.notify(`Health alert: ${alerts.join("; ")}`);
      ctx.log(`[health-trend] ⚠️ ${alerts.length} alert(s) sent`);
    } else {
      ctx.log(`[health-trend] All agents stable. ${healthData.length} agents tracked.`);
    }

    // Always log the full report
    ctx.log(`[health-trend] ${reportLines.join("\n")}`);
  };
};
