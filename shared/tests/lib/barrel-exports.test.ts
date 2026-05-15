import { describe, it, expect } from 'bun:test';
import * as lib from '../../lib/index.js';

describe('barrel exports', () => {
  const expectedExports = [
    'validateWriteFirst',
    'createTaskTemplate',
    'recordIteration',
    'getMetrics',
    'generateProject',
    'getWorkflowMetrics',
    'analyzeIterations',
    'validateProjectConfig',
    'detectRegressions',
  ];

  it('exports all expected functions', () => {
    for (const name of expectedExports) {
      expect(lib).toHaveProperty(name);
      expect(typeof (lib as any)[name]).toBe('function');
    }
  });

  it('does not export undefined values', () => {
    for (const [key, value] of Object.entries(lib)) {
      expect(value, `${key} should not be undefined`).not.toBeUndefined();
    }
  });

  it('exports at least 9 functions', () => {
    const fns = Object.values(lib).filter(v => typeof v === 'function');
    expect(fns.length).toBeGreaterThanOrEqual(9);
  });
});
