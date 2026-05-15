#!/usr/bin/env bun
/**
 * Top 5 at-a-glance metrics for the Telegram proof-of-life digest.
 * Run: bun agents/may/workspace/tools/top5-metrics.ts
 */
import { Database } from "bun:sqlite";

const db = new Database(".state/may.db", { readonly: true });
const now = Date.now();
const h6 = 6 * 3600_000;
const h24 = 24 * 3600_000;
const isDigestMode = process.argv.includes("--digest");
const window = isDigestMode ? h24 : h6;
const windowLabel = isDigestMode ? "24h" : "6h";
const recent = now - window;
const prior = now - 2 * window;

// 1. Session success rate (last 6h vs prior 6h)
function successRate(since: number, until: number) {
  const rows = db.query(
    `SELECT status FROM sessions WHERE startedAt >= ? AND startedAt < ? AND status IN ('done','success','failure','error')`
  ).all(since, until) as { status: string }[];
  if (rows.length === 0) return null;
  return rows.filter(r => r.status === "done" || r.status === "success").length / rows.length;
}

// 2. Avg eval quality
function avgQuality(since: number, until: number) {
  const row = db.query(
    `SELECT AVG(quality) as avg, COUNT(*) as n FROM evaluations WHERE createdAt >= ? AND createdAt < ?`
  ).get(since, until) as { avg: number | null; n: number };
  return row.n > 0 ? row.avg : null;
}

// 3. Handler success rate (from metric_snapshots)
function handlerSuccessRate() {
  const row = db.query(
    `SELECT value FROM metric_snapshots WHERE metric_id = 'handler.success-rate' ORDER BY measured_at DESC LIMIT 1`
  ).get() as { value: number } | null;
  return row?.value ?? null;
}

// 4. Error rate from sessions
function errorRate(since: number, until: number) {
  const rows = db.query(
    `SELECT status FROM sessions WHERE startedAt >= ? AND startedAt < ?`
  ).all(since, until) as { status: string }[];
  if (rows.length === 0) return null;
  return rows.filter(r => r.status === "error" || r.status === "failure").length / rows.length;
}

// 5. Session count (throughput)
function sessionCount(since: number, until: number) {
  const row = db.query(
    `SELECT COUNT(*) as n FROM sessions WHERE startedAt >= ? AND startedAt < ?`
  ).get(since, until) as { n: number };
  return row.n;
}

function trend(current: number | null, previous: number | null): string {
  if (current === null || previous === null) return "→";
  const diff = current - previous;
  const threshold = Math.max(Math.abs(previous) * 0.05, 0.01);
  if (diff > threshold) return "↑";
  if (diff < -threshold) return "↓";
  return "→";
}

function indicator(value: number | null, greenMin: number, yellowMin: number, higherIsBetter = true): string {
  if (value === null) return "⚪";
  if (higherIsBetter) {
    if (value >= greenMin) return "🟢";
    if (value >= yellowMin) return "🟡";
    return "🔴";
  } else {
    // lower is better (e.g. error rate)
    if (value <= greenMin) return "🟢";
    if (value <= yellowMin) return "🟡";
    return "🔴";
  }
}

const priorEnd = recent;
const priorStart = prior;
const recentStart = recent;
const recentEnd = now;

const sr = successRate(recentStart, recentEnd);
const srPrev = successRate(priorStart, priorEnd);

const eq = avgQuality(recentStart, recentEnd);
const eqPrev = avgQuality(priorStart, priorEnd);

const er = errorRate(recentStart, recentEnd);
const erPrev = errorRate(priorStart, priorEnd);

const sc = sessionCount(recentStart, recentEnd);
const scPrev = sessionCount(priorStart, priorEnd);

const hsr = handlerSuccessRate();

// 7-day history helpers
function dailySuccessRates(): string {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = now - (i + 1) * h24;
    const dayEnd = now - i * h24;
    const v = successRate(dayStart, dayEnd);
    days.push(v !== null ? (v * 100).toFixed(0) : "-");
  }
  return days.join(" ");
}

function dailyQuality(): string {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = now - (i + 1) * h24;
    const dayEnd = now - i * h24;
    const v = avgQuality(dayStart, dayEnd);
    days.push(v !== null ? v.toFixed(2) : "-");
  }
  return days.join(" ");
}

function dailyErrors(): string {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = now - (i + 1) * h24;
    const dayEnd = now - i * h24;
    const v = errorRate(dayStart, dayEnd);
    days.push(v !== null ? (v * 100).toFixed(0) : "-");
  }
  return days.join(" ");
}

function dailySessions(): string {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = now - (i + 1) * h24;
    const dayEnd = now - i * h24;
    days.push(String(sessionCount(dayStart, dayEnd)));
  }
  return days.join(" ");
}

const lines = [
  "📊 Top 5 Metrics",
  `${indicator(sr, 0.85, 0.70)} Success Rate: ${sr !== null ? (sr * 100).toFixed(0) + "%" : "n/a"} ${trend(sr, srPrev)}`,
  `   7d: ${dailySuccessRates()}`,
  `${indicator(eq, 0.70, 0.50)} Eval Quality: ${eq !== null ? eq.toFixed(2) : "n/a"} ${trend(eq, eqPrev)}`,
  `   7d: ${dailyQuality()}`,
  `${indicator(hsr, 0.85, 0.70)} Handler Health: ${hsr !== null ? (hsr * 100).toFixed(0) + "%" : "n/a"} →`,
  `${indicator(er, 0.10, 0.25, false)} Error Rate: ${er !== null ? (er * 100).toFixed(1) + "%" : "n/a"} ${trend(er, erPrev)}`,
  `   7d: ${dailyErrors()}`,
  `${indicator(sc, 15, 8)} Sessions (${windowLabel}): ${sc} ${trend(sc, scPrev)}`,
  `   7d: ${dailySessions()}`,
];

console.log(lines.join("\n"));
