/**
 * Workflow Toolkit — Barrel Export
 * 
 * Import all workflow modules from one place:
 * ```ts
 * import { validateTask, estimateComplexity, createBudget, ... } from './workflows/index';
 * ```
 */

/** Mid-iteration crash recovery via incremental state persistence */
export {
  saveIncrementalCheckpoint,
  detectIncompleteCheckpoint,
  markCheckpointComplete,
  clearCheckpoints
} from './incremental-checkpoint';

/** Exponential backoff retry for provider/LLM errors */
export {
  withRetry,
  isRetryableError,
  type RetryOptions
} from './provider-retry';

/** Validates tool outputs before persisting to disk */
export {
  validateOutput,
  isEmptyContent,
  isDuplicateContent,
  validateContentType
} from './output-validator';

/** Fast-fail pre-validation — rejects doomed tasks before work begins */
export {
  validateTask,
  type TaskValidationResult
} from './task-validator';

/** Analyzes task complexity and recommends timeouts */
export {
  estimateComplexity,
  type ComplexityResult
} from './complexity-estimator';

/** Tracks iteration timing with avg/median/p95 stats */
export {
  startIteration,
  endIteration,
  getStats,
  resetTimer
} from './iteration-timer';

/** Programmatic metrics collection from filesystem */
export {
  collectMetrics,
  type MetricsResult
} from './metrics-dashboard';

/** Complexity-aware file writes — skips heavy validation for simple tasks */
export {
  fastWrite,
  type FastWriteResult
} from './fast-path';

/** Cross-project satellite health aggregation */
export {
  aggregateMetrics,
  type AggregatedMetrics
} from './metrics-aggregator';

/** Per-iteration token/time budget enforcement */
export {
  createBudget,
  type Budget
} from './iteration-budget';

/** Unified system health check */
export {
  runHealthCheck,
  type HealthCheckResult
} from './health-check';
