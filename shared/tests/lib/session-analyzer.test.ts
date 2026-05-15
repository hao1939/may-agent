import { describe, it, expect } from 'bun:test';
import { analyzeIterations, IterationRecord } from '../../lib/session-analyzer.js';

describe('session-analyzer', () => {
  it('handles empty input', () => {
    const result = analyzeIterations([]);
    expect(result.slowest).toEqual([]);
    expect(result.patterns).toEqual([]);
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0]).toContain('No iteration data');
  });

  it('handles null input', () => {
    const result = analyzeIterations(null as any);
    expect(result.slowest).toEqual([]);
  });

  it('returns no slowest for uniform durations', () => {
    const entries: IterationRecord[] = Array.from({ length: 5 }, (_, i) => ({
      id: `iter-${i}`,
      deliverableProduced: true,
      firstAttempt: true,
      durationMs: 1000,
    }));
    const result = analyzeIterations(entries);
    expect(result.slowest).toEqual([]);
  });

  it('detects slow outliers (>2x average)', () => {
    const entries: IterationRecord[] = [
      { id: 'fast-1', deliverableProduced: true, firstAttempt: true, durationMs: 100 },
      { id: 'fast-2', deliverableProduced: true, firstAttempt: true, durationMs: 100 },
      { id: 'fast-3', deliverableProduced: true, firstAttempt: true, durationMs: 100 },
      { id: 'slow-1', deliverableProduced: true, firstAttempt: true, durationMs: 5000 },
    ];
    const result = analyzeIterations(entries);
    expect(result.slowest).toHaveLength(1);
    expect(result.slowest[0].id).toBe('slow-1');
  });

  it('identifies failure patterns', () => {
    const entries: IterationRecord[] = [
      { id: '1', deliverableProduced: false, firstAttempt: true, durationMs: 100, error: 'timeout' },
      { id: '2', deliverableProduced: false, firstAttempt: true, durationMs: 100, error: 'timeout' },
      { id: '3', deliverableProduced: true, firstAttempt: true, durationMs: 100 },
    ];
    const result = analyzeIterations(entries);
    expect(result.patterns.some(p => p.includes('failed to produce'))).toBe(true);
    expect(result.patterns.some(p => p.includes('timeout'))).toBe(true);
  });

  it('identifies retry patterns', () => {
    const entries: IterationRecord[] = [
      { id: '1', deliverableProduced: true, firstAttempt: false, durationMs: 100 },
      { id: '2', deliverableProduced: true, firstAttempt: false, durationMs: 100 },
      { id: '3', deliverableProduced: true, firstAttempt: true, durationMs: 100 },
    ];
    const result = analyzeIterations(entries);
    expect(result.patterns.some(p => p.includes('retries'))).toBe(true);
  });

  it('suggests improvements for low success rate', () => {
    const entries: IterationRecord[] = Array.from({ length: 10 }, (_, i) => ({
      id: `iter-${i}`,
      deliverableProduced: i < 5,
      firstAttempt: true,
      durationMs: 100,
    }));
    const result = analyzeIterations(entries);
    expect(result.suggestions.some(s => s.includes('targetPath'))).toBe(true);
  });

  it('congratulates excellent performance', () => {
    const entries: IterationRecord[] = Array.from({ length: 20 }, (_, i) => ({
      id: `iter-${i}`,
      deliverableProduced: true,
      firstAttempt: true,
      durationMs: 100,
    }));
    const result = analyzeIterations(entries);
    expect(result.suggestions.some(s => s.includes('Excellent'))).toBe(true);
  });

  it('limits slowest to top 5', () => {
    const entries: IterationRecord[] = [
      ...Array.from({ length: 10 }, (_, i) => ({
        id: `fast-${i}`,
        deliverableProduced: true,
        firstAttempt: true,
        durationMs: 10,
      })),
      ...Array.from({ length: 8 }, (_, i) => ({
        id: `slow-${i}`,
        deliverableProduced: true,
        firstAttempt: true,
        durationMs: 5000,
      })),
    ];
    const result = analyzeIterations(entries);
    expect(result.slowest.length).toBeLessThanOrEqual(5);
  });
});
