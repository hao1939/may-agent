/**
 * workflow-runner.ts — Unified composition module that ties together:
 *   - dispatch-validator: pre-flight project validation
 *   - health-check: system health pre-flight
 *   - project-cache: cached filesystem reads
 *   - retry-wrapper: circuit-breaker-aware LLM retries
 *
 * Exports a single `runWorkflow()` pipeline and composable stage functions.
 */

import { ProjectCache, CacheStats } from "./project-cache.js";
import { createRetryWrapper, RetryWrapper, RetryConfig, RetryResult } from "./retry-wrapper.js";
import { validateDispatch, ValidationResult, parseProjectDir } from "./dispatch-validator.js";
import { checkHealth, HealthReport, ProjectHealth, analyzeProject } from "./health-check.js";

// ── Types ───────────────────────────────────────────────────────────

export type WorkflowStage = "validate" | "health-check" | "execute" | "complete";

export interface WorkflowConfig {
  projectRoot: string;
  task: string;
  maxIterations: number;
  retryConfig?: Partial<RetryConfig>;
  healthCheckEnabled: boolean;
  healthCheckThreshold: number;  // min healthy ratio (0-1) to proceed
  satelliteDirs?: string[];      // dirs to health-check
}

export interface StageResult {
  stage: WorkflowStage;
  success: boolean;
  durationMs: number;
  details: Record<string, unknown>;
}

export interface WorkflowResult {
  success: boolean;
  stages: StageResult[];
  totalDurationMs: number;
  cacheStats: CacheStats | null;
  error?: string;
}

// ── Pure/testable functions ─────────────────────────────────────────

export function mergeWorkflowConfig(partial: Partial<WorkflowConfig>): WorkflowConfig {
  return {
    projectRoot: partial.projectRoot ?? "/app",
    task: partial.task ?? "",
    maxIterations: partial.maxIterations ?? 5,
    retryConfig: partial.retryConfig,
    healthCheckEnabled: partial.healthCheckEnabled ?? true,
    healthCheckThreshold: partial.healthCheckThreshold ?? 0.5,
    satelliteDirs: partial.satelliteDirs,
  };
}

export function shouldProceedAfterHealthCheck(
  report: HealthReport,
  threshold: number
): { proceed: boolean; reason: string } {
  if (report.summary.total === 0) {
    return { proceed: true, reason: "No projects to check" };
  }
  const healthyRatio = report.summary.healthy / report.summary.total;
  if (healthyRatio >= threshold) {
    return {
      proceed: true,
      reason: `Health ratio ${(healthyRatio * 100).toFixed(0)}% >= threshold ${(threshold * 100).toFixed(0)}%`,
    };
  }
  return {
    proceed: false,
    reason: `Health ratio ${(healthyRatio * 100).toFixed(0)}% < threshold ${(threshold * 100).toFixed(0)}%`,
  };
}

export function buildStageResult(
  stage: WorkflowStage,
  success: boolean,
  startMs: number,
  details: Record<string, unknown> = {}
): StageResult {
  return {
    stage,
    success,
    durationMs: Date.now() - startMs,
    details,
  };
}

export function summarizeWorkflow(stages: StageResult[], cache: ProjectCache | null): WorkflowResult {
  const totalMs = stages.reduce((s, r) => s + r.durationMs, 0);
  const allSuccess = stages.every((s) => s.success);
  const failedStage = stages.find((s) => !s.success);
  return {
    success: allSuccess,
    stages,
    totalDurationMs: totalMs,
    cacheStats: cache?.getStats() ?? null,
    error: failedStage ? `Failed at stage: ${failedStage.stage}` : undefined,
  };
}

export function extractProjectPath(config: WorkflowConfig): string | null {
  return parseProjectDir(config.task);
}

export function isConfigValid(config: WorkflowConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!config.task) errors.push("task is required");
  if (config.maxIterations < 1) errors.push("maxIterations must be >= 1");
  if (config.healthCheckThreshold < 0 || config.healthCheckThreshold > 1) {
    errors.push("healthCheckThreshold must be 0-1");
  }
  return { valid: errors.length === 0, errors };
}

// ── Stage runners ───────────────────────────────────────────────────

export async function runValidationStage(
  config: WorkflowConfig
): Promise<StageResult> {
  const start = Date.now();
  const validation: ValidationResult = validateDispatch(config.task, config.projectRoot);
  return buildStageResult("validate", validation.valid, start, {
    errors: validation.errors,
    warnings: validation.warnings,
    projectDir: validation.projectDir,
  });
}

export async function runHealthCheckStage(
  config: WorkflowConfig,
  readFn?: (path: string) => string | null
): Promise<StageResult> {
  const start = Date.now();
  if (!config.healthCheckEnabled) {
    return buildStageResult("health-check", true, start, { skipped: true });
  }
  const dirs = config.satelliteDirs ?? [];
  const projects = dirs.map((dir) => {
    const name = dir.split("/").pop() || dir;
    let projectContent: string | null = null;
    let journalContent: string | null = null;
    if (readFn) {
      try { projectContent = readFn(`${dir}/project.md`); } catch {}
      try { journalContent = readFn(`${dir}/journal.md`); } catch {}
    }
    return { name, projectContent, journalContent };
  });
  const report = checkHealth(projects);
  const decision = shouldProceedAfterHealthCheck(report, config.healthCheckThreshold);
  return buildStageResult("health-check", decision.proceed, start, {
    report: report.summary,
    reason: decision.reason,
  });
}

export async function runExecutionStage(
  executeFn: () => Promise<unknown>,
  retryWrapper: RetryWrapper | null,
  agentId: string
): Promise<StageResult> {
  const start = Date.now();
  try {
    let result: unknown;
    if (retryWrapper) {
      const retryResult: RetryResult<unknown> = await retryWrapper.execute(executeFn, agentId);
      if (!retryResult.success) {
        return buildStageResult("execute", false, start, {
          attempts: retryResult.attempts,
          error: retryResult.error?.message ?? "unknown",
        });
      }
      result = retryResult.value;
    } else {
      result = await executeFn();
    }
    return buildStageResult("execute", true, start, { result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return buildStageResult("execute", false, start, { error: msg });
  }
}

// ── Main pipeline ───────────────────────────────────────────────────

export async function runWorkflow(
  config: Partial<WorkflowConfig>,
  executeFn: () => Promise<unknown>,
  options?: { readFn?: (path: string) => string; agentId?: string }
): Promise<WorkflowResult> {
  const cfg = mergeWorkflowConfig(config);
  const stages: StageResult[] = [];

  // Config validation
  const configCheck = isConfigValid(cfg);
  if (!configCheck.valid) {
    return {
      success: false,
      stages: [],
      totalDurationMs: 0,
      cacheStats: null,
      error: `Invalid config: ${configCheck.errors.join(", ")}`,
    };
  }

  // Stage 1: Validate dispatch
  const validationResult = await runValidationStage(cfg);
  stages.push(validationResult);
  if (!validationResult.success) {
    return summarizeWorkflow(stages, null);
  }

  // Stage 2: Health check
  const cache = new ProjectCache();
  const readFn = options?.readFn;
  const healthResult = await runHealthCheckStage(cfg, readFn);
  stages.push(healthResult);
  if (!healthResult.success) {
    return summarizeWorkflow(stages, cache);
  }

  // Stage 3: Execute with retries
  const retryWrapper = createRetryWrapper(cfg.retryConfig);
  const agentId = options?.agentId ?? "workflow-runner";
  const execResult = await runExecutionStage(executeFn, retryWrapper, agentId);
  stages.push(execResult);

  // Stage 4: Complete
  stages.push(buildStageResult("complete", execResult.success, Date.now(), {}));

  return summarizeWorkflow(stages, cache);
}
