/**
 * metrics-collector.ts — Tracks iteration metrics per project.
 * Records duration, test count, deliverable count per iteration.
 * Supports in-memory storage with flush/load for persistence.
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";

// ── Types ───────────────────────────────────────────────────────────

export interface MetricsEntry {
  projectId: string;
  iterationNumber: number;
  durationMs: number;
  testCount: number;
  deliverableCount: number;
  timestamp: number; // epoch ms
}

export interface MetricsSummary {
  totalIterations: number;
  totalDurationMs: number;
  avgDurationMs: number;
  totalDeliverables: number;
  totalTests: number;
  projects: string[];
}

export interface MetricsStats {
  count: number;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
}

export type TrendableMetric = "durationMs" | "testCount" | "deliverableCount";

export interface TrendPoint {
  iterationNumber: number;
  value: number;
  timestamp: number;
}

// ── Helpers ─────────────────────────────────────────────────────────

export function computeStats(entries: MetricsEntry[]): MetricsStats {
  if (entries.length === 0) {
    return { count: 0, min: 0, max: 0, avg: 0, p50: 0, p95: 0 };
  }
  const values = entries.map((e) => e.durationMs).sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  return {
    count: values.length,
    min: values[0],
    max: values[values.length - 1],
    avg: sum / values.length,
    p50: percentile(values, 50),
    p95: percentile(values, 95),
  };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 1) return sorted[0];
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}

// ── MetricsCollector ────────────────────────────────────────────────

export class MetricsCollector {
  private entries: MetricsEntry[] = [];

  record(entry: MetricsEntry): void {
    this.entries.push({ ...entry });
  }

  getAll(): MetricsEntry[] {
    return [...this.entries];
  }

  getHistory(projectId: string): MetricsEntry[] {
    return this.entries
      .filter((e) => e.projectId === projectId)
      .sort((a, b) => a.iterationNumber - b.iterationNumber);
  }

  getSummary(projectId?: string): MetricsSummary {
    const filtered = projectId
      ? this.entries.filter((e) => e.projectId === projectId)
      : this.entries;
    const projects = [...new Set(filtered.map((e) => e.projectId))];
    const totalDurationMs = filtered.reduce((s, e) => s + e.durationMs, 0);
    return {
      totalIterations: filtered.length,
      totalDurationMs,
      avgDurationMs: filtered.length ? totalDurationMs / filtered.length : 0,
      totalDeliverables: filtered.reduce((s, e) => s + e.deliverableCount, 0),
      totalTests: filtered.reduce((s, e) => s + e.testCount, 0),
      projects,
    };
  }

  getTrend(projectId: string, metric: TrendableMetric): TrendPoint[] {
    return this.getHistory(projectId).map((e) => ({
      iterationNumber: e.iterationNumber,
      value: e[metric],
      timestamp: e.timestamp,
    }));
  }

  flush(path: string): void {
    try {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, JSON.stringify(this.entries, null, 2));
    } catch (err) {
      console.error(`[metrics-collector] Failed to flush metrics to ${path}: ${err}`);
    }
  }

  load(path: string): void {
    let raw: string;
    try {
      raw = readFileSync(path, "utf-8");
    } catch (err) {
      console.error(`[metrics-collector] Failed to load metrics from ${path}: ${err}`);
      return; // Keep existing entries on file read failure
    }
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) throw new Error("Invalid metrics file: expected array");
    this.entries = data;
  }

  clear(): void {
    this.entries = [];
  }

  get size(): number {
    return this.entries.length;
  }
}
