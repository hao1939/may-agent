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
import { getDb } from "../../../src/lib/requests.js";
import type { HandlerContext, HandlerModule } from "../../../src/lib/handler-context.js";
import type { CronEntry } from "../../../src/lib/cron-tool.js";

// ── Types ─────────────────────────────────────────────────────────────

export type FailureCategory =
  | "empty-args" | "wrong-tool" | "nonexistent-path" | "edit-match-fail"
  | "schema-violation" | "path-is-directory" | "convention-block" | "other";

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
  const reportPath = join(ctx.agentsRoot, "optimizer", "workspace", "tool-quality-report.md");
  const optimizerTodoPath = join(ctx.agentsRoot, "optimizer", "workspace", "todo.md");

  return async () => {
    const result = scanToolQuality(ctx.persistDir, baselinePath);
    if (result.totalCalls === 0) { ctx.log("[tool-quality-scan] No evaluations in last 24h."); return; }

    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, formatReport(result), "utf-8");
    ctx.log(`[tool-quality-scan] Report: ${result.totalSessionsWithFailures} sessions, ${result.totalWastedCalls} wasted, ${(result.wasteRate * 100).toFixed(1)}% waste.`);

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
      const task = `- [ ] **[tool-quality-regression]** ${result.regressions.length} regressed: ${summary}. See tool-quality-report.md`;
      try {
        let todo = existsSync(optimizerTodoPath) ? readFileSync(optimizerTodoPath, "utf-8") : "";
        if (!todo.includes("[tool-quality-regression]")) {
          writeFileSync(optimizerTodoPath, todo + "\n" + task + "\n", "utf-8");
          ctx.log(`[tool-quality-scan] ⚠️ ${result.regressions.length} regression(s) — injected optimizer task.`);
        }
      } catch { ctx.log("[tool-quality-scan] ⚠️ Failed to inject optimizer task."); }
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
  if (tool === "edit" && (rootCause.includes("Could not find") || rootCause.includes("exact text"))) return "edit-match-fail";
  if (rootCause.includes("P53") || rootCause.includes("convention")) return "convention-block";

  return "other";
}

// ── Scanning ──────────────────────────────────────────────────────────

function scanToolQuality(persistDir: string, baselinePath: string): ScanResult {
  const now = Date.now();
  const cutoff = now - LOOKBACK_MS;
  const db = getDb(persistDir);

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

function formatReport(result: ScanResult): string {
  const ts = new Date(result.timestamp).toISOString().slice(0, 16);
  const lines = [
    "# Tool Quality Report", "",
    `**Generated**: ${ts}  `, `**Window**: ${result.window}  `,
    `**Total calls**: ${result.totalCalls}  `, `**Wasted calls**: ${result.totalWastedCalls}  `,
    `**Waste rate**: ${(result.wasteRate * 100).toFixed(1)}%  `,
    `**Sessions with failures**: ${result.totalSessionsWithFailures}  `, "",
    "## Top Issues (by wasted calls)", "",
  ];

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
