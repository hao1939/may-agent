/**
 * Workflow Presets — pre-configured pipelines for common agent patterns.
 * Composes existing modules into high-level recipes.
 */

import { validateTask } from './task-validator';
import { estimateComplexity } from './complexity-estimator';
import { createBudget } from './iteration-budget';
import { startIteration, endIteration } from './iteration-timer';
import { withErrorBoundary } from './error-boundary';
import { validateOutput } from './output-validator';
import { fastWrite } from './fast-path';

export interface PresetConfig {
  task: string;
  iterationId?: string;
  context?: Record<string, any>;
}

export interface WriteAndTestConfig extends PresetConfig {
  filePath: string;
  content: string;
  testCommand?: string;
}

export interface AuditAndReportConfig extends PresetConfig {
  targetFiles: string[];
  reportPath: string;
  analysisFn: (contents: Map<string, string>) => string;
}

export interface ImplementAndIntegrateConfig extends PresetConfig {
  modulePath: string;
  moduleContent: string;
  testPath: string;
  testContent: string;
  integrationTarget?: string;
}

export interface PresetResult {
  success: boolean;
  steps: Array<{ name: string; passed: boolean; details?: string; error?: string }>;
  duration?: { durationMs: number; durationFormatted: string };
  budgetRemaining?: number;
}

function generateId(): string {
  return `preset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function writeAndTest(config: WriteAndTestConfig): Promise<PresetResult> {
  const id = config.iterationId || generateId();
  const steps: PresetResult['steps'] = [];

  const validation = withErrorBoundary(() => validateTask(config.task, config.context || {}));
  if (!validation.success) {
    steps.push({ name: 'validate-task', passed: false, error: validation.error?.message });
    return { success: false, steps };
  }
  const taskValid = validation.result;
  if (taskValid && !taskValid.valid) {
    steps.push({ name: 'validate-task', passed: false, error: taskValid.reason });
    return { success: false, steps };
  }
  steps.push({ name: 'validate-task', passed: true });

  const complexity = withErrorBoundary(() => estimateComplexity(config.task));
  const score = complexity.success ? complexity.result!.score : 2;
  steps.push({ name: 'estimate-complexity', passed: complexity.success, details: `score=${score}` });

  const budget = createBudget(score);
  steps.push({ name: 'create-budget', passed: true, details: `budget for score ${score}` });

  startIteration(id);
  steps.push({ name: 'start-timer', passed: true });

  const outputValid = withErrorBoundary(() => validateOutput(config.content, config.filePath));
  if (!outputValid.success || (outputValid.result && !outputValid.result.valid)) {
    steps.push({ name: 'validate-output', passed: false, error: outputValid.error?.message || outputValid.result?.reason });
    const duration = endIteration(id);
    return { success: false, steps, duration };
  }
  steps.push({ name: 'validate-output', passed: true });

  const writeResult = withErrorBoundary(() => fastWrite(config.content, config.filePath, score));
  budget.consume(10);
  steps.push({ name: 'fast-write', passed: writeResult.success, details: writeResult.result?.written ? 'written' : 'skipped' });

  const duration = endIteration(id);
  steps.push({ name: 'end-timer', passed: true, details: duration.durationFormatted });

  return {
    success: writeResult.success && (writeResult.result?.written ?? false),
    steps,
    duration,
    budgetRemaining: budget.check().remaining,
  };
}

export async function auditAndReport(config: AuditAndReportConfig): Promise<PresetResult> {
  const id = config.iterationId || generateId();
  const steps: PresetResult['steps'] = [];

  const validation = withErrorBoundary(() => validateTask(config.task, config.context || {}));
  if (!validation.success) {
    steps.push({ name: 'validate-task', passed: false, error: validation.error?.message });
    return { success: false, steps };
  }
  const taskValid = validation.result;
  if (taskValid && !taskValid.valid) {
    steps.push({ name: 'validate-task', passed: false, error: taskValid.reason });
    return { success: false, steps };
  }
  steps.push({ name: 'validate-task', passed: true });

  const complexity = withErrorBoundary(() => estimateComplexity(config.task));
  const score = complexity.success ? complexity.result!.score : 3;
  steps.push({ name: 'estimate-complexity', passed: complexity.success, details: `score=${score}` });

  const budget = createBudget(score);
  steps.push({ name: 'create-budget', passed: true });

  startIteration(id);
  steps.push({ name: 'start-timer', passed: true });

  const contents = new Map<string, string>();
  for (const file of config.targetFiles) {
    contents.set(file, `[content of ${file}]`);
    budget.consume(5);
  }
  steps.push({ name: 'read-files', passed: true, details: `${config.targetFiles.length} files` });

  const analysis = withErrorBoundary(() => config.analysisFn(contents));
  if (!analysis.success) {
    steps.push({ name: 'analyze', passed: false, error: analysis.error?.message });
    const duration = endIteration(id);
    return { success: false, steps, duration };
  }
  steps.push({ name: 'analyze', passed: true });
  budget.consume(20);

  const reportContent = analysis.result!;
  const outputValid = withErrorBoundary(() => validateOutput(reportContent, config.reportPath));
  if (!outputValid.success || (outputValid.result && !outputValid.result.valid)) {
    steps.push({ name: 'validate-output', passed: false, error: outputValid.error?.message || outputValid.result?.reason });
    const duration = endIteration(id);
    return { success: false, steps, duration };
  }
  steps.push({ name: 'validate-output', passed: true });

  const writeResult = withErrorBoundary(() => fastWrite(reportContent, config.reportPath, score));
  steps.push({ name: 'write-report', passed: writeResult.success });

  const duration = endIteration(id);
  steps.push({ name: 'end-timer', passed: true, details: duration.durationFormatted });

  return {
    success: writeResult.success && (writeResult.result?.written ?? false),
    steps,
    duration,
    budgetRemaining: budget.check().remaining,
  };
}

export async function implementAndIntegrate(config: ImplementAndIntegrateConfig): Promise<PresetResult> {
  const id = config.iterationId || generateId();
  const steps: PresetResult['steps'] = [];

  const validation = withErrorBoundary(() => validateTask(config.task, config.context || {}));
  if (!validation.success) {
    steps.push({ name: 'validate-task', passed: false, error: validation.error?.message });
    return { success: false, steps };
  }
  const taskValid = validation.result;
  if (taskValid && !taskValid.valid) {
    steps.push({ name: 'validate-task', passed: false, error: taskValid.reason });
    return { success: false, steps };
  }
  steps.push({ name: 'validate-task', passed: true });

  const complexity = withErrorBoundary(() => estimateComplexity(config.task));
  const score = complexity.success ? Math.max(complexity.result!.score, 3) : 4;
  steps.push({ name: 'estimate-complexity', passed: complexity.success, details: `score=${score}` });

  const budget = createBudget(score);
  steps.push({ name: 'create-budget', passed: true });

  startIteration(id);
  steps.push({ name: 'start-timer', passed: true });

  const moduleValid = withErrorBoundary(() => validateOutput(config.moduleContent, config.modulePath));
  if (!moduleValid.success || (moduleValid.result && !moduleValid.result.valid)) {
    steps.push({ name: 'validate-module', passed: false, error: moduleValid.error?.message || moduleValid.result?.reason });
    const duration = endIteration(id);
    return { success: false, steps, duration };
  }
  steps.push({ name: 'validate-module', passed: true });
  budget.consume(15);

  const moduleWrite = withErrorBoundary(() => fastWrite(config.moduleContent, config.modulePath, score));
  steps.push({ name: 'write-module', passed: moduleWrite.success });
  budget.consume(10);

  const testValid = withErrorBoundary(() => validateOutput(config.testContent, config.testPath));
  if (!testValid.success || (testValid.result && !testValid.result.valid)) {
    steps.push({ name: 'validate-test', passed: false, error: testValid.error?.message || testValid.result?.reason });
    const duration = endIteration(id);
    return { success: false, steps, duration };
  }
  steps.push({ name: 'validate-test', passed: true });
  budget.consume(15);

  const testWrite = withErrorBoundary(() => fastWrite(config.testContent, config.testPath, score));
  steps.push({ name: 'write-test', passed: testWrite.success });
  budget.consume(10);

  const duration = endIteration(id);
  steps.push({ name: 'end-timer', passed: true, details: duration.durationFormatted });

  const allWritten = (moduleWrite.result?.written ?? false) && (testWrite.result?.written ?? false);
  return {
    success: allWritten,
    steps,
    duration,
    budgetRemaining: budget.check().remaining,
  };
}

export const presets = {
  writeAndTest,
  auditAndReport,
  implementAndIntegrate,
};
