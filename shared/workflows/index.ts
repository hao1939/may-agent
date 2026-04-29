/**
 * Workflow Toolkit — Barrel Export
 * 
 * Unified entry point for all workflow modules built across Phases 2-6.
 * Import from this file to access the complete toolkit:
 * 
 *   import { validateTask, estimateComplexity, createBudget } from './workflows/index';
 */

/** Phase 2: Crash recovery — saves/restores state mid-iteration */
export {
  saveIncrementalCheckpoint,
  detectIncompleteCheckpoint,
  markCheckpointComplete,
} from './incremental-checkpoint';

/** Phase 2: Provider error handling — exponential backoff retry for transient failures */
export {
  withRetry,
  isRetryableError,
  RetryConfig,
} from './provider-retry';

/** Phase 2: Output quality gate — validates file content before writing to disk */
export {
  validateOutput,
  isEmptyContent,
  isDuplicateContent,
  validateContentType,
} from './output-validator';

/** Phase 3: Fast-fail pre-validation — rejects doomed tasks before work begins */
export {
  validateTask,
} from './task-validator';

/** Phase 3: Task complexity scoring — estimates effort and sets adaptive timeouts */
export {
  estimateComplexity,
} from './complexity-estimator';

/** Phase 4: Iteration timing — tracks duration and computes p95/avg/median stats */
export {
  startIteration,
  endIteration,
  getStats,
} from './iteration-timer';

/** Phase 4: Programmatic metrics collection — scans filesystem for test/output counts */
export {
  collectMetrics,
} from './metrics-dashboard';

/** Phase 4: Adaptive validation — skips expensive checks for simple writes */
export {
  fastWrite,
} from './fast-path';

/** Phase 5: Cross-project awareness — aggregates satellite project health */
export {
  aggregateMetrics,
} from './metrics-aggregator';

/** Phase 5: Resource management — enforces per-iteration token/time budgets */
export {
  createBudget,
} from './iteration-budget';

/** Phase 6: Unified health verification — checks all system components */
export {
  runHealthCheck,
} from './health-check';
