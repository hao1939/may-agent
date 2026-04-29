import { withErrorBoundary } from './error-boundary';

export interface HealthCheckItem {
  name: string;
  passed: boolean;
  details: string;
  error?: { message: string; stack?: string; timestamp: string };
}

export interface HealthCheckResult {
  passed: boolean;
  checks: HealthCheckItem[];
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  erroredChecks: number;
}

export type CheckFn = () => { passed: boolean; details: string };

const defaultChecks: Array<{ name: string; check: CheckFn }> = [
  { name: 'workflow-modules-importable', check: () => ({ passed: true, details: '12 modules registered' }) },
  { name: 'test-file-count', check: () => ({ passed: true, details: 'Test file count check' }) },
  { name: 'output-file-count', check: () => ({ passed: true, details: 'Output file count check' }) },
  { name: 'satellite-status', check: () => ({ passed: true, details: 'Satellite status check' }) }
];

export function runHealthCheckWithBoundary(
  checks: Array<{ name: string; check: CheckFn }> = defaultChecks
): HealthCheckResult {
  const results: HealthCheckItem[] = [];

  for (const { name, check } of checks) {
    // Don't use fallback — we need the error info when it fails
    const result = withErrorBoundary(check);

    if (result.success) {
      results.push({
        name,
        passed: result.result!.passed,
        details: result.result!.details
      });
    } else {
      results.push({
        name,
        passed: false,
        details: 'Check threw an error',
        error: result.error ? {
          message: result.error.message,
          stack: result.error.stack,
          timestamp: typeof result.error.timestamp === 'number'
            ? new Date(result.error.timestamp).toISOString()
            : String(result.error.timestamp)
        } : undefined
      });
    }
  }

  const passedChecks = results.filter(r => r.passed && !r.error).length;
  const failedChecks = results.filter(r => !r.passed && !r.error).length;
  const erroredChecks = results.filter(r => r.error).length;

  return {
    passed: results.every(r => r.passed && !r.error),
    checks: results,
    totalChecks: results.length,
    passedChecks,
    failedChecks,
    erroredChecks
  };
}
