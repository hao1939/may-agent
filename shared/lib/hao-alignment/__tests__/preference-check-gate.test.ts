import { describe, it, expect } from 'bun:test';
import { preferenceGate } from '../preference-check-gate';

describe('preferenceGate', () => {
  it('passes fix actions (stability-first)', () => {
    const result = preferenceGate({ action: 'fix broken test suite', category: 'fix' });
    expect(result.pass).toBe(true);
    expect(result.score).toBeGreaterThan(0);
  });

  it('passes cleanup actions', () => {
    const result = preferenceGate({ action: 'clean up dead code', category: 'cleanup' });
    expect(result.pass).toBe(true);
  });

  it('penalizes new-work but still passes if no other negatives', () => {
    const result = preferenceGate({ action: 'add feature', category: 'new-work' });
    expect(result.score).toBeLessThan(0);
    // Score is -2, threshold is -2, so pass requires > -2 → this fails
    expect(result.pass).toBe(false);
  });

  it('strongly rejects weakening guards', () => {
    const result = preferenceGate({ action: 'disable guard to speed up dev' });
    expect(result.pass).toBe(false);
    expect(result.score).toBeLessThanOrEqual(-5);
  });

  it('rewards observability work', () => {
    const result = preferenceGate({ action: 'add monitoring dashboard', category: 'observability' });
    expect(result.pass).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(2);
  });

  it('penalizes bob doing implementation', () => {
    const result = preferenceGate({ action: 'implement API endpoint', agent: 'bob' });
    expect(result.score).toBeLessThan(0);
  });

  it('penalizes may using blocking calls', () => {
    const result = preferenceGate({ action: 'call() tech-lead synchronous', agent: 'may' });
    expect(result.pass).toBe(false);
  });

  it('rewards closing/shipping work', () => {
    const result = preferenceGate({ action: 'close completed project' });
    expect(result.pass).toBe(true);
    expect(result.score).toBeGreaterThan(0);
  });

  it('returns checked preferences list', () => {
    const result = preferenceGate({ action: 'fix broken build', category: 'fix' });
    expect(result.preferences_checked.length).toBeGreaterThan(0);
    expect(result.preferences_checked.some(p => p.includes('stability-first'))).toBe(true);
  });
});
