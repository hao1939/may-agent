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
  cleanupCheckpoints
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
  findDuplicate,
  validateContentType,
  hashContent
} from './output-validator';

/** Analyzes task complexity and recommends timeouts */
export {
  estimateComplexity,
  type ComplexityEstimate as ComplexityResult
} from './complexity-estimator';

/** Tracks iteration timing with avg/median/p95 stats */
export {
  IterationTimer,
  formatDuration
} from './iteration-timer';
export type { TimerStats } from './iteration-timer';

/** Per-iteration token/time budget enforcement */
export {
  createBudget,
  type Budget
} from './iteration-budget';

/** Unified system health check */
export {
  checkHealth,
  analyzeProject,
  parseMetrics,
  isAtTarget,
  isStalled,
  extractLastActivity
} from './health-check';
export type { HealthReport, ProjectHealth, MetricInfo } from './health-check';
