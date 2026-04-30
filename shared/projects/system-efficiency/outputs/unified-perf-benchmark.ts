/**
 * Performance benchmark: master-worker-unified vs base master-worker.
 *
 * Runs each variant 100 times with a mock provider that returns immediately,
 * measures average latency, and prints a comparison table.
 */

import { runMasterWorker, type MasterWorkerConfig } from "/app/agents/shared/workflows/master-worker-unified.ts";

// ── Mock Provider ───────────────────────────────────────────────────────

let callCount = 0;

/** Mock dispatch that returns immediately with a "continue" or "stop" response */
function createMockDispatch(stopAfter: number) {
  return async (_context: string, iteration: number): Promise<string> => {
    callCount++;
    if (iteration >= stopAfter) {
      return "STOP: All tasks complete.";
    }
    return `Iteration ${iteration} complete. Continuing...`;
  };
}

// ── Timing Utility ──────────────────────────────────────────────────────

async function timeExecution(fn: () => Promise<unknown>): Promise<number> {
  const start = performance.now();
  await fn();
  return performance.now() - start;
}

// ── Benchmark Runner ────────────────────────────────────────────────────

interface BenchmarkResult {
  name: string;
  runs: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  p95Ms: number;
  totalMs: number;
}

async function runBenchmark(
  name: string,
  fn: () => Promise<unknown>,
  runs: number = 100
): Promise<BenchmarkResult> {
  const times: number[] = [];

  // Warmup (5 runs)
  for (let i = 0; i < 5; i++) {
    await fn();
  }

  // Actual benchmark
  for (let i = 0; i < runs; i++) {
    const elapsed = await timeExecution(fn);
    times.push(elapsed);
  }

  times.sort((a, b) => a - b);
  const totalMs = times.reduce((a, b) => a + b, 0);
  const avgMs = totalMs / runs;
  const minMs = times[0];
  const maxMs = times[times.length - 1];
  const p95Ms = times[Math.floor(runs * 0.95)];

  return { name, runs, avgMs, minMs, maxMs, p95Ms, totalMs };
}

// ── Main ────────────────────────────────────────────────────────────────

async function main() {
  const RUNS = 100;
  const STOP_AFTER = 3; // Each run does 3 iterations then stops

  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║   Master-Worker Performance Benchmark                    ║");
  console.log("╠══════════════════════════════════════════════════════════╣");
  console.log(`║   Runs per variant: ${RUNS}                                  ║`);
  console.log(`║   Iterations per run: ${STOP_AFTER}                                ║`);
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  // Benchmark 1: Unified (base mode — no cache, no resilience, no health-check)
  const baseResult = await runBenchmark(
    "Unified (base)",
    async () => {
      await runMasterWorker({
        projectDir: "/tmp/bench-test",
        maxIterations: 10,
        dispatch: createMockDispatch(STOP_AFTER),
      });
    },
    RUNS
  );

  // Benchmark 2: Unified with caching enabled
  const cachedResult = await runBenchmark(
    "Unified (cached)",
    async () => {
      await runMasterWorker({
        projectDir: "/tmp/bench-test",
        maxIterations: 10,
        cache: { enabled: true, maxSnapshots: 5 },
        dispatch: createMockDispatch(STOP_AFTER),
      });
    },
    RUNS
  );

  // Benchmark 3: Unified with resilience enabled
  const resilientResult = await runBenchmark(
    "Unified (resilient)",
    async () => {
      await runMasterWorker({
        projectDir: "/tmp/bench-test",
        maxIterations: 10,
        resilience: { maxRetries: 3, backoffMs: 0, circuitBreakerThreshold: 5 },
        dispatch: createMockDispatch(STOP_AFTER),
      });
    },
    RUNS
  );

  // Benchmark 4: Unified with all features enabled
  const fullResult = await runBenchmark(
    "Unified (all features)",
    async () => {
      await runMasterWorker({
        projectDir: "/tmp/bench-test",
        maxIterations: 10,
        cache: { enabled: true, maxSnapshots: 5 },
        resilience: { maxRetries: 3, backoffMs: 0, circuitBreakerThreshold: 5 },
        healthCheck: { enabled: true, intervalIterations: 2 },
        dispatch: createMockDispatch(STOP_AFTER),
      });
    },
    RUNS
  );

  // Print results table
  const results = [baseResult, cachedResult, resilientResult, fullResult];

  console.log("┌────────────────────────┬────────┬─────────┬─────────┬─────────┬─────────┐");
  console.log("│ Variant                │  Runs  │ Avg(ms) │ Min(ms) │ Max(ms) │ P95(ms) │");
  console.log("├────────────────────────┼────────┼─────────┼─────────┼─────────┼─────────┤");

  for (const r of results) {
    const name = r.name.padEnd(22);
    const runs = String(r.runs).padStart(6);
    const avg = r.avgMs.toFixed(2).padStart(7);
    const min = r.minMs.toFixed(2).padStart(7);
    const max = r.maxMs.toFixed(2).padStart(7);
    const p95 = r.p95Ms.toFixed(2).padStart(7);
    console.log(`│ ${name} │ ${runs} │ ${avg} │ ${min} │ ${max} │ ${p95} │`);
  }

  console.log("└────────────────────────┴────────┴─────────┴─────────┴─────────┴─────────┘");

  // Overhead analysis
  const overhead = ((fullResult.avgMs - baseResult.avgMs) / baseResult.avgMs) * 100;
  console.log(`\n📊 Overhead of full-featured vs base: ${overhead.toFixed(1)}%`);

  const absoluteOverheadMs = fullResult.avgMs - baseResult.avgMs;
  if (absoluteOverheadMs < 1.0) {
    console.log(`✅ Absolute overhead is ${absoluteOverheadMs.toFixed(2)}ms — negligible for real workloads.`);
    console.log("   (High % is misleading when base is sub-millisecond. Real dispatches take 1-30s.)");
  } else if (absoluteOverheadMs < 10) {
    console.log(`⚠️  Absolute overhead is ${absoluteOverheadMs.toFixed(2)}ms — moderate but acceptable.`);
  } else {
    console.log(`❌ Absolute overhead is ${absoluteOverheadMs.toFixed(2)}ms — investigate.`);
  }

  console.log(`\n📈 Total mock dispatch calls during benchmark: ${callCount}`);
}

main().catch(console.error);
