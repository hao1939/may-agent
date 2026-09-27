/**
 * Shared library barrel exports
 * Import from '@shared/lib' to access all shared utilities.
 */

export * from './hao-alignment/index.js';
export * from './task-template.js';
export * from './project-template.js';
export * from './session-analyzer.js';
export * from './regression-detector.js';
export * from './cost-tracker.js';

// Avoid TS2308: several modules export identically named types.
// Re-export with explicit names so downstream imports stay unambiguous.
export {
  type IterationRecord as MonitorIterationRecord,
  type IterationMetrics,
  recordIteration,
  getMetrics,
} from './iteration-monitor.js';
export {
  type IterationRecord as WorkflowIterationRecord,
  type WorkflowStats,
  type WorkflowMetricsResult,
  getWorkflowMetrics,
} from './workflow-metrics.js';
export {
  type ValidationResult as TaskValidationResult,
  validateWriteFirst,
  actionRatio,
} from './task-validator.js';
export {
  type ValidationResult as ConfigValidationResult,
  validateProjectConfig,
} from './config-validator.js';
