import { describe, it, expect } from 'vitest';
import { runHealthCheckWithBoundary, CheckFn } from '../workflows/health-check-with-boundary';

describe('health-check-errorboundary-integration', () => {
  it('all checks pass — normal result', () => {
    const checks = [
      { name: 'check-1', check: () => ({ passed: true, details: 'ok' }) },
      { name: 'check-2', check: () => ({ passed: true, details: 'ok' }) },
    ];
    const result = runHealthCheckWithBoundary(checks);
    expect(result.passed).toBe(true);
    expect(result.totalChecks).toBe(2);
    expect(result.passedChecks).toBe(2);
    expect(result.failedChecks).toBe(0);
    expect(result.erroredChecks).toBe(0);
  });

  it('one check throws — others still run', () => {
    const checks = [
      { name: 'good', check: () => ({ passed: true, details: 'ok' }) },
      { name: 'bad', check: (() => { throw new Error('boom'); }) as unknown as CheckFn },
      { name: 'also-good', check: () => ({ passed: true, details: 'fine' }) },
    ];
    const result = runHealthCheckWithBoundary(checks);
    expect(result.passed).toBe(false);
    expect(result.totalChecks).toBe(3);
    expect(result.passedChecks).toBe(2);
    expect(result.erroredChecks).toBe(1);
    expect(result.checks[1].error).toBeDefined();
    expect(result.checks[1].error!.message).toBe('boom');
    expect(result.checks[0].passed).toBe(true);
    expect(result.checks[2].passed).toBe(true);
  });

  it('all checks throw — structured error report for each', () => {
    const checks = [
      { name: 'err-1', check: (() => { throw new Error('fail1'); }) as unknown as CheckFn },
      { name: 'err-2', check: (() => { throw new Error('fail2'); }) as unknown as CheckFn },
      { name: 'err-3', check: (() => { throw new Error('fail3'); }) as unknown as CheckFn },
    ];
    const result = runHealthCheckWithBoundary(checks);
    expect(result.passed).toBe(false);
    expect(result.erroredChecks).toBe(3);
    expect(result.passedChecks).toBe(0);
    result.checks.forEach((c, i) => {
      expect(c.error).toBeDefined();
      expect(c.error!.message).toBe(`fail${i + 1}`);
      expect(c.error!.timestamp).toBeDefined();
    });
  });

  it('failing check (not throwing) is captured as failed, not errored', () => {
    const checks = [
      { name: 'failing', check: () => ({ passed: false, details: 'threshold not met' }) },
    ];
    const result = runHealthCheckWithBoundary(checks);
    expect(result.passed).toBe(false);
    expect(result.failedChecks).toBe(1);
    expect(result.erroredChecks).toBe(0);
    expect(result.checks[0].error).toBeUndefined();
  });

  it('mix of pass, fail, and error checks', () => {
    const checks = [
      { name: 'pass', check: () => ({ passed: true, details: 'ok' }) },
      { name: 'fail', check: () => ({ passed: false, details: 'nope' }) },
      { name: 'error', check: (() => { throw new Error('crash'); }) as unknown as CheckFn },
    ];
    const result = runHealthCheckWithBoundary(checks);
    expect(result.passed).toBe(false);
    expect(result.passedChecks).toBe(1);
    expect(result.failedChecks).toBe(1);
    expect(result.erroredChecks).toBe(1);
    expect(result.totalChecks).toBe(3);
  });

  it('empty checks array returns passed', () => {
    const result = runHealthCheckWithBoundary([]);
    expect(result.passed).toBe(true);
    expect(result.totalChecks).toBe(0);
  });

  it('error includes timestamp', () => {
    const before = new Date().toISOString();
    const checks = [
      { name: 'err', check: (() => { throw new Error('x'); }) as unknown as CheckFn },
    ];
    const result = runHealthCheckWithBoundary(checks);
    const after = new Date().toISOString();
    const ts = result.checks[0].error!.timestamp;
    expect(ts >= before).toBe(true);
    expect(ts <= after).toBe(true);
  });

  it('error includes stack trace', () => {
    const checks = [
      { name: 'err', check: (() => { throw new Error('stack-test'); }) as unknown as CheckFn },
    ];
    const result = runHealthCheckWithBoundary(checks);
    expect(result.checks[0].error!.stack).toBeDefined();
    expect(result.checks[0].error!.stack).toContain('stack-test');
  });

  it('checks run in order', () => {
    const order: string[] = [];
    const checks = [
      { name: 'first', check: () => { order.push('first'); return { passed: true, details: '' }; } },
      { name: 'second', check: () => { order.push('second'); return { passed: true, details: '' }; } },
      { name: 'third', check: () => { order.push('third'); return { passed: true, details: '' }; } },
    ];
    runHealthCheckWithBoundary(checks);
    expect(order).toEqual(['first', 'second', 'third']);
  });

  it('thrown check still has name in result', () => {
    const checks = [
      { name: 'my-check', check: (() => { throw new Error('x'); }) as unknown as CheckFn },
    ];
    const result = runHealthCheckWithBoundary(checks);
    expect(result.checks[0].name).toBe('my-check');
    expect(result.checks[0].passed).toBe(false);
  });

  it('default checks run without error', () => {
    const result = runHealthCheckWithBoundary();
    expect(result.totalChecks).toBeGreaterThan(0);
    expect(result.erroredChecks).toBe(0);
  });

  it('single passing check', () => {
    const checks = [
      { name: 'solo', check: () => ({ passed: true, details: 'solo pass' }) },
    ];
    const result = runHealthCheckWithBoundary(checks);
    expect(result.passed).toBe(true);
    expect(result.checks[0].details).toBe('solo pass');
  });
});
