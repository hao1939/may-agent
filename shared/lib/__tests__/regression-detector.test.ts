import { describe, it, expect } from 'bun:test';
import { detectRegressions } from '../regression-detector.js';

describe('detectRegressions', () => {
  it('returns no regressions when metrics are stable', () => {
    const result = detectRegressions(
      { tests: 100, coverage: 80 },
      { tests: 100, coverage: 80 }
    );
    expect(result.passed).toBe(true);
    expect(result.regressions).toHaveLength(0);
  });

  it('detects a single regression', () => {
    const result = detectRegressions(
      { tests: 80 },
      { tests: 100 }
    );
    expect(result.passed).toBe(false);
    expect(result.regressions).toHaveLength(1);
    expect(result.regressions[0]).toEqual({ metric: 'tests', current: 80, baseline: 100, drop: 0.2 });
  });

  it('detects multiple regressions', () => {
    const result = detectRegressions(
      { tests: 50, coverage: 40, speed: 10 },
      { tests: 100, coverage: 80, speed: 10 }
    );
    expect(result.passed).toBe(false);
    expect(result.regressions).toHaveLength(2);
    expect(result.regressions.map(r => r.metric).sort()).toEqual(['coverage', 'tests']);
  });

  it('respects custom threshold', () => {
    // 15% drop, default threshold (10%) would flag it
    const result = detectRegressions({ tests: 85 }, { tests: 100 }, 0.2);
    expect(result.passed).toBe(true);
    expect(result.regressions).toHaveLength(0);
  });

  it('ignores metrics not in current', () => {
    const result = detectRegressions(
      { tests: 100 },
      { tests: 100, coverage: 80 }
    );
    expect(result.passed).toBe(true);
  });

  it('handles zero baseline gracefully', () => {
    const result = detectRegressions({ tests: 0 }, { tests: 0 });
    expect(result.passed).toBe(true);
  });

  it('does not flag improvements', () => {
    const result = detectRegressions({ tests: 120 }, { tests: 100 });
    expect(result.passed).toBe(true);
  });
});
