# Workflow Modules Cookbook

## Introduction

The workflow toolkit provides 12 composable modules for building resilient, observable agent workflows. All modules are importable from a single barrel export:

```typescript
import { validateTask, estimateComplexity, createBudget, ... } from '../workflows/index';
```

---

## Resilience Modules (Phase 2)

### 1. incremental-checkpoint.ts
**Purpose:** Save and restore iteration state to survive crashes.

```typescript
import { saveIncrementalCheckpoint, detectIncompleteCheckpoint, markCheckpointComplete } from '../workflows/incremental-checkpoint';

const incomplete = await detectIncompleteCheckpoint(sessionId);
if (incomplete) { /* resume from incomplete.step */ }

saveIncrementalCheckpoint({ sessionId, step: 3, partialResults: data, timestamp: Date.now() });
markCheckpointComplete(sessionId);
```
**When to use:** Any multi-step iteration where losing progress is costly.

---

### 2. provider-retry.ts
**Purpose:** Retry provider/LLM calls with exponential backoff on transient errors.

```typescript
import { withRetry } from '../workflows/provider-retry';

const result = await withRetry(() => callProvider(prompt), {
  maxRetries: 3,
  baseDelayMs: 1000,
  retryableErrors: ['RATE_LIMIT', 'TIMEOUT', '5XX']
});
```
**When to use:** Every external provider call (LLM, API, network).

---

### 3. output-validator.ts
**Purpose:** Validate file content before writing to disk.

```typescript
import { validateOutput } from '../workflows/output-validator';

const result = validateOutput(content, filepath, { checkEmpty: true, checkDuplicate: true, checkType: true });
if (!result.valid) { console.warn(`Rejected: ${result.reason}`); }
```
**When to use:** Before any file write to prevent empty/duplicate/malformed outputs.

---

## Speed Modules (Phase 3)

### 4. task-validator.ts
**Purpose:** Fast-fail tasks that are doomed to fail before wasting time.

```typescript
import { validateTask } from '../workflows/task-validator';

const { valid, reason } = await validateTask(taskDescription, { checkFiles: true, checkDuplicates: true });
if (!valid) { return { skipped: true, reason }; }
```
**When to use:** At iteration start, before any real work begins.

---

### 5. complexity-estimator.ts
**Purpose:** Estimate task complexity and set appropriate timeouts.

```typescript
import { estimateComplexity } from '../workflows/complexity-estimator';

const { score, timeoutMs, description } = estimateComplexity(taskDescription);
// score: 1-5, timeoutMs: 60000-300000
```
**When to use:** After task validation passes, to configure iteration limits.

---

## Observability Modules (Phase 4)

### 6. iteration-timer.ts
**Purpose:** Track iteration durations and compute stats.

```typescript
import { startIteration, endIteration, getStats } from '../workflows/iteration-timer';

startIteration('iter-42');
// ... do work ...
const { durationMs, durationFormatted } = endIteration('iter-42');
const { avg, median, p95, count } = getStats();
```
**When to use:** Wrap every iteration to build latency data.

---

### 7. metrics-dashboard.ts
**Purpose:** Programmatic access to project health metrics.

```typescript
import { collectMetrics } from '../workflows/metrics-dashboard';

const metrics = await collectMetrics();
// { testCount, testFileCount, outputCount, workflowModuleCount, integrationTestCount }
```
**When to use:** Health checks, reports, dashboards.

---

### 8. fast-path.ts
**Purpose:** Skip expensive validation for simple writes.

```typescript
import { fastWrite } from '../workflows/fast-path';

const result = await fastWrite(content, filepath, complexityScore);
// score 1-2: empty check only. score 3+: full validation.
```
**When to use:** When you know the complexity score and want adaptive validation.

---

## Cross-Project Modules (Phase 5)

### 9. metrics-aggregator.ts
**Purpose:** Scan all satellite projects and return unified health data.

```typescript
import { aggregateMetrics } from '../workflows/metrics-aggregator';

const { projects } = await aggregateMetrics();
// projects: [{name, status, metrics, lastUpdated}, ...]
```
**When to use:** Orchestrator decision points needing cross-project awareness.

---

### 10. iteration-budget.ts
**Purpose:** Enforce per-iteration resource limits based on complexity.

```typescript
import { createBudget } from '../workflows/iteration-budget';

const budget = createBudget(complexityScore); // score 1→60s, score 5→300s
budget.consume(elapsedMs);
if (budget.isExceeded()) { /* early exit */ }
```
**When to use:** After complexity estimation, to prevent stuck iterations.

---

### 11. health-check.ts
**Purpose:** Run all system health checks in one call.

```typescript
import { runHealthCheck } from '../workflows/health-check';

const { passed, checks } = await runHealthCheck();
checks.forEach(c => console.log(`${c.name}: ${c.passed ? '✅' : '❌'} ${c.details}`));
```
**When to use:** Pre-flight checks, monitoring, CI gates.

---

### 12. error-boundary.ts
**Purpose:** Wrap any function in structured error handling.

```typescript
import { withErrorBoundary } from '../workflows/error-boundary';

const result = withErrorBoundary(() => riskyOperation(), {
  fallback: defaultValue,
  onError: (e) => logger.warn(e.message)
});
// { success: boolean, result?: T, error?: {message, stack, timestamp} }
```
**When to use:** Around any operation that might throw and shouldn't crash the pipeline.

---

## Common Recipes (Presets)

### Write and Test
```typescript
import { presets } from '../workflows/workflow-preset';
await presets.writeAndTest({ filepath: 'output.md', content, testCommand: 'vitest run' });
```

### Audit and Report
```typescript
await presets.auditAndReport({ sourceFiles: ['src/*.ts'], outputPath: 'outputs/audit.md' });
```

### Implement and Integrate
```typescript
await presets.implementAndIntegrate({ module: 'new-feature.ts', testFile: 'new-feature.test.ts' });
```

---

## Full Pipeline (all modules in sequence)

```typescript
// 1. Validate task
const { valid } = await validateTask(task);
if (!valid) return;

// 2. Estimate complexity & create budget
const { score, timeoutMs } = estimateComplexity(task);
const budget = createBudget(score);

// 3. Start timer
startIteration(iterationId);

// 4. Save checkpoint before work
saveIncrementalCheckpoint({ sessionId, step: 0, partialResults: null, timestamp: Date.now() });

// 5. Do work with retry and error boundary
const result = await withErrorBoundary(async () => {
  return await withRetry(() => providerCall(task));
});

// 6. Validate output before writing
if (result.success) {
  await fastWrite(result.result, outputPath, score);
}

// 7. End timer & mark complete
const timing = endIteration(iterationId);
markCheckpointComplete(sessionId);
```
