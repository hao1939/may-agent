import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { getWorkflowMetrics } from '../workflow-metrics.js';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const TEST_DIR = join(tmpdir(), 'may-agent-wf-metrics-test');
const TEST_LOG = join(TEST_DIR, 'iteration-log.json');

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('getWorkflowMetrics', () => {
  it('returns empty result for missing log file', () => {
    const result = getWorkflowMetrics(join(TEST_DIR, 'nonexistent.json'));
    expect(result).toEqual({ byWorkflow: {}, total: 0 });
  });

  it('returns empty result for empty array', () => {
    writeFileSync(TEST_LOG, '[]');
    const result = getWorkflowMetrics(TEST_LOG);
    expect(result).toEqual({ byWorkflow: {}, total: 0 });
  });

  it('groups by workflow field when present', () => {
    const records = [
      { id: '1', workflow: 'master-worker', deliverableProduced: true, firstAttempt: true, durationMs: 1000 },
      { id: '2', workflow: 'master-worker', deliverableProduced: false, firstAttempt: false, durationMs: 2000 },
      { id: '3', workflow: 'code-review', deliverableProduced: true, firstAttempt: true, durationMs: 500 },
    ];
    writeFileSync(TEST_LOG, JSON.stringify(records));
    const result = getWorkflowMetrics(TEST_LOG);

    expect(result.total).toBe(3);
    expect(result.byWorkflow['master-worker']).toEqual({ count: 2, successRate: 0.5, avgDurationMs: 1500 });
    expect(result.byWorkflow['code-review']).toEqual({ count: 1, successRate: 1, avgDurationMs: 500 });
  });

  it('extracts workflow from id when workflow field missing', () => {
    const records = [
      { id: 'deploy-1', deliverableProduced: true, firstAttempt: true, durationMs: 800 },
      { id: 'deploy-2', deliverableProduced: true, firstAttempt: true, durationMs: 1200 },
    ];
    writeFileSync(TEST_LOG, JSON.stringify(records));
    const result = getWorkflowMetrics(TEST_LOG);

    expect(result.byWorkflow['deploy']).toEqual({ count: 2, successRate: 1, avgDurationMs: 1000 });
  });

  it('falls back to unknown when no separator pattern matches', () => {
    const records = [
      { id: 'nopattern', deliverableProduced: false, firstAttempt: false, durationMs: 3000 },
    ];
    writeFileSync(TEST_LOG, JSON.stringify(records));
    const result = getWorkflowMetrics(TEST_LOG);

    expect(result.byWorkflow['unknown']).toEqual({ count: 1, successRate: 0, avgDurationMs: 3000 });
  });

  it('computes correct metrics across many records', () => {
    const records = Array.from({ length: 10 }, (_, i) => ({
      id: `build-${i}`,
      workflow: 'build',
      deliverableProduced: i % 2 === 0,
      firstAttempt: i < 7,
      durationMs: 100 * (i + 1),
    }));
    writeFileSync(TEST_LOG, JSON.stringify(records));
    const result = getWorkflowMetrics(TEST_LOG);

    expect(result.total).toBe(10);
    expect(result.byWorkflow['build'].count).toBe(10);
    expect(result.byWorkflow['build'].successRate).toBe(0.5);
    expect(result.byWorkflow['build'].avgDurationMs).toBe(550);
  });
});
