import { describe, it, expect } from 'bun:test';
import { calculateCorrectionRate, formatReport, Session } from '../correction-rate';

describe('calculateCorrectionRate', () => {
  it('returns zero metrics for empty sessions', () => {
    const result = calculateCorrectionRate([]);
    expect(result.totalSessions).toBe(0);
    expect(result.correctionRate).toBe(0);
    expect(result.trend).toBe('insufficient-data');
  });

  it('calculates correct rate for mixed sessions', () => {
    const sessions: Session[] = [
      { id: '1', agent: 'bob', timestamp: 1, corrected: false },
      { id: '2', agent: 'bob', timestamp: 2, corrected: true, correctionType: 'redirect' },
      { id: '3', agent: 'may', timestamp: 3, corrected: false },
      { id: '4', agent: 'may', timestamp: 4, corrected: true, correctionType: 'reject' },
    ];
    const result = calculateCorrectionRate(sessions);
    expect(result.totalSessions).toBe(4);
    expect(result.correctedSessions).toBe(2);
    expect(result.correctionRate).toBe(0.5);
  });

  it('breaks down by agent correctly', () => {
    const sessions: Session[] = [
      { id: '1', agent: 'bob', timestamp: 1, corrected: true, correctionType: 'redirect' },
      { id: '2', agent: 'bob', timestamp: 2, corrected: true, correctionType: 'modify' },
      { id: '3', agent: 'may', timestamp: 3, corrected: false },
      { id: '4', agent: 'may', timestamp: 4, corrected: false },
    ];
    const result = calculateCorrectionRate(sessions);
    expect(result.byAgent['bob'].rate).toBe(1.0);
    expect(result.byAgent['may'].rate).toBe(0.0);
  });

  it('counts correction types', () => {
    const sessions: Session[] = [
      { id: '1', agent: 'a', timestamp: 1, corrected: true, correctionType: 'redirect' },
      { id: '2', agent: 'a', timestamp: 2, corrected: true, correctionType: 'redirect' },
      { id: '3', agent: 'a', timestamp: 3, corrected: true, correctionType: 'reject' },
    ];
    const result = calculateCorrectionRate(sessions);
    expect(result.byType['redirect']).toBe(2);
    expect(result.byType['reject']).toBe(1);
  });

  it('detects improving trend', () => {
    const sessions: Session[] = [];
    // First half: 80% corrected
    for (let i = 0; i < 10; i++) {
      sessions.push({ id: `a${i}`, agent: 'x', timestamp: i, corrected: i < 8 });
    }
    // Second half: 20% corrected
    for (let i = 10; i < 20; i++) {
      sessions.push({ id: `b${i}`, agent: 'x', timestamp: i, corrected: i < 12 });
    }
    const result = calculateCorrectionRate(sessions);
    expect(result.trend).toBe('improving');
  });

  it('detects degrading trend', () => {
    const sessions: Session[] = [];
    // First half: 20% corrected
    for (let i = 0; i < 10; i++) {
      sessions.push({ id: `a${i}`, agent: 'x', timestamp: i, corrected: i < 2 });
    }
    // Second half: 80% corrected
    for (let i = 10; i < 20; i++) {
      sessions.push({ id: `b${i}`, agent: 'x', timestamp: i, corrected: i < 18 });
    }
    const result = calculateCorrectionRate(sessions);
    expect(result.trend).toBe('degrading');
  });
});

describe('formatReport', () => {
  it('produces readable output', () => {
    const metrics = calculateCorrectionRate([
      { id: '1', agent: 'bob', timestamp: 1, corrected: true, correctionType: 'redirect' },
      { id: '2', agent: 'bob', timestamp: 2, corrected: false },
    ]);
    const report = formatReport(metrics);
    expect(report).toContain('Correction Rate Report');
    expect(report).toContain('50.0%');
    expect(report).toContain('bob');
  });
});
