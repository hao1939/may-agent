import { describe, it, expect, vi, beforeEach } from 'vitest';
import { presets, writeAndTest, auditAndReport, implementAndIntegrate } from '../workflows/workflow-preset';

vi.mock('../workflows/task-validator', () => ({
  validateTask: vi.fn().mockReturnValue({ valid: true }),
}));
vi.mock('../workflows/complexity-estimator', () => ({
  estimateComplexity: vi.fn().mockReturnValue({ score: 2, timeoutMs: 120000, description: 'simple' }),
}));
vi.mock('../workflows/iteration-budget', () => ({
  createBudget: vi.fn().mockReturnValue({
    check: () => ({ remaining: 50, exceeded: false }),
    consume: vi.fn(),
    isExceeded: () => false,
  }),
}));
vi.mock('../workflows/iteration-timer', () => ({
  startIteration: vi.fn(),
  endIteration: vi.fn().mockReturnValue({ durationMs: 1500, durationFormatted: '1.5s' }),
}));
vi.mock('../workflows/error-boundary', () => ({
  withErrorBoundary: vi.fn((fn) => {
    try {
      const result = fn();
      return { success: true, result };
    } catch (e: any) {
      return { success: false, error: { message: e.message, stack: e.stack, timestamp: Date.now() } };
    }
  }),
}));
vi.mock('../workflows/output-validator', () => ({
  validateOutput: vi.fn().mockReturnValue({ valid: true }),
}));
vi.mock('../workflows/fast-path', () => ({
  fastWrite: vi.fn().mockReturnValue({ written: true, skippedValidation: [] }),
}));

import { validateTask } from '../workflows/task-validator';
import { estimateComplexity } from '../workflows/complexity-estimator';
import { validateOutput } from '../workflows/output-validator';
import { fastWrite } from '../workflows/fast-path';

beforeEach(() => {
  vi.clearAllMocks();
  (validateTask as any).mockReturnValue({ valid: true });
  (estimateComplexity as any).mockReturnValue({ score: 2, timeoutMs: 120000, description: 'simple' });
  (validateOutput as any).mockReturnValue({ valid: true });
  (fastWrite as any).mockReturnValue({ written: true, skippedValidation: [] });
});

describe('presets.writeAndTest', () => {
  it('runs full pipeline on valid task', async () => {
    const result = await writeAndTest({ task: 'Write a file', filePath: '/tmp/t.md', content: '# Hello\n\nBody.' });
    expect(result.success).toBe(true);
    expect(result.steps.length).toBeGreaterThanOrEqual(6);
    expect(result.steps[0]).toEqual({ name: 'validate-task', passed: true });
  });

  it('rejects invalid task early', async () => {
    (validateTask as any).mockReturnValue({ valid: false, reason: 'missing file' });
    const result = await writeAndTest({ task: 'Bad', filePath: '/tmp/t.md', content: 'x' });
    expect(result.success).toBe(false);
    expect(result.steps.length).toBe(1);
  });

  it('rejects empty content', async () => {
    (validateOutput as any).mockReturnValue({ valid: false, reason: 'empty' });
    const result = await writeAndTest({ task: 'Write', filePath: '/tmp/t.md', content: '' });
    expect(result.success).toBe(false);
  });

  it('reports budget remaining', async () => {
    const result = await writeAndTest({ task: 'Write', filePath: '/tmp/t.md', content: '# X\n\nY.' });
    expect(result.budgetRemaining).toBeDefined();
  });

  it('uses custom iteration ID', async () => {
    const result = await writeAndTest({ task: 'Write', filePath: '/tmp/t.md', content: '# X', iterationId: 'id-1' });
    expect(result.success).toBe(true);
  });

  it('handles write failure', async () => {
    (fastWrite as any).mockReturnValue({ written: false, skippedValidation: [] });
    const result = await writeAndTest({ task: 'Write', filePath: '/tmp/t.md', content: '# X' });
    expect(result.success).toBe(false);
  });

  it('includes complexity in steps', async () => {
    const result = await writeAndTest({ task: 'Write', filePath: '/tmp/t.md', content: '# X\nBody' });
    expect(result.steps.find(s => s.name === 'estimate-complexity')?.details).toContain('score=');
  });
});

describe('presets.auditAndReport', () => {
  it('runs full audit pipeline', async () => {
    const result = await auditAndReport({
      task: 'Audit files', targetFiles: ['a.ts', 'b.ts'], reportPath: '/tmp/r.md',
      analysisFn: (c) => `# Report\n\n${c.size} files.`,
    });
    expect(result.success).toBe(true);
    expect(result.steps.find(s => s.name === 'read-files')?.details).toBe('2 files');
  });

  it('handles analysis throwing', async () => {
    const result = await auditAndReport({
      task: 'Audit', targetFiles: ['a.ts'], reportPath: '/tmp/r.md',
      analysisFn: () => { throw new Error('boom'); },
    });
    expect(result.success).toBe(false);
    expect(result.steps.find(s => s.name === 'analyze')?.passed).toBe(false);
  });

  it('rejects invalid task', async () => {
    (validateTask as any).mockReturnValue({ valid: false, reason: 'bad' });
    const result = await auditAndReport({
      task: 'Bad', targetFiles: [], reportPath: '/tmp/r.md', analysisFn: () => 'x',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid report output', async () => {
    (validateOutput as any).mockReturnValue({ valid: false, reason: 'empty' });
    const result = await auditAndReport({
      task: 'Audit', targetFiles: ['f.ts'], reportPath: '/tmp/r.md', analysisFn: () => '',
    });
    expect(result.success).toBe(false);
  });

  it('reports duration', async () => {
    const result = await auditAndReport({
      task: 'Audit', targetFiles: ['a.ts'], reportPath: '/tmp/r.md', analysisFn: () => '# R\n\nDone.',
    });
    expect(result.duration?.durationMs).toBe(1500);
  });
});

describe('presets.implementAndIntegrate', () => {
  it('runs full pipeline', async () => {
    const result = await implementAndIntegrate({
      task: 'Implement module with tests', modulePath: '/app/m.ts',
      moduleContent: 'export const x = 1;', testPath: '/app/m.test.ts',
      testContent: 'test("x", () => expect(1).toBe(1));',
    });
    expect(result.success).toBe(true);
    expect(result.steps.filter(s => s.passed).length).toBeGreaterThanOrEqual(7);
  });

  it('rejects empty module', async () => {
    (validateOutput as any).mockReturnValueOnce({ valid: false, reason: 'empty' });
    const result = await implementAndIntegrate({
      task: 'Impl', modulePath: '/m.ts', moduleContent: '',
      testPath: '/m.test.ts', testContent: 'test("x",()=>{})',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty test', async () => {
    (validateOutput as any).mockReturnValueOnce({ valid: true }).mockReturnValueOnce({ valid: false, reason: 'empty test' });
    const result = await implementAndIntegrate({
      task: 'Impl', modulePath: '/m.ts', moduleContent: 'export const x=1;',
      testPath: '/m.test.ts', testContent: '',
    });
    expect(result.success).toBe(false);
  });

  it('uses min complexity score 3', async () => {
    (estimateComplexity as any).mockReturnValue({ score: 1, timeoutMs: 30000, description: 'trivial' });
    const result = await implementAndIntegrate({
      task: 'Impl', modulePath: '/m.ts', moduleContent: 'export const x=1;',
      testPath: '/m.test.ts', testContent: 'test("x",()=>{})',
    });
    expect(result.steps.find(s => s.name === 'estimate-complexity')?.details).toContain('score=3');
  });

  it('handles module write failure', async () => {
    (fastWrite as any).mockReturnValueOnce({ written: false, skippedValidation: [] });
    const result = await implementAndIntegrate({
      task: 'Impl', modulePath: '/m.ts', moduleContent: 'export const x=1;',
      testPath: '/m.test.ts', testContent: 'test("x",()=>{})',
    });
    expect(result.success).toBe(false);
  });

  it('reports budget remaining', async () => {
    const result = await implementAndIntegrate({
      task: 'Impl', modulePath: '/m.ts', moduleContent: 'export const x=1;',
      testPath: '/m.test.ts', testContent: 'test("x",()=>{})',
    });
    expect(result.budgetRemaining).toBeDefined();
  });
});

describe('presets namespace', () => {
  it('exports all three presets', () => {
    expect(typeof presets.writeAndTest).toBe('function');
    expect(typeof presets.auditAndReport).toBe('function');
    expect(typeof presets.implementAndIntegrate).toBe('function');
  });

  it('has exactly 3 methods', () => {
    expect(Object.keys(presets)).toHaveLength(3);
  });
});
