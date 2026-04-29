/**
 * Iteration Timer — tracks iteration durations and computes statistics.
 * Phase 4 observability module for measuring actual iteration performance.
 */

interface TimingRecord {
  id: string;
  startMs: number;
  endMs?: number;
  durationMs?: number;
}

interface TimerStats {
  avg: number;
  median: number;
  p95: number;
  count: number;
  min: number;
  max: number;
}

class IterationTimer {
  private timings: Map<string, TimingRecord> = new Map();
  private completed: TimingRecord[] = [];

  startIteration(id: string): void {
    if (this.timings.has(id)) {
      throw new Error(`Iteration "${id}" already started`);
    }
    this.timings.set(id, { id, startMs: Date.now() });
  }

  endIteration(id: string): { durationMs: number; durationFormatted: string } {
    const record = this.timings.get(id);
    if (!record) {
      throw new Error(`Iteration "${id}" was never started`);
    }
    if (record.endMs !== undefined) {
      throw new Error(`Iteration "${id}" already ended`);
    }
    record.endMs = Date.now();
    record.durationMs = record.endMs - record.startMs;
    this.completed.push(record);
    this.timings.delete(id);
    return {
      durationMs: record.durationMs,
      durationFormatted: formatDuration(record.durationMs),
    };
  }

  getStats(): TimerStats {
    if (this.completed.length === 0) {
      return { avg: 0, median: 0, p95: 0, count: 0, min: 0, max: 0 };
    }
    const durations = this.completed.map((r) => r.durationMs!).sort((a, b) => a - b);
    const count = durations.length;
    const avg = Math.round(durations.reduce((s, d) => s + d, 0) / count);
    const median = durations[Math.floor(count / 2)];
    const p95Index = Math.min(Math.ceil(count * 0.95) - 1, count - 1);
    const p95 = durations[p95Index];
    const min = durations[0];
    const max = durations[count - 1];
    return { avg, median, p95, count, min, max };
  }

  getActiveIterations(): string[] {
    return Array.from(this.timings.keys());
  }

  getCompletedCount(): number {
    return this.completed.length;
  }

  reset(): void {
    this.timings.clear();
    this.completed = [];
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const min = Math.floor(ms / 60000);
  const sec = Math.round((ms % 60000) / 1000);
  return `${min}m ${sec}s`;
}

export { IterationTimer, TimerStats, formatDuration };
