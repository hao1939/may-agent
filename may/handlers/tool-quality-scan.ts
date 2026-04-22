/**
 * tool-quality-scan — JS cron handler for tool failure feedback loop.
 *
 * Scans evaluations DB for failure chains from the last 24h, classifies
 * each failure into categories (empty-args, wrong-tool, nonexistent-path,
 * edit-match-fail, schema-violation, path-is-directory), aggregates by
 * tool × issue × agent, compares against baseline, and writes a report.
 *
 * If any category regresses >20% vs baseline, injects a focused task
 * into optimizer's todo.
 *
 * Pure JS — no LLM cost. Runs every 4h via cron.
 *
 * Exports create() conforming to HandlerModule.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import type { HandlerContext, HandlerModule } from "../../shared/agent-sdk.js";
import type { CronEntry } from "../../shared/agent-sdk.js";

// ── Types ─────────────────────────────────────────────────────────────

export type FailureCategory =
  | "empty-args" | "wrong-tool" | "nonexistent-path" | "edit-match-fail"
  | "schema-violation" | "path-is-directory" | "convention-block"
  | "cmd-not-found" | "cd-bad-path" | "file-not-found-bash"
  | "permission-denied" | "timeout-killed" | "python-error"
  | "module-not-found" | "syntax-error"
  | "cmd-aborted" | "test-failure" | "git-error" | "env-mismatch" | "exit-code-nonzero"
  | "other";

interface FailureChain {
  trigger: { tool: string; args: string; result: string; isError?: boolean };
  recovery: unknown[];
  resolution: unknown;
  wastedCalls: number;
  rootCause: string;
}

interface CategoryMetric {
  count: number; wastedCalls: number;
  agents: Record<string, number>; examples: string[];
}

interface ToolQualityBaseline {
  timestamp: number; window: string;
  metrics: Record<string, { count: number; agents: string[] }>;
  totalWastedCalls: number; totalCalls: number; wasteRate: number;
}

interface TrendEntry {
  timestamp: number;
  wasteRate: number;
  totalCalls: number;
  totalWastedCalls: number;
  topCategories: Array<{ key: string; count: number }>;
}

const MAX_HISTORY_ENTRIES = 5;

interface ScanResult {
  timestamp: number; window: string;
  categories: Record<string, CategoryMetric>;
  totalWastedCalls: number; totalCalls: number;
  totalSessionsWithFailures: number; wasteRate: number;
  regressions: Array<{ category: string; current: number; baseline: number; deltaPercent: number }>;
}

const LOOKBACK_MS = 24 * 60 * 60 * 1000;
const REGRESSION_THRESHOLD = 0.20;
const MAX_EXAMPLES = 3;

// ── Factory ───────────────────────────────────────────────────────────

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  const baselinePath = join(ctx.persistDir, "tool-quality-baseline.json");
  const historyPath = join(ctx.persistDir, "tool-quality-history.json");
  const reportPath = join(ctx.agentsRoot, "optimizer", "workspace", "tool-quality-report.md");
  const trendPath = join(ctx.agentsRoot, "optimizer", "workspace", "tool-quality-trend.md");
  const optimizerTodoPath = join(ctx.agentsRoot, "optimizer", "workspace", "todo.md");

  return async () => {
    const result = scanToolQuality(ctx.persistDir, baselinePath, ctx.getDb);
    if (result.totalCalls === 0) { ctx.log("[tool-quality-scan] No evaluations in last 24h."); return; }

    // Load trend history
    let history: TrendEntry[] = [];
    try { if (existsSync(historyPath)) history = JSON.parse(readFileSync(historyPath, "utf-8")); } catch {}

    // Save current baseline to history before overwriting
    try {
      if (existsSync(baselinePath)) {
        const oldBaseline: ToolQualityBaseline = JSON.parse(readFileSync(baselinePath, "utf-8"));
        const topCats = Object.entries(oldBaseline.metrics)
          .sort(([, a], [, b]) => b.count - a.count)
          .slice(0, 5)
          .map(([key, m]) => ({ key, count: m.count }));
        history.push({
          timestamp: oldBaseline.timestamp,
          wasteRate: oldBaseline.wasteRate,
          totalCalls: oldBaseline.totalCalls,
          totalWastedCalls: oldBaseline.totalWastedCalls,
          topCategories: topCats,
        });
        // Keep only last N entries
        if (history.length > MAX_HISTORY_ENTRIES) history = history.slice(-MAX_HISTORY_ENTRIES);
        writeFileSync(historyPath, JSON.stringify(history, null, 2), "utf-8");
      }
    } catch { /* history update is best-effort */ }

    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, formatReport(result, history), "utf-8");
    ctx.log(`[tool-quality-scan] Report: ${result.totalSessionsWithFailures} sessions, ${result.totalWastedCalls} wasted, ${(result.wasteRate * 100).toFixed(1)}% waste.`);

    // Write trend summary for LLM consumption (reduces 5-10 ops to 1-2)
    mkdirSync(dirname(trendPath), { recursive: true });
    writeFileSync(trendPath, formatTrendSummary(result, history), "utf-8");
    ctx.log(`[tool-quality-scan] Trend summary written (${history.length} historical entries).`);

    // Update baseline
    const newBaseline: ToolQualityBaseline = {
      timestamp: result.timestamp, window: result.window, metrics: {},
      totalWastedCalls: result.totalWastedCalls, totalCalls: result.totalCalls, wasteRate: result.wasteRate,
    };
    for (const [cat, m] of Object.entries(result.categories)) {
      newBaseline.metrics[cat] = { count: m.count, agents: Object.keys(m.agents) };
    }
    writeFileSync(baselinePath, JSON.stringify(newBaseline, null, 2), "utf-8");

    if (result.regressions.length > 0) {
      const summary = result.regressions.map(r =>
        `${r.category}: ${r.current} (was ${r.baseline}, +${r.deltaPercent.toFixed(0)}%)`
      ).join(", ");
      ctx.emit({
        type: "message_created",
        from: "tool-quality-scan",
        to: "optimizer",
        task: `Tool quality regression: ${result.regressions.length} regressed — ${summary}. Investigate and propose a fix.`,
        requestId: `tqs-${Date.now()}`,
      });
      ctx.log(`[tool-quality-scan] ⚠️ ${result.regressions.length} regression(s) — sent to optimizer.`);
    }
  };
};

// ── Classification ────────────────────────────────────────────────────

export function classifyFailure(chain: FailureChain): FailureCategory {
  const tool = chain.trigger?.tool || "";
  const args = chain.trigger?.args || "";
  const rootCause = chain.rootCause || "";
  const result = chain.trigger?.result || "";

  if (args === "{}" || args === "" || args === "null") return "empty-args";

  try {
    const p = JSON.parse(args);
    if (tool === "bash" && p.path && !p.command) return "wrong-tool";
    if (tool === "read" && p.command && !p.path) return "wrong-tool";
    if (tool === "edit" && p.command) return "wrong-tool";
  } catch { /* not JSON */ }

  if (rootCause.includes("Validation failed")) return "schema-violation";
  if (rootCause.includes("ENOENT") || result.includes("No such file")) return "nonexistent-path";
  if (rootCause.includes("EISDIR") || result.includes("Is a directory")) return "path-is-directory";
  if (tool === "edit" && (rootCause.includes("Could not find") || rootCause.includes("exact text") ||
      /Found \d+ occurrences/.test(rootCause) || /Found \d+ occurrences/.test(result))) return "edit-match-fail";
  if (rootCause.includes("P53") || rootCause.includes("convention")) return "convention-block";

  if (rootCause.includes("command not found") || result.includes("command not found")) return "cmd-not-found";
  if (rootCause.includes("cd:") && rootCause.includes("No such")) return "cd-bad-path";
  if (/cannot (stat|access|open)/.test(rootCause) || /cannot (stat|access|open)/.test(result)) return "file-not-found-bash";

  // Permission denied errors
  if (/permission denied/i.test(rootCause) || /permission denied/i.test(result) ||
      /EACCES/.test(rootCause) || /EACCES/.test(result)) return "permission-denied";

  // Command/process killed or timed out
  if (/timed?\s*out|killed|signal\s+(SIGKILL|SIGTERM|SIGINT)/i.test(rootCause) ||
      /timed?\s*out|killed|signal\s+(SIGKILL|SIGTERM|SIGINT)/i.test(result)) return "timeout-killed";

  // Python errors (optimizer frequently runs python for analysis)
  if (/Traceback \(most recent call last\)|ModuleNotFoundError|ImportError/.test(rootCause) ||
      /Traceback \(most recent call last\)|ModuleNotFoundError|ImportError/.test(result)) return "python-error";

  // Node/bun module resolution failures
  if (/Cannot find module|MODULE_NOT_FOUND|Could not resolve/.test(rootCause) ||
      /Cannot find module|MODULE_NOT_FOUND|Could not resolve/.test(result)) return "module-not-found";

  // Bash syntax errors
  if (/syntax error|unexpected (token|EOF|end)/i.test(rootCause) ||
      /syntax error|unexpected (token|EOF|end)/i.test(result)) return "syntax-error";

  // Command aborted (session interrupted mid-execution)
  if (/Command aborted/i.test(rootCause) || /Command aborted/i.test(result) ||
      /Request was aborted/i.test(rootCause) || /Request was aborted/i.test(result)) return "cmd-aborted";

  // Test runner failures (vitest/gym-run — command ran fine, test just failed)
  if (/\d+ tests? \| \d+ failed/i.test(rootCause) || /\d+ tests? \| \d+ failed/i.test(result) ||
      /"passed":\s*false/.test(rootCause) || /"passed":\s*false/.test(result) ||
      /RESULT: FAIL/i.test(rootCause) || /RESULT: FAIL/i.test(result)) return "test-failure";

  // Gym scenario test failures (custom assert format: ✗ name: expected X, got Y)
  if (/✗/.test(result) || /✗/.test(rootCause)) return "test-failure";

  // Gym test summary format: "N passed, N failed out of N tests" / "TESTS FAILED"
  if (/\d+ failed out of \d+ tests/i.test(result) || /\d+ failed out of \d+ tests/i.test(rootCause) ||
      /TESTS FAILED/i.test(result) || /TESTS FAILED/i.test(rootCause)) return "test-failure";

  // Test runner output with passing tests but non-zero exit (truncated output hides failures)
  if (tool === "bash" && (/✓.*tests?\)/.test(result) || /✓.*tests?\)/.test(rootCause) ||
      /RUN\s+v\d/.test(result) || /RUN\s+v\d/.test(rootCause))) return "test-failure";

  // Git CLI errors (argument conflicts, bad refs, gitignore blocks, review gate, push rejections)
  if (/^fatal:/.test(result.trim()) || /^fatal:/.test(rootCause.trim()) ||
      /fatal:.*cannot be used together/.test(rootCause) || /fatal:.*cannot be used together/.test(result) ||
      /ignored by one of your \.gitignore/i.test(rootCause) || /ignored by one of your \.gitignore/i.test(result) ||
      /Direct commits to main are blocked/i.test(rootCause) || /Direct commits to main are blocked/i.test(result) ||
      /failed to push some refs/i.test(rootCause) || /failed to push some refs/i.test(result) ||
      /\[rejected\].*fetch first/i.test(rootCause) || /\[rejected\].*fetch first/i.test(result) ||
      /nothing to commit/i.test(rootCause) || /nothing to commit/i.test(result) ||
      /Changes not staged for commit/i.test(rootCause) || /Changes not staged for commit/i.test(result)) return "git-error";

  // Environment mismatch (wrong Node version, missing built-in, etc.)
  if (/ERR_UNKNOWN_BUILTIN_MODULE|no such built-in module/i.test(rootCause) ||
      /ERR_UNKNOWN_BUILTIN_MODULE|no such built-in module/i.test(result)) return "env-mismatch";

  // Non-zero exit code (grep found nothing, ls partial fail, command not found [127], git errors [128])
  if (/Command exited with code [1-9]\d*\b/.test(rootCause) || /Command exited with code [1-9]\d*\b/.test(result)) return "exit-code-nonzero";

  // Truncated output where exit code was cut off — rootCause says "exec failed" but
  // output was truncated before the "Command exited with code N" line appeared.
  // The chain detector marks these isError:true, so they are genuine non-zero exits.
  if (tool === "bash" && chain.trigger?.isError && /^exec failed:/.test(rootCause)) return "exit-code-nonzero";

  return "other";
}

// ── Scanning ──────────────────────────────────────────────────────────

function scanToolQuality(persistDir: string, baselinePath: string, getDb: () => { exec: (sql: string) => void; prepare: (sql: string) => any; run: (sql: string, params?: unknown[]) => any; close: () => void }): ScanResult {
  const now = Date.now();
  const cutoff = now - LOOKBACK_MS;
  const db = getDb();

  const totalRow = db.prepare(
    `SELECT COALESCE(SUM(productiveCalls + wastedCalls), 0) as totalCalls FROM evaluations WHERE createdAt > ? AND verdict != 'skipped'`
  ).get(cutoff) as { totalCalls: number } | null;
  const totalCalls = Number(totalRow?.totalCalls || 0);

  const rows = db.prepare(
    `SELECT sessionId, agent, wastedCalls, failureChains FROM evaluations WHERE failureChains IS NOT NULL AND failureChains != '[]' AND verdict != 'skipped' AND createdAt > ? ORDER BY wastedCalls DESC`
  ).all(cutoff) as Array<{ sessionId: string; agent: string; wastedCalls: number; failureChains: string }>;

  const categories: Record<string, CategoryMetric> = {};
  let totalWastedCalls = 0;

  for (const row of rows) {
    let chains: FailureChain[];
    try { chains = JSON.parse(row.failureChains); } catch { continue; }
    for (const chain of chains) {
      const key = `${chain.trigger?.tool || "unknown"}:${classifyFailure(chain)}`;
      if (!categories[key]) categories[key] = { count: 0, wastedCalls: 0, agents: {}, examples: [] };
      const cat = categories[key];
      cat.count++;
      cat.wastedCalls += chain.wastedCalls || 0;
      totalWastedCalls += chain.wastedCalls || 0;
      cat.agents[row.agent] = (cat.agents[row.agent] || 0) + 1;
      if (cat.examples.length < MAX_EXAMPLES) {
        cat.examples.push(`[${row.agent}] ${(chain.rootCause || "").slice(0, 120)}`);
      }
    }
  }

  let baseline: ToolQualityBaseline | null = null;
  try { if (existsSync(baselinePath)) baseline = JSON.parse(readFileSync(baselinePath, "utf-8")); } catch {}

  const regressions: ScanResult["regressions"] = [];
  if (baseline) {
    for (const [key, metric] of Object.entries(categories)) {
      const bc = baseline.metrics[key]?.count || 0;
      if (bc > 0) {
        const d = (metric.count - bc) / bc;
        if (d > REGRESSION_THRESHOLD) regressions.push({ category: key, current: metric.count, baseline: bc, deltaPercent: d * 100 });
      } else if (metric.count >= 3) {
        regressions.push({ category: key, current: metric.count, baseline: 0, deltaPercent: 100 });
      }
    }
  }

  return {
    timestamp: now, window: "24h", categories, totalWastedCalls, totalCalls,
    totalSessionsWithFailures: rows.length,
    wasteRate: totalCalls > 0 ? totalWastedCalls / totalCalls : 0,
    regressions,
  };
}

// ── Report ────────────────────────────────────────────────────────────

function formatReport(result: ScanResult, history: TrendEntry[]): string {
  const ts = new Date(result.timestamp).toISOString().slice(0, 16);
  const trendArrow = getTrendArrow(result.wasteRate, history);
  const lines = [
    "# Tool Quality Report", "",
    `**Generated**: ${ts}  `, `**Window**: ${result.window}  `,
    `**Total calls**: ${result.totalCalls}  `, `**Wasted calls**: ${result.totalWastedCalls}  `,
    `**Waste rate**: ${(result.wasteRate * 100).toFixed(1)}% ${trendArrow}  `,
    `**Sessions with failures**: ${result.totalSessionsWithFailures}  `, "",
  ];

  // Add trend history section if we have data
  if (history.length > 0) {
    lines.push("## Waste Rate Trend", "");
    const ratePoints = history.map(h => `${(h.wasteRate * 100).toFixed(1)}%`);
    ratePoints.push(`**${(result.wasteRate * 100).toFixed(1)}%**`);
    lines.push(`${ratePoints.join(" → ")}`, "");
  }

  lines.push("## Top Issues (by wasted calls)", "");

  const sorted = Object.entries(result.categories).sort(([, a], [, b]) => b.wastedCalls - a.wastedCalls);

  for (const [key, metric] of sorted.slice(0, 5)) {
    const agents = Object.entries(metric.agents).sort(([, a], [, b]) => b - a).map(([n, c]) => `${n}(${c})`).join(", ");
    lines.push(`### ${key}`, `- **Count**: ${metric.count}`, `- **Wasted**: ${metric.wastedCalls}`, `- **Agents**: ${agents}`);
    if (metric.examples.length) {
      lines.push(`- **Examples**:`);
      for (const ex of metric.examples) lines.push(`  - \`${ex}\``);
    }
    lines.push("");
  }

  if (result.regressions.length > 0) {
    lines.push("## ⚠️ Regressions", "");
    for (const r of result.regressions) {
      lines.push(`- **${r.category}**: ${r.current} (was ${r.baseline}, +${r.deltaPercent.toFixed(0)}%)`);
    }
    lines.push("");
  }

  lines.push("## All Categories", "", "| Category | Count | Wasted | Top Agent |",
    "|----------|------:|-------:|-----------|");
  for (const [key, m] of sorted) {
    const top = Object.entries(m.agents).sort(([, a], [, b]) => b - a)[0];
    lines.push(`| ${key} | ${m.count} | ${m.wastedCalls} | ${top ? `${top[0]}(${top[1]})` : "-"} |`);
  }

  return lines.join("\n");
}

// ── Trend Analysis ────────────────────────────────────────────────────

function getTrendArrow(currentRate: number, history: TrendEntry[]): string {
  if (history.length === 0) return "";
  const lastRate = history[history.length - 1].wasteRate;
  const delta = currentRate - lastRate;
  if (Math.abs(delta) < 0.002) return "→";  // <0.2% change = stable
  return delta > 0 ? "↑" : "↓";
}

function formatTrendSummary(result: ScanResult, history: TrendEntry[]): string {
  const ts = new Date(result.timestamp).toISOString().slice(0, 16);
  const arrow = getTrendArrow(result.wasteRate, history);
  const lines = [
    "# Tool Quality Trend Summary", "",
    `**Generated**: ${ts} (auto-generated by tool-quality-scan.ts)  `,
    `**Purpose**: Pre-analyzed trend data — read this instead of full report to save ops.`, "",
    "## Current Snapshot",
    `- Waste rate: **${(result.wasteRate * 100).toFixed(1)}%** ${arrow}`,
    `- Total calls: ${result.totalCalls}`,
    `- Wasted calls: ${result.totalWastedCalls}`,
    `- Sessions with failures: ${result.totalSessionsWithFailures}`, "",
  ];

  // Waste rate trend
  if (history.length > 0) {
    lines.push("## Waste Rate History");
    const ratePoints = history.map(h => {
      const t = new Date(h.timestamp).toISOString().slice(5, 16);
      return `${t}: ${(h.wasteRate * 100).toFixed(1)}%`;
    });
    ratePoints.push(`**NOW**: ${(result.wasteRate * 100).toFixed(1)}%`);
    for (const p of ratePoints) lines.push(`- ${p}`);

    // Trend direction
    const rates = history.map(h => h.wasteRate).concat(result.wasteRate);
    const rising = rates.length >= 3 && rates.slice(-3).every((r, i, a) => i === 0 || r >= a[i - 1]);
    const falling = rates.length >= 3 && rates.slice(-3).every((r, i, a) => i === 0 || r <= a[i - 1]);
    if (rising) lines.push("", "⚠️ **Trend: RISING** — waste rate increasing for 3+ consecutive scans.");
    else if (falling) lines.push("", "✅ **Trend: FALLING** — waste rate decreasing for 3+ consecutive scans.");
    else lines.push("", "→ **Trend: MIXED** — no consistent direction.");
    lines.push("");
  }

  // Top issues summary
  const sorted = Object.entries(result.categories).sort(([, a], [, b]) => b.wastedCalls - a.wastedCalls);
  lines.push("## Top 3 Issues");
  for (const [key, metric] of sorted.slice(0, 3)) {
    const topAgent = Object.entries(metric.agents).sort(([, a], [, b]) => b - a)[0];
    lines.push(`- **${key}**: ${metric.count} occurrences, ${metric.wastedCalls} wasted (top: ${topAgent ? topAgent[0] : "-"})`);
  }
  lines.push("");

  // Regressions
  if (result.regressions.length > 0) {
    lines.push("## ⚠️ Regressions (need attention)");
    for (const r of result.regressions) {
      lines.push(`- **${r.category}**: ${r.current} (was ${r.baseline}, +${r.deltaPercent.toFixed(0)}%)`);
    }
    lines.push("");
  }

  // Action recommendation
  lines.push("## Recommended Action");
  if (result.regressions.length > 0) {
    lines.push("**ACTION NEEDED**: Review regressions above. Check full report for examples.");
  } else if (result.wasteRate > 0.05) {
    lines.push("**MONITOR**: Waste rate above 5% threshold. Review top issues for intervention opportunities.");
  } else {
    lines.push("**NO ACTION NEEDED**: Waste rate within acceptable range, no regressions.");
  }

  return lines.join("\n");
}
