import { describe, it, expect } from 'bun:test';

const guardModule = await import('../guards/cost-limit');
const { guard } = guardModule;

describe('cost-limit guard', () => {
  it('returns empty for non step_done events', () => {
    expect(guard.handle({ type: 'step_start' } as any)).toEqual([]);
  });

  it('returns empty when total turns below warn threshold', () => {
    const event = {
      type: 'step_done',
      completedSteps: [{ result: { turnsUsed: 10 } }],
      result: { turnsUsed: 5 },
    };
    expect(guard.handle(event as any)).toEqual([]);
  });

  it('warns when total turns reach 40', () => {
    const event = {
      type: 'step_done',
      completedSteps: [{ result: { turnsUsed: 30 } }],
      result: { turnsUsed: 10 },
    };
    const result = guard.handle(event as any);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('warn');
    expect(result[0].reason).toContain('40');
  });

  it('blocks when total turns reach 60', () => {
    const event = {
      type: 'step_done',
      completedSteps: [{ result: { turnsUsed: 50 } }],
      result: { turnsUsed: 10 },
    };
    const result = guard.handle(event as any);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('block');
    expect(result[0].reason).toContain('60');
  });

  it('handles missing completedSteps', () => {
    const event = {
      type: 'step_done',
      result: { turnsUsed: 5 },
    };
    expect(guard.handle(event as any)).toEqual([]);
  });

  it('handles missing turnsUsed in steps', () => {
    const event = {
      type: 'step_done',
      completedSteps: [{ result: {} }, { result: { turnsUsed: 20 } }],
      result: { turnsUsed: 25 },
    };
    const result = guard.handle(event as any);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('warn');
  });

  it('handles missing result turnsUsed', () => {
    const event = {
      type: 'step_done',
      completedSteps: [{ result: { turnsUsed: 10 } }],
      result: {},
    };
    expect(guard.handle(event as any)).toEqual([]);
  });

  it('returns empty at exactly 39 turns', () => {
    const event = {
      type: 'step_done',
      completedSteps: [{ result: { turnsUsed: 30 } }],
      result: { turnsUsed: 9 },
    };
    expect(guard.handle(event as any)).toEqual([]);
  });

  it('warns at exactly 40 turns', () => {
    const event = {
      type: 'step_done',
      completedSteps: [],
      result: { turnsUsed: 40 },
    };
    const result = guard.handle(event as any);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('warn');
  });

  it('blocks at exactly 60 turns', () => {
    const event = {
      type: 'step_done',
      completedSteps: [],
      result: { turnsUsed: 60 },
    };
    const result = guard.handle(event as any);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('block');
  });
});
